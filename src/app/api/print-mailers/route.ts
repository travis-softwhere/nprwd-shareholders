import { NextResponse } from "next/server";
import bwip from "bwip-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';


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
      const areaWidth = 220;
      const mailingFontSize = 12;
      const lineHeight = mailingFontSize * 1.3;

      // --- BARCODE (centered at the top of the area) ---
      const barcodeWidth = barcodeDims.width;
      const barcodeHeight = barcodeDims.height;
      const barcodeX = areaLeft + (areaWidth - barcodeWidth) / 2;
      const barcodeY = areaTop;
      page.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: barcodeWidth,
        height: barcodeHeight,
      });

      // --- ADDRESS BLOCK (centered below barcode) ---
      let textY = barcodeY - barcodeHeight - 10; // 10pt gap below barcode
      // Helper to center text
      const drawCenteredText = (text: string, y: number, fontSize: number) => {
        const textWidth = fontSize * (text.length * 0.6); // crude estimate
        const x = areaLeft + (areaWidth - textWidth) / 2;
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
  const fileName = `mailers-batch-${batchNumber}.pdf`;
  
  console.log(`Completed batch ${batchNumber}: ${processedCount}/${batch.length} shareholders processed`);

  return { fileName, pdfBytes };
}

export async function POST(request: Request) {
  try {
    console.log('Starting print-mailers batch request...');
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log('Unauthorized: No session found');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "Content-Type header is required and must be application/json" }, { status: 400 });
    }

    const body = await request.json();
    const { meetingId, batchNumber, batch } = body;
    if (!meetingId || typeof meetingId !== "string" || !Array.isArray(batch) || typeof batchNumber !== "number") {
      return NextResponse.json({ error: "Invalid or missing meetingId, batchNumber, or batch" }, { status: 400 });
    }

    // Generate the PDF for this batch
    const { fileName, pdfBytes } = await generateBatchPdf(batch, batchNumber);
    console.log(`Generated ${fileName} (${(pdfBytes.length / (1024 * 1024)).toFixed(2)} MB)`);

    // Convert Uint8Array to Buffer for Vercel Blob
    const buffer = Buffer.from(pdfBytes);
    console.log('Converted PDF to Buffer, size:', buffer.length);

    // Upload to Vercel Blob
    const blobPath = `mailers/${meetingId}/${fileName}`;
    console.log('Preparing to upload to Vercel Blob:', blobPath);
    const blob = await put(blobPath, buffer, {
      access: 'public',
      contentType: 'application/pdf',
    });
    console.log('Successfully uploaded to Vercel Blob:', blob.url);

    return NextResponse.json({
      success: true,
      fileName,
      url: blob.url,
      size: pdfBytes.length,
    });
  } catch (error) {
    console.error('Error in print-mailers batch route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
