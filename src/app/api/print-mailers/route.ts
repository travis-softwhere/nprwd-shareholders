import { NextResponse } from "next/server";
import bwip from "bwip-js";
import { logToFile, LogLevel } from "@/utils/logger";
import { db } from "@/lib/db";
import { shareholders, properties } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

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

    // Load the template PDF
    const templatePath = path.join(process.cwd(), 'docs', 'Publication1.pdf');
    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.create();
    const templateDoc = await PDFDocument.load(templateBytes);

    // Process each shareholder
    for (const shareholder of groupedData) {
      const shareholderId = shareholder.shareholderId;
      const shareholderName = shareholder.name || '';
      const mailingAddress = shareholder.properties[0]?.ownerMailingAddress || '';
      const cityStateZip = shareholder.properties[0]?.ownerCityStateZip || '';
      const fullAddress = `${mailingAddress}\n${cityStateZip}`;

      // Generate barcode for the shareholder ID
      let barcodeBuffer: Buffer;
      try {
        barcodeBuffer = await new Promise<Buffer>((resolve, reject) => {
          bwip.toBuffer(
            {
              bcid: "code128",
              text: shareholderId,
              scale: 3,
              height: 15,
              includetext: true,
              textxalign: "center",
            },
            (err: Error | null, png: Buffer) => {
              if (err) reject(err);
              else resolve(png);
            },
          );
        });
      } catch (error) {
        await logToFile("mailers", "Error generating shareholder barcode", LogLevel.ERROR, {
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
        continue;
      }

      // Copy all pages from template
      const templatePages = await pdfDoc.copyPages(templateDoc, templateDoc.getPageIndices());
      templatePages.forEach(page => pdfDoc.addPage(page));

      // Get the last page (page 8) for this shareholder's copy
      const lastPageIndex = pdfDoc.getPageCount() - 1;
      const page = pdfDoc.getPage(lastPageIndex);
      
      // Convert barcode buffer to PDF-compatible image
      const barcodeImage = await pdfDoc.embedPng(barcodeBuffer);
      const barcodeDims = barcodeImage.scale(0.5); // Scale down the barcode a bit

      // Position barcode in upper middle of page
      const { width, height } = page.getSize();
      const barcodeX = (width - barcodeDims.width) / 2;
      const barcodeY = height - 150; // 150 points from top

      // Calculate text widths to determine if we need to scale down font size
      const maxWidth = Math.min(300, width * 0.8); // Max width is either 300 points or 80% of page width
      const defaultFontSize = 12;
      let fontSize = defaultFontSize;

      // Draw barcode
      page.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: barcodeDims.width,
        height: barcodeDims.height,
      });

      // Function to draw wrapped text
      const drawWrappedText = (text: string, yPosition: number) => {
        const words = text.split(' ');
        let line = '';
        let yOffset = 0;
        const lineHeight = fontSize * 1.2; // 120% of font size for line height

        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const textWidth = fontSize * (testLine.length * 0.6); // Approximate width

          if (textWidth > maxWidth && line !== '') {
            // Draw the line
            page.drawText(line, {
              x: (width - fontSize * (line.length * 0.6)) / 2, // Center the line
              y: yPosition - yOffset,
              size: fontSize,
              lineHeight: lineHeight,
              maxWidth: maxWidth,
            });
            line = word;
            yOffset += lineHeight;
          } else {
            line = testLine;
          }
        }

        // Draw the last line
        if (line) {
          page.drawText(line, {
            x: (width - fontSize * (line.length * 0.6)) / 2, // Center the line
            y: yPosition - yOffset,
            size: fontSize,
            lineHeight: lineHeight,
            maxWidth: maxWidth,
          });
        }

        return yOffset + lineHeight; // Return total height used
      };

      // Draw name and address with proper spacing
      let currentY = barcodeY - barcodeDims.height - 20; // Start 20 points below barcode
      
      // Draw name
      const nameHeight = drawWrappedText(shareholderName, currentY);
      currentY -= nameHeight + 10; // Add 10 points padding between name and address

      // Draw address
      const addressHeight = drawWrappedText(mailingAddress, currentY);
      currentY -= addressHeight + 5; // Add 5 points padding between address lines

      // Draw city/state/zip
      drawWrappedText(cityStateZip, currentY);
    }

    await logToFile("mailers", "Starting PDF generation", LogLevel.INFO);
    const pdfBytes = await pdfDoc.save();
    await logToFile("mailers", "PDF generation complete", LogLevel.INFO, {
      pdfSizeBytes: pdfBytes.byteLength
    });

    return new Response(pdfBytes, {
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
