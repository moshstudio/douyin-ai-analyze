import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/feedback/list - 获取反馈列表（需要权限）
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // 检查用户是否登录
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 检查用户是否有查看反馈的权限
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { canViewFeedback: true },
    });

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
    const where: { status?: string; type?: string } = {};
    if (status) where.status = status;
    if (type) where.type = type;

    // 查询反馈列表
    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
      prisma.feedback.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      feedbacks: feedbacks.map((f) => ({
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
