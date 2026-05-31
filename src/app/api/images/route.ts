import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { imageSize } from 'image-size';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

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

interface ImageMetadata {
  file: string;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  format: string;
  aspectRatio: string;
}

// Helper: load images from metadata.json when DB is empty/unavailable
function loadFromMetadata(): Array<Record<string, unknown>> {
  try {
    const metadataPath = path.join(process.cwd(), 'public', 'images', 'metadata.json');
    if (!existsSync(metadataPath)) return [];

    const raw = readFileSync(metadataPath, 'utf-8');
    const metadata: ImageMetadata[] = JSON.parse(raw);

    return metadata.map((img) => ({
      id: `static-${img.file.replace(/\.[^/.]+$/, '')}`,
      name: img.file,
      originalName: img.originalName,
      mimeType: img.mimeType,
      width: img.width,
      height: img.height,
      size: img.size,
      format: img.format,
      aspectRatio: img.aspectRatio,
      filePath: `public/images/${img.file}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'newest';

    // Always start with static images from metadata.json (these are always available)
    const staticImages = loadFromMetadata();

    // Try to also get DB images (user-edited/created images)
    let dbImages: Array<Record<string, unknown>> = [];
    try {
      const dbResult = await db.image.findMany({
        orderBy: { createdAt: 'desc' },
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
          filePath: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      dbImages = dbResult as Array<Record<string, unknown>>;
    } catch (dbError) {
      console.error('DB query failed, using metadata only:', dbError);
    }

    // Merge: start with static images, then add DB images that aren't already covered
    const staticFileNames = new Set(staticImages.map((img) => String(img.name)));
    const extraDbImages = dbImages.filter((img) => {
      // Include DB images that have filePath pointing to static files already covered
      const fp = String(img.filePath || '');
      if (fp.startsWith('public/images/')) {
        const fileName = fp.replace('public/images/', '');
        if (staticFileNames.has(fileName)) return false; // Already in static list
      }
      return true; // This is a user-created/edited image not in static list
    });

    // Combine: static images first, then extra DB images
    let images = [...staticImages, ...extraDbImages];

    // Apply sort (client-side does this too, but API should be consistent)
    images.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(String(a.createdAt)).getTime() - new Date(String(b.createdAt)).getTime();
        case 'name':
          return String(a.originalName).localeCompare(String(b.originalName));
        case 'size_asc':
          return Number(a.size) - Number(b.size);
        case 'size_desc':
          return Number(b.size) - Number(a.size);
        case 'newest':
        default:
          return new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime();
      }
    });

    return NextResponse.json(images);
  } catch (error) {
    console.error('Error listing images:', error);
    // Last resort: try metadata.json
    const fallback = loadFromMetadata();
    if (fallback.length > 0) {
      return NextResponse.json(fallback);
    }
    return NextResponse.json(
      { error: 'Failed to list images' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // API key protection - only admin can upload
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    const validApiKey = process.env.ADMIN_API_KEY || 'jolie-admin-2024';
    if (apiKey !== validApiKey) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere API key válida.' },
        { status: 401 }
      );
    }

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

    // Accept empty MIME type (clipboard images) but validate if present
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

    // Determine MIME type
    const ext = path.extname(file.name).replace('.', '') || format;
    const mimeType = file.type || MIME_TYPES[ext.toLowerCase()] || MIME_TYPES[format.toLowerCase()] || 'image/png';

    // Generate unique filename
    const fileExt = path.extname(file.name) || `.${format || 'png'}`;
    const uniqueName = `${uuidv4()}${fileExt}`;

    const size = buffer.length;

    // Calculate aspect ratio
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const aspectRatio = `${width / divisor}:${height / divisor}`;

    // Store image data directly in the database (no filesystem)
    const image = await db.image.create({
      data: {
        name: uniqueName,
        originalName: file.name || `clipboard-image.${fileExt.replace('.', '')}`,
        data: buffer,
        filePath: null,
        mimeType,
        width,
        height,
        size,
        format,
        aspectRatio,
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
        filePath: true,
        createdAt: true,
        updatedAt: true,
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
