import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { conversations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    // 如果没有登录，则无法获取历史记录（或者后续实现基于fingerprint的获取，但通常基于userID）
    if (!userId) {
      return NextResponse.json({ conversations: [] });
    }

    const db = getDb();

    // Use relation queries to get conversations with messages
    const userConversations = await db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
      orderBy: [desc(conversations.updatedAt)],
      with: {
        messages: {
          columns: {
            id: true,
          },
        },
      },
    });

    const formattedConversations = userConversations.map((c) => ({
      ...c,
      _count: {
        messages: c.messages.length,
      },
      messages: undefined, // Remove messages array from response to match Prisma shape if needed, or keep it
    }));

    return NextResponse.json({ conversations: formattedConversations });
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
    const { title } = (await req.json()) as { title?: string };

    const db = getDb();
    const createdConversation = await db
      .insert(conversations)
      .values({
        userId: userId || null,
        title: title || "新对话",
      })
      .returning();

    return NextResponse.json(createdConversation[0]);
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
