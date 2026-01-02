import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import crypto from "crypto";
import prisma from "@/lib/prisma";

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  enabled?: boolean;
  /**
   * Optional function to determine if the result should be cached.
   * If it returns false, the result will not be stored in cache.
   */
  shouldCache?: (result: unknown) => boolean;
}

/**
 * Generates a hash for the tool input to use as a cache key
 */
function generateInputHash(input: Record<string, unknown>): string {
  const sortedInput = Object.keys(input)
    .sort()
    .reduce((acc: Record<string, unknown>, key) => {
      acc[key] = input[key];
      return acc;
    }, {});

  return crypto
    .createHash("md5")
    .update(JSON.stringify(sortedInput))
    .digest("hex");
}

/**
 * Wraps a LangChain tool with caching logic
 */
export function withCache<T extends z.ZodObject<z.ZodRawShape>>(
  tool: DynamicStructuredTool<T>,
  options: CacheOptions = {}
): DynamicStructuredTool<T> {
  const { ttl = 3600, enabled = true } = options;

  if (!enabled) return tool;

  const originalFunc = tool.func.bind(tool);

  // Override the func with caching logic
  tool.func = async (input: any, runManager?: any) => {
    const toolName = tool.name;
    const inputHash = generateInputHash(input as Record<string, unknown>);

    // 1. Try to get from cache
    if (enabled) {
      try {
        const cachedResult = await prisma.toolCache.findUnique({
          where: {
            toolName_inputHash: {
              toolName,
              inputHash,
            },
          },
        });

        if (cachedResult) {
          const isExpired = cachedResult.expiresAt
            ? new Date() > cachedResult.expiresAt
            : false;

          if (!isExpired) {
            console.log(`[Cache Hit] tool: ${toolName}`);
            return cachedResult.output;
          }
          console.log(`[Cache Expired] tool: ${toolName}`);
        } else {
          console.log(`[Cache Miss] tool: ${toolName}`);
        }
      } catch (cacheError) {
        // Log cache error but continue to execute tool
        console.error(`[Cache Read Error] tool: ${toolName}`, cacheError);
      }
    }

    // 2. Execute original function
    const result = await originalFunc(input, runManager);

    // 3. Save to cache if enabled and valid
    if (enabled) {
      // Determine if we should cache this result
      let canCache = true;
      if (options.shouldCache) {
        canCache = options.shouldCache(result);
      } else {
        // Default validation logic: don't cache if it looks like an error or empty result
        canCache = defaultShouldCache(result);
      }

      if (canCache) {
        try {
          const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : null;
          await prisma.toolCache.upsert({
            where: {
              toolName_inputHash: {
                toolName,
                inputHash,
              },
            },
            update: {
              output: result,
              expiresAt,
              createdAt: new Date(),
            },
            create: {
              toolName,
              inputHash,
              output: result,
              expiresAt,
            },
          });
          console.log(`[Cache Saved] tool: ${toolName}`);
        } catch (cacheSaveError) {
          console.error(`[Cache Save Error] tool: ${toolName}`, cacheSaveError);
        }
      } else {
        console.log(
          `[Cache Skipped] tool: ${toolName} (invalid or empty result)`
        );
      }
    }

    return result;
  };

  return tool;
}
/**
 * Default logic to determine if a tool result should be cached.
 */
function defaultShouldCache(result: unknown): boolean {
  if (result === null || result === undefined) return false;

  let data: any = result;
  if (typeof result === "string") {
    try {
      data = JSON.parse(result);
    } catch {
      // If it's just a string, check if it's empty
      return result.trim().length > 0;
    }
  }

  // Common error patterns
  if (data.code !== undefined && data.code !== 0 && data.code !== 200) {
    return false;
  }
  if (data.success === false) return false;
  if (data.error) return false;

  // Common empty patterns
  if (data.data) {
    // Check for empty arrays in common data fields
    if (Array.isArray(data.data) && data.data.length === 0) return false;
    if (
      data.data.business_data &&
      Array.isArray(data.data.business_data) &&
      data.data.business_data.length === 0
    ) {
      return false;
    }
    // Check for empty object
    if (
      typeof data.data === "object" &&
      data.data !== null &&
      Object.keys(data.data).length === 0
    ) {
      return false;
    }
  }

  return true;
}
