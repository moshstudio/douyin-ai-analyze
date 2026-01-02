import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/feedback - 提交反馈
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { type, content, email, fingerprint } = body;

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

    // 验证用户是否存在（避免外键约束错误）
    let validUserId: string | null = null;
    if (session?.user?.id) {
      const userExists = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
      });
      if (userExists) {
        validUserId = session.user.id;
      }
    }

    // 创建反馈记录
    const feedback = await prisma.feedback.create({
      data: {
        userId: validUserId,
        fingerprint: validUserId ? null : fingerprint || null,
        email: email || null,
        type,
        content,
        status: "pending",
      },
    });

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
