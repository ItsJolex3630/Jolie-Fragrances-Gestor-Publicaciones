import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'upload');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'newest';

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { originalName: { contains: search } },
          ],
        }
      : {};

    const orderBy: Record<string, string> =
      sort === 'oldest'
        ? { createdAt: 'asc' }
        : sort === 'name'
          ? { name: 'asc' }
          : sort === 'size_asc'
            ? { size: 'asc' }
            : sort === 'size_desc'
              ? { size: 'desc' }
              : { createdAt: 'desc' };

    const images = await db.image.findMany({
      where,
      orderBy,
    });

    return NextResponse.json(images);
  } catch (error) {
    console.error('Error listing images:', error);
    return NextResponse.json(
      { error: 'Failed to list images' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename
    const ext = path.extname(file.name) || '.png';
    const uniqueName = `${uuidv4()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    // Save file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Get image metadata using sharp
    const metadata = await sharp(filePath).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const format = metadata.format || ext.replace('.', '');
    const size = buffer.length;

    // Calculate aspect ratio
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const aspectRatio = `${width / divisor}:${height / divisor}`;

    // Save metadata to database
    const image = await db.image.create({
      data: {
        name: uniqueName,
        originalName: file.name,
        path: filePath,
        width,
        height,
        size,
        format,
        aspectRatio,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
