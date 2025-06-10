import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

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

    const shareholder = await queryOne<{ designee: string | null }>(
      'SELECT designee FROM shareholders WHERE shareholder_id = $1',
      [shareholderId]
    );

    if (!shareholder) {
      return NextResponse.json(
        { error: "Shareholder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ designee: shareholder.designee });

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

    const updatedShareholder = await queryOne<{ designee: string | null }>(
      'UPDATE shareholders SET designee = $1 WHERE shareholder_id = $2 RETURNING designee',
      [designee, shareholderId]
    );

    if (!updatedShareholder) {
      return NextResponse.json(
        { error: "Shareholder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedShareholder);

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

    const updatedShareholder = await queryOne<{ designee: string | null }>(
      'UPDATE shareholders SET designee = NULL WHERE shareholder_id = $1 RETURNING designee',
      [shareholderId]
    );

    if (!updatedShareholder) {
      return NextResponse.json(
        { error: "Shareholder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedShareholder);
  } catch (error) {
    console.error("Error clearing designee:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
