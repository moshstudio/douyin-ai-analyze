import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/user/permissions - 获取当前用户权限
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ canViewFeedback: false });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { canViewFeedback: true },
    });

    return NextResponse.json({
      canViewFeedback: user?.canViewFeedback || false,
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return NextResponse.json({ canViewFeedback: false });
  }
}
