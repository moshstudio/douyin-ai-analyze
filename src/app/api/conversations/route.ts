import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
1
    // 如果没有登录，则无法获取历史记录（或者后续实现基于fingerprint的获取，但通常基于userID）
    if (!userId) {
      return NextResponse.json({ conversations: [] });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // 暂时不常用，因为 chat-agent 会自动创建，但可以用于 creating empty chat
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const body = await req.json();
    const { title } = body;

    const conversation = await prisma.conversation.create({
      data: {
        userId: userId || null,
        title: title || "新对话",
      },
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
