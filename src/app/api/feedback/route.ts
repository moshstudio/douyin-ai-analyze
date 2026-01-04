import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { feedbacks, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

// POST /api/feedback - 提交反馈
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const { type, content, email, fingerprint } = (await request.json()) as {
      type: string;
      content: string;
      email?: string;
      fingerprint?: string;
    };

    // 验证必填字段
    if (!type || !content) {
      return NextResponse.json(
        { error: "Type and content are required" },
        { status: 400 }
      );
    }

    // 验证反馈类型
    const validTypes = ["feature", "optimization", "bug", "other"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid feedback type" },
        { status: 400 }
      );
    }

    const db = getDb();

    // 验证用户是否存在（避免外键约束错误）
    let validUserId: string | null = null;
    if (session?.user?.id) {
      const userExists = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      if (userExists.length > 0) {
        validUserId = session.user.id;
      }
    }

    // 创建反馈记录
    const createdFeedback = await db
      .insert(feedbacks)
      .values({
        userId: validUserId,
        fingerprint: validUserId ? null : fingerprint || null,
        email: email || null,
        type,
        content,
        status: "pending",
        createdAt: new Date(),
      })
      .returning();

    const feedback = createdFeedback[0];

    return NextResponse.json({
      success: true,
      feedback: {
        id: feedback.id,
        type: feedback.type,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    );
  }
}
