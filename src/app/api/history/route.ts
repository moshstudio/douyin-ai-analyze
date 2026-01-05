import { auth } from "@/lib/auth";
import { getDb } from "@/db";
import { conversations } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const fingerprint = searchParams.get("fingerprint");

  if (!session?.user?.id && !fingerprint) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conditions = [];
    if (session?.user?.id) {
      conditions.push(eq(conversations.userId, session.user.id));
    } else if (fingerprint) {
      conditions.push(eq(conversations.fingerprint, fingerprint));
      // Ensure we don't accidentally fetch user's chats if fingerprint collides (unlikely but safe)
      conditions.push(isNull(conversations.userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const db = await getDb();

    const fetchedConversations = await db.query.conversations.findMany({
      where: whereClause,
      orderBy: [desc(conversations.updatedAt)],
      with: {
        messages: {
          columns: { id: true },
        },
      },
      limit: 50, // Limit to 50 recent conversations for now
    });

    const formattedConversations = fetchedConversations.map((c) => ({
      ...c,
      _count: {
        messages: c.messages.length,
      },
      messages: undefined,
    }));

    return NextResponse.json(formattedConversations);
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const { fingerprint, title } = (await req.json()) as {
    fingerprint?: string;
    title?: string;
  };

  if (!session?.user?.id && !fingerprint) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const createdConversation = await db
      .insert(conversations)
      .values({
        userId: session?.user?.id || null,
        fingerprint: session?.user?.id ? null : fingerprint,
        title: title || "New Chat",
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
