import { NextResponse } from "next/server";
import bwip from "bwip-js";
import { jsPDF } from "jspdf";
import { logToFile, LogLevel } from "@/utils/logger";
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

    await logToFile("mailers", "Starting PDF generation process", LogLevel.INFO);

    // Instead of logging all headers (which contain cookies and tokens), just check if needed ones exist
    const contentType = request.headers.get("content-type");
    await logToFile("mailers", "Validating request headers", LogLevel.INFO, {
      hasContentType: !!contentType,
      isJsonContentType: contentType?.toLowerCase().includes("application/json") || false,
    });

    if (!contentType) {
      await logToFile("mailers", "Missing content type header", LogLevel.ERROR);
      return NextResponse.json({ error: "Content-Type header is required" }, { status: 400 });
    }

    if (!contentType.toLowerCase().includes("application/json")) {
      await logToFile("mailers", "Invalid content type", LogLevel.ERROR, {
        receivedType: contentType,
      });
      return NextResponse.json(
        { error: `Invalid content type. Expected application/json but got ${contentType}` },
        { status: 400 },
      );
    }

    // Parse and validate request body without logging the actual content
    const body = await request.json();
    await logToFile("mailers", "Request body received", LogLevel.INFO, {
      hasMeetingId: !!body.meetingId,
      isStringMeetingId: typeof body.meetingId === "string",
    });

    const { meetingId } = body;
    if (!meetingId || typeof meetingId !== "string") {
      await logToFile("mailers", "Invalid or missing meetingId", LogLevel.ERROR);
      return NextResponse.json({ error: "Invalid or missing meetingId" }, { status: 400 });
    }

    // Fetch raw joined rows from the database
    const rawData = await db
      .select()
      .from(shareholders)
      .leftJoin(properties, eq(shareholders.shareholderId, properties.shareholderId))
      .where(eq(shareholders.meetingId, meetingId));

    if (!rawData.length) {
      await logToFile("mailers", "No shareholders found for the given meeting ID", LogLevel.ERROR);
      return NextResponse.json({ error: "No shareholders found for the given meeting ID" }, { status: 404 });
    }

    await logToFile("mailers", "Database query completed", LogLevel.INFO, {
      totalRows: rawData.length,
    });

    // Group rows by shareholderId
    const groupedData = groupShareholdersById(rawData);
    await logToFile("mailers", "Grouped shareholder data", LogLevel.INFO, {
      uniqueShareholderCount: groupedData.length
    });

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
              scale: 4,
              height: 20,
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
        await logToFile("mailers", "Error generating shareholder barcode", LogLevel.ERROR, {
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
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
      const propertyWidth = 180; // Width for each property column
      const propertiesPerRow = 3; // Number of properties to show per row
      const rowHeight = 100; // Height needed for each row of properties

      // Group properties into rows of 3
      for (let i = 0; i < shareholder.properties.length; i += propertiesPerRow) {
        const rowProperties = shareholder.properties.slice(i, i + propertiesPerRow);
        let propertyX = propertyStartX;

        // For each property in the current row
        for (const property of rowProperties) {
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
          doc.text(details, propertyX, currentY);

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
            await logToFile("mailers", "Error generating property barcode", LogLevel.ERROR, {
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            });
          }

          // Add the property barcode image below the details
          if (propertyBarcode) {
            doc.addImage(propertyBarcode, "PNG", propertyX, currentY + 50, 150, 20);
          }

          // Move to the next column
          propertyX += propertyWidth;
        }

        // Move down for the next row
        currentY += rowHeight;

        // Check if we need a new page for the next row
        if (currentY > doc.internal.pageSize.height - 100 && i + propertiesPerRow < shareholder.properties.length) {
          doc.addPage();
          currentY = 50; // Reset Y position for the new page
        }
      }

      // Add a new page if not the last shareholder
      if (i < groupedData.length - 1) {
        doc.addPage();
      }
    }

    await logToFile("mailers", "Starting PDF generation", LogLevel.INFO);
    const pdfChunks = doc.output("arraybuffer");
    await logToFile("mailers", "PDF generation complete", LogLevel.INFO, {
      pdfSizeBytes: pdfChunks.byteLength
    });

    return new Response(pdfChunks, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="shareholder-mailers.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await logToFile("mailers", "Error generating mailers", LogLevel.ERROR, {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorType: error instanceof Error ? error.name : "Unknown type"
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate mailers" },
      { status: 500 },
    );
  }
}
