export type ImageUploadPreset =
  | 'avatar'
  | 'cabinet'
  | 'event'
  | 'galleryCover'
  | 'homepage'
  | 'house'
  | 'logo'
  | 'aceCover'
  | 'aceMember';

type CompressionOptions = {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  maxInputBytes: number;
  outputType: 'image/webp' | 'image/jpeg';
};

const MB = 1024 * 1024;

const PRESETS: Record<ImageUploadPreset, CompressionOptions> = {
  avatar: { maxWidth: 512, maxHeight: 512, quality: 0.78, maxInputBytes: 5 * MB, outputType: 'image/webp' },
  cabinet: { maxWidth: 900, maxHeight: 900, quality: 0.78, maxInputBytes: 8 * MB, outputType: 'image/webp' },
  event: { maxWidth: 1600, maxHeight: 1000, quality: 0.78, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  galleryCover: { maxWidth: 1400, maxHeight: 900, quality: 0.76, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  homepage: { maxWidth: 1200, maxHeight: 1600, quality: 0.78, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  house: { maxWidth: 1400, maxHeight: 1000, quality: 0.76, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  logo: { maxWidth: 512, maxHeight: 512, quality: 0.82, maxInputBytes: 5 * MB, outputType: 'image/webp' },
  aceCover: { maxWidth: 1200, maxHeight: 500, quality: 0.76, maxInputBytes: 8 * MB, outputType: 'image/webp' },
  aceMember: { maxWidth: 700, maxHeight: 700, quality: 0.78, maxInputBytes: 8 * MB, outputType: 'image/webp' },
};

function isRasterImage(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

function fileExtensionForMime(type: string) {
  if (type === 'image/webp') return 'webp';
  if (type === 'image/png') return 'png';
  if (type === 'image/svg+xml') return 'svg';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
}

function createImageBitmapFallback(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image.'));
    };
    image.src = url;
  });
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file);
  }
  return createImageBitmapFallback(file);
}

export async function prepareImageForUpload(file: File, preset: ImageUploadPreset): Promise<File> {
  const options = PRESETS[preset];

  if (file.size > options.maxInputBytes) {
    throw new Error(`Image is too large. Max upload size is ${Math.round(options.maxInputBytes / MB)} MB.`);
  }

  if (!isRasterImage(file)) {
    return file;
  }

  const image = await loadImage(file);
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const scale = Math.min(1, options.maxWidth / sourceWidth, options.maxHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not compress image.');
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, options.outputType, options.quality);
  });
  if (!blob) throw new Error('Could not compress image.');

  if ('close' in image && typeof image.close === 'function') {
    image.close();
  }

  const compressed = new File(
    [blob],
    `${file.name.replace(/\.[^.]+$/, '')}.${fileExtensionForMime(options.outputType)}`,
    { type: options.outputType, lastModified: Date.now() },
  );

  return compressed.size < file.size ? compressed : file;
}

export function getUploadExtension(file: File) {
  return fileExtensionForMime(file.type || '');
}

export function extractSupabasePublicObjectName(url: string | null | undefined, bucketId: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${bucketId}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}
