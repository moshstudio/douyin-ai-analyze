import { getDb } from "@/db";
import { usageRecords } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

// 未登录用户限制：每天最多 N 次对话（默认 10 次）
const GUEST_DAILY_LIMIT = parseInt(process.env.GUEST_DAILY_LIMIT || "10", 10);

// 已登录用户限制：每天最多 N 次对话（默认 20 次）
const USER_DAILY_LIMIT = parseInt(process.env.USER_DAILY_LIMIT || "20", 20);

export async function checkRateLimit(
  fingerprint?: string,
  userId?: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const db = getDb();

  if (userId) {
    // 已登录用户检查
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.userId, userId),
          eq(usageRecords.action, "chat"),
          gte(usageRecords.createdAt, today)
        )
      );

    const count = result[0]?.count || 0;

    return {
      allowed: count < USER_DAILY_LIMIT,
      remaining: Math.max(0, USER_DAILY_LIMIT - count),
      limit: USER_DAILY_LIMIT,
    };
  } else if (fingerprint) {
    // 未登录用户检查
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.fingerprint, fingerprint),
          eq(usageRecords.action, "chat"),
          gte(usageRecords.createdAt, today)
        )
      );

    const count = result[0]?.count || 0;

    return {
      allowed: count < GUEST_DAILY_LIMIT,
      remaining: Math.max(0, GUEST_DAILY_LIMIT - count),
      limit: GUEST_DAILY_LIMIT,
    };
  }

  // 既没有 fingerprint 也没有 userId，不允许请求
  return {
    allowed: false,
    remaining: 0,
    limit: 0,
  };
}

export async function recordUsage(
  action: string,
  fingerprint?: string,
  userId?: string
): Promise<void> {
  const db = getDb();
  await db.insert(usageRecords).values({
    action,
    fingerprint,
    userId,
    createdAt: new Date(),
  });
}
