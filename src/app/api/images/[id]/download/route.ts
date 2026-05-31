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

    // Get metadata first (without loading BLOB)
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

    // For static images, redirect to the static file URL with download header
    if (imageMeta.filePath) {
      const staticUrl = '/' + imageMeta.filePath.replace(/^public\//, '');
      // We can't set Content-Disposition on a redirect, so we'll read the file
      const fullPath = join(process.cwd(), imageMeta.filePath);
      if (existsSync(fullPath)) {
        const buffer = readFileSync(fullPath);
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': imageMeta.mimeType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(imageMeta.originalName)}"`,
            'Content-Length': buffer.length.toString(),
          },
        });
      }
    }

    // Fall back to BLOB data (for edited images)
    const imageWithData = await db.image.findUnique({
      where: { id },
      select: {
        data: true,
        mimeType: true,
        originalName: true,
      },
    });

    if (imageWithData?.data) {
      const buffer = Buffer.from(imageWithData.data);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': imageWithData.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(imageWithData.originalName)}"`,
          'Content-Length': buffer.length.toString(),
        },
      });
    }

    return NextResponse.json({ error: 'No image data available' }, { status: 404 });
  } catch (error) {
    console.error('Error downloading image:', error);
    return NextResponse.json(
      { error: 'Failed to download image' },
      { status: 500 }
    );
  }
}
