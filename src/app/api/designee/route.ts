import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { shareholders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }
  return session;
}

// GET — fetch designated voter for a shareholder (any signed-in user)
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shareholderId = searchParams.get("shareholderId");

    if (!shareholderId) {
      return NextResponse.json(
        { error: "Shareholder ID is required" },
        { status: 400 },
      );
    }

    const rows = await db
      .select({ designee: shareholders.designee })
      .from(shareholders)
      .where(eq(shareholders.shareholderId, shareholderId))
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({ error: "Shareholder not found" }, { status: 404 });
    }

    return NextResponse.json({ designee: rows[0].designee });
  } catch (error) {
    console.error("Error fetching designee:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — set designated voter (any signed-in user)
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const shareholderId = String(body.shareholderId ?? "").trim();
    const designee = String(body.designee ?? "").trim();

    if (!shareholderId || !designee) {
      return NextResponse.json(
        { error: "Shareholder ID and designated voter name are required" },
        { status: 400 },
      );
    }

    const updatedShareholder = await db
      .update(shareholders)
      .set({ designee })
      .where(eq(shareholders.shareholderId, shareholderId))
      .returning({ designee: shareholders.designee });

    if (!updatedShareholder.length) {
      return NextResponse.json({ error: "Shareholder not found" }, { status: 404 });
    }

    revalidatePath(`/shareholders/${shareholderId}`);

    return NextResponse.json(updatedShareholder[0]);
  } catch (error) {
    console.error("Error setting designee:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — clear designated voter (any signed-in user)
export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const shareholderId = String(body.shareholderId ?? "").trim();

    if (!shareholderId) {
      return NextResponse.json(
        { error: "Shareholder ID is required" },
        { status: 400 },
      );
    }

    const updatedShareholder = await db
      .update(shareholders)
      .set({ designee: null })
      .where(eq(shareholders.shareholderId, shareholderId))
      .returning({ designee: shareholders.designee });

    if (!updatedShareholder.length) {
      return NextResponse.json({ error: "Shareholder not found" }, { status: 404 });
    }

    revalidatePath(`/shareholders/${shareholderId}`);

    return NextResponse.json(updatedShareholder[0]);
  } catch (error) {
    console.error("Error clearing designee:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
