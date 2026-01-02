import prisma from "@/lib/prisma";

// 未登录用户限制：每天最多 10 次对话
const GUEST_DAILY_LIMIT = 10;

// 已登录用户限制：每天最多 100 次对话
const USER_DAILY_LIMIT = 100;

export async function checkRateLimit(
  fingerprint?: string,
  userId?: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (userId) {
    // 已登录用户检查
    const count = await prisma.usageRecord.count({
      where: {
        userId,
        action: "chat",
        createdAt: {
          gte: today,
        },
      },
    });

    return {
      allowed: count < USER_DAILY_LIMIT,
      remaining: Math.max(0, USER_DAILY_LIMIT - count),
      limit: USER_DAILY_LIMIT,
    };
  } else if (fingerprint) {
    // 未登录用户检查
    const count = await prisma.usageRecord.count({
      where: {
        fingerprint,
        action: "chat",
        createdAt: {
          gte: today,
        },
      },
    });

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
  await prisma.usageRecord.create({
    data: {
      action,
      fingerprint,
      userId,
    },
  });
}
