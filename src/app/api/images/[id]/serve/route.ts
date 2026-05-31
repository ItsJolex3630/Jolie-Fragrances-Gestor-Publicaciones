import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First, get just the metadata (without loading the BLOB)
    const imageMeta = await db.image.findUnique({
      where: { id },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        filePath: true,
      },
    });

    if (!imageMeta) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Try to read from filePath first (static images - no DB BLOB needed)
    if (imageMeta.filePath) {
      const fullPath = join(process.cwd(), imageMeta.filePath);
      if (existsSync(fullPath)) {
        const buffer = readFileSync(fullPath);
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': imageMeta.mimeType || 'application/octet-stream',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }

    // Fall back to BLOB data (for edited images without filePath)
    const imageWithData = await db.image.findUnique({
      where: { id },
      select: {
        data: true,
        mimeType: true,
      },
    });

    if (imageWithData?.data) {
      const buffer = Buffer.from(imageWithData.data);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': imageWithData.mimeType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=3600',
        },
        });
    }

    return NextResponse.json({ error: 'No image data available' }, { status: 404 });
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}
