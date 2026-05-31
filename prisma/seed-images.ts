import { PrismaClient } from '@prisma/client';
import { imageSize } from 'image-size';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

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

// Map filename to display name
const DISPLAY_NAMES: Record<string, string> = {
  'eclaire.png': 'Eclaire',
  'his-confesion.png': 'His Confesion',
  'man-black-1.png': 'Man Black',
  'vanilla-freak.png': 'Vanilla Freak',
  'victoria.png': 'Victoria',
  'whipped.png': 'Whipped',
  'whipped-pleasure.png': 'Whipped Pleasure',
  'yara.png': 'Yara',
};

const IMAGES_DIR = join(process.cwd(), 'public', 'images');

async function main() {
  console.log('Seeding images from public/images/...');

  // Check if images already exist
  const existingCount = await prisma.image.count();
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} images. Skipping seed.`);
    return;
  }

  // Read all image files from public/images/
  const files = readdirSync(IMAGES_DIR).filter((file) => {
    const ext = extname(file).toLowerCase().replace('.', '');
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'tiff', 'avif'].includes(ext);
  });

  console.log(`Found ${files.length} images to seed.`);

  for (const file of files) {
    const filePath = join(IMAGES_DIR, file);
    const fileBuffer = readFileSync(filePath);
    const fileStats = statSync(filePath);

    // Get image dimensions
    let width = 0;
    let height = 0;
    let format = '';
    try {
      const dims = imageSize(fileBuffer);
      width = dims.width || 0;
      height = dims.height || 0;
      format = (dims.type as string) || extname(file).replace('.', '') || 'png';
    } catch (err) {
      console.error(`Error reading dimensions for ${file}:`, err);
      continue;
    }

    const ext = extname(file).replace('.', '').toLowerCase();
    const mimeType = MIME_TYPES[ext] || MIME_TYPES[format] || 'image/png';

    // Calculate aspect ratio
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const aspectRatio = `${width / divisor}:${height / divisor}`;

    const fileExt = extname(file) || `.${format || 'png'}`;
    const uniqueName = `${uuidv4()}${fileExt}`;

    // Get display name
    const displayName = DISPLAY_NAMES[file] || file.replace(/\.[^/.]+$/, '');

    // Store with filePath pointing to the static file (no BLOB needed)
    const image = await prisma.image.create({
      data: {
        name: uniqueName,
        originalName: `${displayName}${fileExt}`,
        data: null,
        filePath: `public/images/${file}`,
        mimeType,
        width,
        height,
        size: fileStats.size,
        format: format || ext,
        aspectRatio,
      },
    });

    console.log(`Seeded: ${displayName} (${file}) -> ${width}x${height}, ${aspectRatio}, ${format}, ${formatFileSize(fileStats.size)}`);
  }

  console.log('Seed complete!');
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
