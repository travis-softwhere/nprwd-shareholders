import { NextResponse } from "next/server";
import { db, shareholders } from "@/lib/db";
import { eq } from "drizzle-orm";

// GET handler to fetch designee for a shareholder
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shareholderId = searchParams.get("shareholderId");

    if (!shareholderId) {
      return NextResponse.json(
        { error: "Shareholder ID is required" },
        { status: 400 }
      );
    }

    const shareholder = await db.select({ designee: shareholders.designee })
      .from(shareholders)
      .where(eq(shareholders.shareholderId, shareholderId))
      .limit(1);

    if (!shareholder.length) {
      return NextResponse.json(
        { error: "Shareholder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ designee: shareholder[0].designee });

  } catch (error) {
    console.error("Error fetching designee:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST handler to set designee for a shareholder
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shareholderId, designee } = body;

    if (!shareholderId || !designee) {
      return NextResponse.json(
        { error: "Shareholder ID and designee are required" },
        { status: 400 }
      );
    }

    const updatedShareholder = await db.update(shareholders)
      .set({ designee })
      .where(eq(shareholders.shareholderId, shareholderId))
      .returning({ designee: shareholders.designee });

    if (!updatedShareholder.length) {
      return NextResponse.json(
        { error: "Shareholder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedShareholder[0]);

  } catch (error) {
    console.error("Error setting designee:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH handler to clear designee for a shareholder
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { shareholderId } = body;

    if (!shareholderId) {
      return NextResponse.json(
        { error: "Shareholder ID is required" },
        { status: 400 }
      );
    }

    const updatedShareholder = await db.update(shareholders)
      .set({ designee: null })
      .where(eq(shareholders.shareholderId, shareholderId))
      .returning({ designee: shareholders.designee });

    if (!updatedShareholder.length) {
      return NextResponse.json(
        { error: "Shareholder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedShareholder[0]);
  } catch (error) {
    console.error("Error clearing designee:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
