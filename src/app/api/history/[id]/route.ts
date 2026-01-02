import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
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
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: params.id,
      },
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
    const messages = await prisma.message.findMany({
      where: {
        conversationId: params.id,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({ ...conversation, messages });
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
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
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

    await prisma.conversation.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
