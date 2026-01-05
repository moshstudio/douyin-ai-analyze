import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { feedbacks, users } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

// GET /api/feedback/list - 获取反馈列表（需要权限）
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // 检查用户是否登录
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();

    // 检查用户是否有查看反馈的权限
    const userResult = await db
      .select({ canViewFeedback: users.canViewFeedback })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const user = userResult[0];

    if (!user?.canViewFeedback) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(
      parseInt(searchParams.get("pageSize") || "10"),
      50
    );
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    // 构建查询条件
    const conditions = [];
    if (status) conditions.push(eq(feedbacks.status, status));
    if (type) conditions.push(eq(feedbacks.type, type));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询反馈列表
    const [fetchedFeedbacks, countResult] = await Promise.all([
      db.query.feedbacks.findMany({
        where: whereClause,
        orderBy: [desc(feedbacks.createdAt)],
        offset: (page - 1) * pageSize,
        limit: pageSize,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(feedbacks)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      feedbacks: fetchedFeedbacks.map((f) => ({
        id: f.id,
        type: f.type,
        content: f.content,
        email: f.email,
        status: f.status,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        fingerprint: f.fingerprint,
        user: f.user,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching feedbacks:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedbacks" },
      { status: 500 }
    );
  }
}
