import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
  avif: 'image/avif',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const originalImage = await db.image.findUnique({
      where: { id },
    });

    if (!originalImage) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const body = await request.json();
    const { aspectRatio, format, quality = 90 } = body;

    if (!aspectRatio && !format) {
      return NextResponse.json(
        { error: 'At least one of aspectRatio or format must be provided' },
        { status: 400 }
      );
    }

    const originalBuffer = Buffer.from(originalImage.data);
    const originalWidth = originalImage.width;
    const originalHeight = originalImage.height;

    const outputFormat = format || originalImage.format;
    let pipeline = sharp(originalBuffer);

    let newWidth = originalWidth;
    let newHeight = originalHeight;
    let ratioSuffix = '';

    if (aspectRatio) {
      const [rw, rh] = aspectRatio.split(':').map(Number);
      if (isNaN(rw) || isNaN(rh) || rw <= 0 || rh <= 0) {
        return NextResponse.json(
          { error: 'Invalid aspect ratio format. Use e.g. "1:1", "4:5", "16:9"' },
          { status: 400 }
        );
      }

      const targetRatio = rw / rh;
      const currentRatio = originalWidth / originalHeight;

      if (currentRatio > targetRatio) {
        newHeight = originalHeight;
        newWidth = Math.round(originalHeight * targetRatio);
      } else {
        newWidth = originalWidth;
        newHeight = Math.round(originalWidth / targetRatio);
      }

      pipeline = pipeline.resize(newWidth, newHeight, {
        fit: 'cover',
        position: 'center',
      });

      ratioSuffix = `_${aspectRatio.replace(':', 'x')}`;
    }

    const formatOptions: Record<string, object> = {
      jpeg: { quality },
      jpg: { quality },
      webp: { quality },
      png: {},
      gif: {},
      avif: { quality },
      tiff: { quality },
    };

    const sharpFormat = outputFormat === 'jpg' ? 'jpeg' : outputFormat;
    const options = formatOptions[sharpFormat] || {};
    pipeline = pipeline.toFormat(sharpFormat as keyof sharp.FormatEnum, options);

    const ext = `.${outputFormat}`;
    const uniqueName = `${uuidv4()}${ratioSuffix}${ext}`;
    const newBuffer = await pipeline.toBuffer();
    const mimeType = MIME_TYPES[outputFormat.toLowerCase()] || 'image/png';

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(newWidth, newHeight);
    const newAspectRatio = `${newWidth / divisor}:${newHeight / divisor}`;

    // Store edited image directly in the database
    const newImage = await db.image.create({
      data: {
        name: uniqueName,
        originalName: `${path.parse(originalImage.originalName).name}${ratioSuffix}${ext}`,
        data: newBuffer,
        mimeType,
        width: newWidth,
        height: newHeight,
        size: newBuffer.length,
        format: outputFormat,
        aspectRatio: newAspectRatio,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        mimeType: true,
        width: true,
        height: true,
        size: true,
        format: true,
        aspectRatio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(newImage, { status: 201 });
  } catch (error) {
    console.error('Error editing image:', error);
    return NextResponse.json(
      { error: 'Failed to edit image' },
      { status: 500 }
    );
  }
}
