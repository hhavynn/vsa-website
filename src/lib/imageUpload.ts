export type ImageUploadPreset =
  | 'avatar'
  | 'cabinet'
  | 'cabinetThumbnail'
  | 'event'
  | 'eventThumbnail'
  | 'galleryCover'
  | 'galleryCoverThumbnail'
  | 'homepage'
  | 'homepageThumbnail'
  | 'house'
  | 'houseThumbnail'
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
  cabinetThumbnail: { maxWidth: 420, maxHeight: 420, quality: 0.76, maxInputBytes: 8 * MB, outputType: 'image/webp' },
  event: { maxWidth: 1200, maxHeight: 1200, quality: 0.78, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  eventThumbnail: { maxWidth: 720, maxHeight: 720, quality: 0.74, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  galleryCover: { maxWidth: 1400, maxHeight: 900, quality: 0.76, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  galleryCoverThumbnail: { maxWidth: 720, maxHeight: 480, quality: 0.74, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  homepage: { maxWidth: 1200, maxHeight: 1600, quality: 0.78, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  homepageThumbnail: { maxWidth: 520, maxHeight: 700, quality: 0.76, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  house: { maxWidth: 1400, maxHeight: 1000, quality: 0.76, maxInputBytes: 10 * MB, outputType: 'image/webp' },
  houseThumbnail: { maxWidth: 640, maxHeight: 480, quality: 0.74, maxInputBytes: 10 * MB, outputType: 'image/webp' },
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

function canvasToBlob(canvas: HTMLCanvasElement, type: CompressionOptions['outputType'], quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

export type PreparedFile = {
  file: File;
  originalSize: number;
  compressedSize: number;
  reduction: number;
  wasCompressed: boolean;
};

export async function prepareImageForUpload(file: File, preset: ImageUploadPreset): Promise<PreparedFile> {
  const options = PRESETS[preset];
  const originalSize = file.size;

  const result: PreparedFile = {
    file,
    originalSize,
    compressedSize: originalSize,
    reduction: 0,
    wasCompressed: false,
  };

  if (file.size > options.maxInputBytes) {
    throw new Error(`Image is too large. Max upload size is ${Math.round(options.maxInputBytes / MB)} MB.`);
  }

  if (!isRasterImage(file)) {
    return result;
  }

  try {
    const image = await loadImage(file);
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    
    // Calculate new dimensions
    const scale = Math.min(1, options.maxWidth / sourceWidth, options.maxHeight / sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context.');
    
    context.drawImage(image, 0, 0, width, height);

    let outputType = options.outputType;
    let blob = await canvasToBlob(canvas, outputType, options.quality);
    if (!blob && options.outputType === 'image/webp') {
      outputType = 'image/jpeg';
      blob = await canvasToBlob(canvas, outputType, options.quality);
    }

    if ('close' in image && typeof image.close === 'function') {
      image.close();
    }

    if (!blob) throw new Error('Could not generate blob.');

    // Only use compressed if it's actually smaller
    if (blob.size < file.size) {
      const compressedFile = new File(
        [blob],
        `${file.name.replace(/\.[^.]+$/, '')}.${fileExtensionForMime(outputType)}`,
        { type: outputType, lastModified: Date.now() },
      );

      return {
        file: compressedFile,
        originalSize,
        compressedSize: blob.size,
        reduction: Math.round(((originalSize - blob.size) / originalSize) * 100),
        wasCompressed: true,
      };
    }

    return result;
  } catch (err) {
    console.warn('Image compression failed, uploading original:', err);
    return result;
  }
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
