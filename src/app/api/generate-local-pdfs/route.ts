import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import fs from 'fs/promises'
import path from 'path'
import { PDFDocument } from 'pdf-lib'
import bwip from "bwip-js"

// Helper function to generate a batch PDF
async function generateBatchPdf(batch: any[], batchNumber: number): Promise<{ fileName: string; pdfBytes: Uint8Array }> {
  console.log(`\nStarting PDF generation for batch ${batchNumber} (${batch.length} shareholders)`);

  const templatePath = path.join(process.cwd(), 'docs', 'Production1.pdf');
  const templateBytes = await fs.readFile(templatePath);
  const pdfDoc = await PDFDocument.create();
  const templateDoc = await PDFDocument.load(templateBytes);

  let processedCount = 0;
  for (const shareholder of batch) {
    try {
      const shareholderId = shareholder.shareholderId;
      const shareholderName = shareholder.name || '';
      const mailingAddress = shareholder.ownerMailingAddress || '';
      const cityStateZip = shareholder.ownerCityStateZip || '';
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
        console.error(`Error generating barcode for shareholder ${shareholderId}:`, error);
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
      const barcodeDims = barcodeImage.scale(0.8);

      // Position calculations for the page
      const { width, height } = page.getSize();

      // === NEW CENTERED LAYOUT CONSTANTS ===
      // Define the area for the block (adjust as needed for your template)
      const areaLeft = 50;
      const areaTop = height - 160;
      const areaWidth = 400;
      const mailingFontSize = 16;
      const lineHeight = mailingFontSize * 1.3;

      // --- BARCODE (centered at the top of the area) ---
      const barcodeWidth = barcodeDims.width;
      const barcodeHeight = barcodeDims.height;
      const barcodeX = 100 + areaLeft + (areaWidth - barcodeWidth) / 2;
      const barcodeY = areaTop;
      page.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: barcodeWidth,
        height: barcodeHeight,
      });

      // --- ADDRESS BLOCK (centered below barcode) ---
      let textY = barcodeY - barcodeHeight + 70; // 10pt gap below barcode
      // Helper to center text
      const drawCenteredText = (text: string, y: number, fontSize: number) => {
        const textWidth = fontSize * (text.length * 0.6); // crude estimate
        const x = 15 + areaLeft + (areaWidth - textWidth) / 2;
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          lineHeight,
          maxWidth: areaWidth,
        });
      };
      // Draw name
      drawCenteredText(shareholder.name || '', textY, mailingFontSize);
      textY -= lineHeight;
      // Draw mailing address
      drawCenteredText(mailingAddress, textY, mailingFontSize);
      textY -= lineHeight;
      // Draw city/state/zip
      drawCenteredText(cityStateZip, textY, mailingFontSize);

      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(`Batch ${batchNumber} progress: ${processedCount}/${batch.length} (${Math.round((processedCount / batch.length) * 100)}%)`);
      }
    } catch (error) {
      console.error(`Error processing shareholder ${shareholder.shareholderId} in batch ${batchNumber}:`, error);
    }
  }

  const pdfBytes = await pdfDoc.save();
  const fileName = `pdf-batch-${batchNumber}.pdf`;
  
  console.log(`Completed batch ${batchNumber}: ${processedCount}/${batch.length} shareholders processed`);

  return { fileName, pdfBytes };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const body = await request.json()
    const { meetingId, batchNumber, batch } = body

    if (!meetingId || !batchNumber || !batch) {
      return new NextResponse("Missing required fields", { status: 400 })
    }

    // Create the source directory if it doesn't exist
    const sourceDir = path.join(process.cwd(), 'source', meetingId)
    await fs.mkdir(sourceDir, { recursive: true })

    // Generate the PDF for this batch
    const { fileName, pdfBytes } = await generateBatchPdf(batch, batchNumber)
    console.log(`Generated ${fileName} (${(pdfBytes.length / (1024 * 1024)).toFixed(2)} MB)`)

    // Save to local filesystem
    const pdfPath = path.join(sourceDir, fileName)
    await fs.writeFile(pdfPath, pdfBytes)

    return NextResponse.json({ 
      success: true,
      path: pdfPath,
      fileName
    })
  } catch (error) {
    console.error("Error generating local PDF:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const body = await request.json()
    const { meetingId } = body

    if (!meetingId) {
      return new NextResponse("Meeting ID is required", { status: 400 })
    }

    // Delete the meeting's PDF directory
    const sourceDir = path.join(process.cwd(), 'source', meetingId)
    try {
      await fs.rm(sourceDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore error if directory doesn't exist
      console.log('Directory already deleted or does not exist')
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting local PDFs:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
} 