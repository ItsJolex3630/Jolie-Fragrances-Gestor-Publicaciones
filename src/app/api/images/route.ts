import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'upload');

// Use Node.js runtime for file system access (not Edge)
export const runtime = 'nodejs';
// Allow dynamic rendering
export const dynamic = 'force-dynamic';

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
    // Try to parse form data with better error handling
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError) {
      console.error('Error parsing form data:', formError);
      return NextResponse.json(
        { error: 'No se pudo procesar el archivo. Intenta con una imagen más pequeña o formato diferente.' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    // Validate file type - accept empty type (clipboard images may not have MIME type)
    // We'll validate the actual image data with sharp later
    if (file.type && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: `El archivo "${file.name}" no es una imagen válida. Formatos aceptados: PNG, JPEG, WebP, GIF, etc.` },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `El archivo "${file.name}" excede el tamaño máximo de 50MB` },
        { status: 400 }
      );
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
    let metadata;
    try {
      metadata = await sharp(filePath).metadata();
    } catch (sharpError) {
      console.error('Error reading image metadata:', sharpError);
      // If sharp can't read the file, it might be corrupted
      return NextResponse.json(
        { error: `No se pudo leer la imagen "${file.name}". El archivo podría estar corrupto o en un formato no soportado.` },
        { status: 400 }
      );
    }

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
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al subir la imagen: ${errorMessage}` },
      { status: 500 }
    );
  }
}
