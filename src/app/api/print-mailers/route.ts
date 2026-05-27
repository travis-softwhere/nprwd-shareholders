import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

import { put } from '@vercel/blob';

import {
  generateMeetingMailersPdf,
  type MailerBatchShareholder,
} from "@/lib/mailerBatchPdfGeneration";
import { mailerBatchPdfFileName } from "@/lib/mailerBatchConstants";
import { getPagesPerMailerBatch } from "@/lib/mailerBatchSizing";
import { canonicalShareholderId } from "@/lib/meetingScopedShareholderId";



export async function POST(request: Request) {

  try {

    console.log('Starting print-mailers request...');

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

    const { meetingId, batch, partNumber: partNumberRaw } = body;

    if (!meetingId || typeof meetingId !== "string" || !Array.isArray(batch)) {

      return NextResponse.json({ error: "Invalid or missing meetingId or batch" }, { status: 400 });

    }

    const { pagesPerBatch } = await getPagesPerMailerBatch();

    if (batch.length > pagesPerBatch) {

      return NextResponse.json(
        { error: `Each upload may include at most ${pagesPerBatch} owners (~2.5 GiB cap per file).` },
        { status: 400 },
      );

    }

    const partNumber =
      typeof partNumberRaw === "number" && Number.isFinite(partNumberRaw) && partNumberRaw >= 1
        ? Math.floor(partNumberRaw)
        : typeof partNumberRaw === "string" && /^\d+$/.test(partNumberRaw.trim())
          ? Math.max(1, parseInt(partNumberRaw.trim(), 10))
          : 1;

    const fileName = mailerBatchPdfFileName(partNumber);

    const normalizedBatch: MailerBatchShareholder[] = (batch as MailerBatchShareholder[]).map(
      (row) => ({
        ...row,
        meetingId: row.meetingId ?? meetingId,
        shareholderId: canonicalShareholderId(
          String(row.shareholderId),
          String(row.meetingId ?? meetingId),
        ),
      }),
    );

    const { pdfBytes } = await generateMeetingMailersPdf(normalizedBatch, { fileName });

    console.log(`Generated ${fileName} part ${partNumber} (${(pdfBytes.length / (1024 * 1024)).toFixed(2)} MB)`);



    const buffer = Buffer.from(pdfBytes);

    console.log('Converted PDF to Buffer, size:', buffer.length);



    const blobPath = `mailers/${meetingId}/${fileName}`;

    console.log('Preparing to upload to Vercel Blob:', blobPath);

    const blob = await put(blobPath, buffer, {

      access: 'public',

      contentType: 'application/pdf',

      addRandomSuffix: false,

      allowOverwrite: true,

    });

    console.log('Successfully uploaded to Vercel Blob:', blob.url);



    return NextResponse.json({

      success: true,

      fileName,

      partNumber,

      url: blob.url,

      size: pdfBytes.length,

    });

  } catch (error) {

    console.error('Error in print-mailers route:', error);

    return NextResponse.json(

      { error: error instanceof Error ? error.message : 'Unknown error' },

      { status: 500 },

    );

  }

}

