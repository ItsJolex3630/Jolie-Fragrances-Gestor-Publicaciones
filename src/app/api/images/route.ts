import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { imageSize } from 'image-size';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Upload directory: use /tmp on Vercel (read-only FS workaround), local upload dir otherwise
const UPLOAD_DIR = process.env.VERCEL === '1'
  ? path.join('/tmp', 'jolie-uploads')
  : (process.env.UPLOAD_DIR || path.join(process.cwd(), 'upload'));

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
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError) {
      console.error('Error parsing form data:', formError);
      return NextResponse.json(
        { error: 'No se pudo procesar el archivo.' },
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

    if (file.type && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: `El archivo "${file.name}" no es una imagen válida.` },
        { status: 400 }
      );
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `El archivo "${file.name}" excede el tamaño máximo de 50MB` },
        { status: 400 }
      );
    }

    // Read file into buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Get image dimensions using image-size (lightweight, no native deps)
    let width = 0;
    let height = 0;
    let format = '';
    try {
      const dims = imageSize(buffer);
      width = dims.width || 0;
      height = dims.height || 0;
      format = (dims.type as string) || path.extname(file.name).replace('.', '') || 'png';
    } catch (dimError) {
      console.error('Error reading image dimensions:', dimError);
      return NextResponse.json(
        { error: `No se pudo leer la imagen "${file.name}". Archivo corrupto o formato no soportado.` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = path.extname(file.name) || '.png';
    const uniqueName = `${uuidv4()}${ext}`;

    // Ensure upload directory exists and write file
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filePath = path.join(UPLOAD_DIR, uniqueName);
    await writeFile(filePath, buffer);

    const size = buffer.length;

    // Calculate aspect ratio
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const aspectRatio = `${width / divisor}:${height / divisor}`;

    const image = await db.image.create({
      data: {
        name: uniqueName,
        originalName: file.name,
        path: uniqueName,
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
