import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

// GET /api/user/permissions - 获取当前用户权限
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ canViewFeedback: false });
    }

    const db = getDb();
    const userResult = await db
      .select({ canViewFeedback: users.canViewFeedback })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const user = userResult[0];

    return NextResponse.json({
      canViewFeedback: user?.canViewFeedback || false,
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return NextResponse.json({ canViewFeedback: false });
  }
}
