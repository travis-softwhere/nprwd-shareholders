import { NextResponse } from "next/server";
import bwip from "bwip-js";
import { jsPDF } from "jspdf";
import { logToFile } from "@/utils/logger";
import { db } from "@/lib/db";
import { shareholders, properties } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Groups the left-joined rows by shareholderId.
 */
function groupShareholdersById(rows: {
  shareholders: {
    shareholderId: string;
    name: string | null;
  } | null;
  properties: {
    account?: string | null;
    ownerMailingAddress?: string | null;
    ownerCityStateZip?: string | null;
  } | null;
}[]) {
  const map: Record<string, {
    shareholderId: string;
    name: string | null;
    properties: {
      account?: string | null;
      ownerMailingAddress?: string | null;
      ownerCityStateZip?: string | null;
    }[];
  }> = {};

  for (const row of rows) {
    if (!row.shareholders) continue;
    const { shareholderId, name } = row.shareholders;
    if (!map[shareholderId]) {
      map[shareholderId] = {
        shareholderId,
        name,
        properties: [],
      };
    }
    if (row.properties) {
      map[shareholderId].properties.push(row.properties);
    }
  }

  return Object.values(map);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await logToFile("mailers", "Starting PDF generation process");

    const headers = Object.fromEntries(request.headers.entries());
    await logToFile("mailers", `Incoming headers: ${JSON.stringify(headers)}`);

    const contentType = request.headers.get("content-type");
    if (!contentType) {
      await logToFile("mailers", "Missing content type header");
      return NextResponse.json({ error: "Content-Type header is required" }, { status: 400 });
    }
    if (!contentType.toLowerCase().includes("application/json")) {
      await logToFile("mailers", `Invalid content type: ${contentType}`);
      return NextResponse.json(
        { error: `Invalid content type. Expected application/json but got ${contentType}` },
        { status: 400 },
      );
    }

    const body = await request.json();
    await logToFile("mailers", `Request body: ${JSON.stringify(body)}`);

    const { meetingId } = body;
    if (!meetingId || typeof meetingId !== "string") {
      await logToFile("mailers", "Invalid or missing meetingId");
      return NextResponse.json({ error: "Invalid or missing meetingId" }, { status: 400 });
    }

    // Fetch raw joined rows from the database
    const rawData = await db
      .select()
      .from(shareholders)
      .leftJoin(properties, eq(shareholders.shareholderId, properties.shareholderId))
      .where(eq(shareholders.meetingId, meetingId));

    if (!rawData.length) {
      await logToFile("mailers", "No shareholders found for the given meeting ID");
      return NextResponse.json({ error: "No shareholders found for the given meeting ID" }, { status: 404 });
    }

    await logToFile("mailers", `Total joined rows: ${rawData.length}`);

    // Group rows by shareholderId
    const groupedData = groupShareholdersById(rawData);
    await logToFile("mailers", `Found ${groupedData.length} unique shareholders`);

    // Create a new PDF document
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
    });

    // Loop through each shareholder (one page per shareholder)
    for (let i = 0; i < groupedData.length; i++) {
      const shareholder = groupedData[i];
      const name = shareholder.name?.substring(0, 50) || "N/A";
      const shareholderId = shareholder.shareholderId;

      let currentY = 50;

      // Print shareholder name centered
      doc.setFontSize(14);
      doc.text(name, doc.internal.pageSize.width / 2, currentY, { align: "center" });
      currentY += 20;

      // Print shareholder ID as text
      doc.setFontSize(10);
      doc.text(`Shareholder ID: ${shareholderId}`, 50, currentY);
      currentY += 20;

      // Generate barcode for the shareholder ID
      let shareholderBarcode = "";
      try {
        const barcodeBuffer = await new Promise<Buffer>((resolve, reject) => {
          bwip.toBuffer(
            {
              bcid: "code128",
              text: shareholderId,
              scale: 2,
              height: 10,
              includetext: true,
              textxalign: "center",
            },
            (err: Error | null, png: Buffer) => {
              if (err) reject(err);
              else resolve(png);
            },
          );
        });
        shareholderBarcode = `data:image/png;base64,${barcodeBuffer.toString("base64")}`;
      } catch (error) {
        await logToFile("mailers", `Error generating shareholder barcode for ${shareholderId}: ${error}`);
      }

      // Add shareholder barcode image
      if (shareholderBarcode) {
        doc.addImage(shareholderBarcode, "PNG", 50, currentY, 150, 30);
        currentY += 80;
      }

      // Print Properties header
      doc.setFontSize(12);
      doc.text("Properties:", 50, currentY);
      currentY += 20;

      // Set initial coordinates for property columns
      const propertyStartX = 50;
      const propertyWidth = 150; // Adjust as needed
      let propertyX = propertyStartX;
      const propertyY = currentY; // Y coordinate for the property section

      // For each property, generate a column with details and barcode
      for (const property of shareholder.properties) {
        const account = property.account?.substring(0, 30) || "N/A";
        const mailingAddress = property.ownerMailingAddress?.substring(0, 50) || "";
        const cityStateZip = property.ownerCityStateZip?.substring(0, 50) || "";

        // Build property details text
        let details = `Account: ${account}`;
        if (mailingAddress) {
          details += `\nAddress: ${mailingAddress}`;
        }
        if (cityStateZip) {
          details += `\n${cityStateZip}`;
        }

        // Print property details in a small font
        doc.setFontSize(8);
        doc.text(details, propertyX, propertyY);

        // Generate barcode for the property (using "account" as the barcode text)
        let propertyBarcode = "";
        try {
          const propBarcodeBuffer = await new Promise<Buffer>((resolve, reject) => {
            bwip.toBuffer(
              {
                bcid: "code128",
                text: account,
                scale: 1,
                height: 10,
                includetext: true,
                textxalign: "center",
              },
              (err: Error | null, png: Buffer) => {
                if (err) reject(err);
                else resolve(png);
              },
            );
          });
          propertyBarcode = `data:image/png;base64,${propBarcodeBuffer.toString("base64")}`;
        } catch (error) {
          await logToFile("mailers", `Error generating property barcode for account ${account}: ${error}`);
        }

        // Add the property barcode image below the details
        if (propertyBarcode) {
          doc.addImage(propertyBarcode, "PNG", propertyX, propertyY + 50, 120, 20);
        }

        // Move to the next column
        propertyX += propertyWidth;
      }

      // Move currentY down for next shareholder; here we assume a fixed height per page
      // (if needed, you can calculate the required height)
      currentY += 100;

      // Add a new page if not the last shareholder
      if (i < groupedData.length - 1) {
        doc.addPage();
      }
    }

    await logToFile("mailers", "Generating final PDF...");
    const pdfChunks = doc.output("arraybuffer");
    await logToFile("mailers", "PDF generation complete!");

    return new Response(pdfChunks, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="shareholder-mailers.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await logToFile("mailers", `Error generating mailers: ${error}`);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate mailers" },
      { status: 500 },
    );
  }
}
