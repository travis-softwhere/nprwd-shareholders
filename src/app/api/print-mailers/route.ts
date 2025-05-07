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
      
      // === NEW LAYOUT CONSTANTS ===
      const leftMargin = 50;
      const topMargin = 160;
      const addressBlockWidth = 220;
      const gap = 75;
      
      const maxWidth = Math.min(250, width * 0.5);
      const defaultFontSize = 10;
      let fontSize = defaultFontSize;

      // Function to draw wrapped text with left alignment
      const drawWrappedText = (text: string, yPosition: number, customFontSize?: number) => {
        const words = text.split(' ');
        let line = '';
        let yOffset = 0;
        const actualFontSize = customFontSize || fontSize;
        const lineHeight = actualFontSize * 1.3;

        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const textWidth = actualFontSize * (testLine.length * 0.6);

          if (textWidth > maxWidth && line !== '') {
            page.drawText(line, {
              x: leftMargin,
              y: yPosition - yOffset,
              size: actualFontSize,
              lineHeight: lineHeight,
              maxWidth: maxWidth,
            });
            line = word;
            yOffset += lineHeight;
          } else {
            line = testLine;
          }
        }

        if (line) {
          page.drawText(line, {
            x: leftMargin,
            y: yPosition - yOffset,
            size: actualFontSize,
            lineHeight: lineHeight,
            maxWidth: maxWidth,
          });
        }

        return yOffset + lineHeight;
      };

      // === ADDRESS BLOCK ===
      let addressY = height - topMargin;
      let addressX = leftMargin;
      const mailingFontSize = 12;
      let addressCurrentY = addressY;
      
      // Draw name
      const nameHeight = drawWrappedText(shareholder.name || '', addressCurrentY, mailingFontSize);
      addressCurrentY -= nameHeight + 6;
      console.log('Mailing Address: ', mailingAddress)

      // Draw address
      const addressHeight = drawWrappedText(mailingAddress, addressCurrentY, mailingFontSize);
      addressCurrentY -= addressHeight + 6;
      console.log('City/State/Zip: ', cityStateZip)

      // Draw city/state/zip
      drawWrappedText(cityStateZip, addressCurrentY, mailingFontSize);

      // === BARCODE ===
      const barcodeX = leftMargin + addressBlockWidth + gap;
      const barcodeY = height - topMargin - (barcodeDims.height / 2) - 30;
      page.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: barcodeDims.width,
        height: barcodeDims.height,
      });

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
