import { auth } from "@/lib/auth";
import { getDb } from "@/db";
import { conversations, messages } from "@/db/schema";
import { eq, gt, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const fingerprint = searchParams.get("fingerprint");
  const after = searchParams.get("after");

  if (!session?.user?.id && !fingerprint) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    // Fetch conversation and messages in one go if possible, or check ownership first
    // Checking ownership first is better pattern if messages are heavy
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, params.id),
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (session?.user?.id) {
      if (conversation.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      if (conversation.fingerprint !== fingerprint) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch messages with optional time filter
    const dbMessages = await db.query.messages.findMany({
      where: (messages, { and, eq, gt }) => {
        const conditions = [eq(messages.conversationId, params.id)];
        if (after) {
          conditions.push(gt(messages.createdAt, new Date(after)));
        }
        return and(...conditions);
      },
      orderBy: [asc(messages.createdAt)],
    });

    return NextResponse.json({ ...conversation, messages: dbMessages });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const fingerprint = searchParams.get("fingerprint");

  if (!session?.user?.id && !fingerprint) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, params.id),
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (session?.user?.id) {
      if (conversation.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      if (conversation.fingerprint !== fingerprint) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await db.delete(conversations).where(eq(conversations.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
