import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import path from 'path';

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

    // Fetch all images from database
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

    // Create a zip file
    const zip = new JSZip();

    // Track used filenames to avoid duplicates
    const usedNames = new Set<string>();

    for (const image of images) {
      try {
        const fileBuffer = await readFile(image.path);

        // Generate a unique name within the zip
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
        // Skip files that can't be read
      }
    }

    // Generate the zip buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Return the zip file as download
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
