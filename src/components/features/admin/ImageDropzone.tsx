import { useCallback, useState } from 'react';
import { FileRejection, useDropzone } from 'react-dropzone';
import {
  describeUploadRejection,
  formatBytes,
  getPresetLimits,
  ImageUploadPreset,
} from '../../../lib/imageUpload';

interface ImageDropzoneProps {
  /** Same preset the page passes to `prepareImageForUpload`; drives the size limit and the help text. */
  preset: ImageUploadPreset;
  /** Preview of the chosen file (data URL) or of the image already saved. */
  previewUrl?: string | null;
  /** Name and size of the picked file, shown under the preview. */
  file?: File | null;
  /** Called with the picked file and a data-URL preview of it. */
  onSelect: (file: File, previewUrl: string) => void;
  /** Shows a "Remove image" button when provided and there is something to remove. */
  onClear?: () => void;
  /** Also accept SVG (uploaded as-is, never resized). Only for the site logo. */
  allowSvg?: boolean;
  prompt?: string;
  previewAlt?: string;
  className?: string;
}

/**
 * The one image picker for admin forms: drag-and-drop or click, a preview,
 * the file's name and size, what will happen to it on upload, and a visible
 * reason when a file is refused (previously most forms dropped bad files in
 * silence). Compression and upload stay in `prepareImageForUpload` and the
 * page's own storage code.
 */
export function ImageDropzone({
  preset,
  previewUrl,
  file,
  onSelect,
  onClear,
  allowSvg = false,
  prompt = 'Drag and drop or click to upload',
  previewAlt = 'Preview',
  className = '',
}: ImageDropzoneProps) {
  const { maxWidth, maxHeight, maxInputBytes } = getPresetLimits(preset);
  const [problems, setProblems] = useState<string[]>([]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const picked = accepted[0];
      if (!picked) return;
      setProblems([]);
      const reader = new FileReader();
      reader.onload = () => onSelect(picked, reader.result as string);
      reader.readAsDataURL(picked);
    },
    [onSelect],
  );

  const onDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      setProblems(rejections.slice(0, 3).map((rejection) => describeUploadRejection(rejection, preset)));
    },
    [preset],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { 'image/*': allowSvg ? ['.png', '.jpg', '.jpeg', '.webp', '.svg'] : ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    maxSize: maxInputBytes,
  });

  const hasImage = Boolean(previewUrl);

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 transition-colors ${
          isDragActive
            ? 'border-[var(--brand)] bg-[var(--brand)]/5'
            : 'border-[var(--color-border)] hover:bg-[var(--color-surface2)]'
        }`}
      >
        <input {...getInputProps()} data-testid="image-dropzone-input" />
        {previewUrl ? (
          <img src={previewUrl} alt={previewAlt} className="max-h-48 rounded object-cover shadow-sm" />
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-text3)' }}>
            {prompt}
          </p>
        )}
        <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text3)' }}>
          {allowSvg ? 'JPG, PNG, WebP or SVG' : 'JPG, PNG or WebP'}, up to {formatBytes(maxInputBytes)}. Resized to fit {maxWidth}×{maxHeight} and saved as WebP before upload
          {allowSvg ? ' (SVG is uploaded as-is).' : '.'}
        </p>
      </div>

      {file && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-text2)' }}>
          {file.name} · {formatBytes(file.size)}
        </p>
      )}

      {problems.length > 0 && (
        <ul role="alert" className="mt-2 space-y-1 text-xs font-medium text-red-600 dark:text-red-400">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {onClear && hasImage && (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600"
          onClick={() => {
            setProblems([]);
            onClear();
          }}
        >
          Remove image
        </button>
      )}
    </div>
  );
}
