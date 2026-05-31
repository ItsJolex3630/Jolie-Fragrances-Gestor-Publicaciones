import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

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

export async function GET() {
  try {
    // Check if images already exist in the database
    const existingCount = await db.image.count();
    
    if (existingCount > 0) {
      return NextResponse.json({
        seeded: false,
        message: `Database already has ${existingCount} images`,
        count: existingCount,
      });
    }

    // Seed using pre-calculated metadata (fast, no image processing needed)
    try {
      const metadataPath = join(process.cwd(), 'public', 'images', 'metadata.json');
      
      if (!existsSync(metadataPath)) {
        return NextResponse.json({
          seeded: false,
          message: 'No metadata.json found in public/images/',
          count: 0,
        });
      }

      const metadataRaw = readFileSync(metadataPath, 'utf-8');
      const metadata: ImageMetadata[] = JSON.parse(metadataRaw);

      let seededCount = 0;

      for (const img of metadata) {
        try {
          const fileExt = extname(img.file) || `.${img.format || 'png'}`;
          const uniqueName = `${uuidv4()}${fileExt}`;

          await db.image.create({
            data: {
              name: uniqueName,
              originalName: img.originalName,
              data: null,
              filePath: `public/images/${img.file}`,
              mimeType: img.mimeType,
              width: img.width,
              height: img.height,
              size: img.size,
              format: img.format,
              aspectRatio: img.aspectRatio,
            },
          });

          seededCount++;
        } catch (imgErr) {
          console.error(`Error seeding ${img.file}:`, imgErr);
        }
      }

      return NextResponse.json({
        seeded: true,
        message: `Seeded ${seededCount} images from metadata`,
        count: seededCount,
      });
    } catch (seedError) {
      console.error('Error during seeding:', seedError);
      return NextResponse.json(
        { error: 'Failed to seed images', details: String(seedError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error initializing images:', error);
    return NextResponse.json(
      { error: 'Failed to initialize images' },
      { status: 500 }
    );
  }
}
