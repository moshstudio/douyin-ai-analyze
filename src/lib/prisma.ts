import { PrismaClient } from "../generated/prisma/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaD1 } from "@prisma/adapter-d1";

// Lazy initialization - getCloudflareContext() can only be called during request handling
let prismaInstance: PrismaClient | null = null;

/**
 * Get the Prisma client instance.
 * Must be called during request handling, not at module load time.
 */
export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    const { env } = getCloudflareContext();
    const adapter = new PrismaD1(env.douyin_ai_analyze);
    prismaInstance = new PrismaClient({ adapter });
  }
  return prismaInstance;
}

// For backwards compatibility - but this will throw if accessed at module load time
// Prefer using getPrisma() function instead
const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return getPrisma()[prop as keyof PrismaClient];
  },
});

export default prismaProxy;
