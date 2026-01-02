import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const fingerprint = searchParams.get("fingerprint");

  if (!session?.user?.id && !fingerprint) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const whereClause: any = {};
    if (session?.user?.id) {
      whereClause.userId = session.user.id;
    } else if (fingerprint) {
      whereClause.fingerprint = fingerprint;
      // Ensure we don't accidentally fetch user's chats if fingerprint collides (unlikely but safe)
      whereClause.userId = null;
    }

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
      take: 50, // Limit to 50 recent conversations for now
    });

    return NextResponse.json(conversations);
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
    const conversation = await prisma.conversation.create({
      data: {
        userId: session?.user?.id,
        fingerprint: session?.user?.id ? undefined : fingerprint,
        title: title || "New Chat",
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
