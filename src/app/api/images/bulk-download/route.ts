import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.VERCEL === '1'
  ? path.join('/tmp', 'jolie-uploads')
  : (process.env.UPLOAD_DIR || path.join(process.cwd(), 'upload'));

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids }: { ids: string[] } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Please provide an array of image IDs' },
        { status: 400 }
      );
    }

    const images = await db.image.findMany({
      where: {
        id: { in: ids },
      },
    });

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images found with the provided IDs' },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (const image of images) {
      try {
        const filePath = path.join(UPLOAD_DIR, image.path);
        const fileBuffer = await readFile(filePath);

        let fileName = image.originalName;
        if (usedNames.has(fileName)) {
          const ext = path.extname(fileName);
          const base = path.basename(fileName, ext);
          let counter = 1;
          while (usedNames.has(`${base}_${counter}${ext}`)) {
            counter++;
          }
          fileName = `${base}_${counter}${ext}`;
        }
        usedNames.add(fileName);

        zip.file(fileName, fileBuffer);
      } catch (fileError) {
        console.error(`Error reading file ${image.path}:`, fileError);
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="images-${Date.now()}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error creating bulk download:', error);
    return NextResponse.json(
      { error: 'Failed to create bulk download' },
      { status: 500 }
    );
  }
}
