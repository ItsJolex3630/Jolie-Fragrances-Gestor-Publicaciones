import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import JSZip from 'jszip';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

async function getImageBuffer(imageId: string): Promise<{ buffer: Buffer; originalName: string } | null> {
  // Get metadata first (without BLOB)
  const imageMeta = await db.image.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      originalName: true,
      filePath: true,
    },
  });

  if (!imageMeta) return null;

  // Try to read from filePath first
  if (imageMeta.filePath) {
    const fullPath = join(process.cwd(), imageMeta.filePath);
    if (existsSync(fullPath)) {
      return {
        buffer: readFileSync(fullPath),
        originalName: imageMeta.originalName,
      };
    }
  }

  // Fall back to BLOB data
  const imageWithData = await db.image.findUnique({
    where: { id: imageId },
    select: {
      data: true,
      originalName: true,
    },
  });

  if (imageWithData?.data) {
    return {
      buffer: Buffer.from(imageWithData.data),
      originalName: imageWithData.originalName,
    };
  }

  return null;
}

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

    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (const id of ids) {
      try {
        const result = await getImageBuffer(id);
        if (!result) {
          console.error(`Could not read data for image ${id}`);
          continue;
        }

        let fileName = result.originalName;
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

        zip.file(fileName, result.buffer);
      } catch (fileError) {
        console.error(`Error processing file ${id}:`, fileError);
      }
    }

    if (usedNames.size === 0) {
      return NextResponse.json(
        { error: 'No images found with the provided IDs' },
        { status: 404 }
      );
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
