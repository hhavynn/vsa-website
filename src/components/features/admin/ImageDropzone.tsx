import { useCallback, useEffect, useRef, useState } from 'react';
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
  /**
   * Called with the picked file **immediately** (previewUrl is the current preview, or
   * null), then again with the same file and its data-URL preview once that has been
   * read. Forms must record the file on the first call: reading a large image can take
   * a while and Submit must not be able to run in between with no file recorded.
   */
  onSelect: (file: File, previewUrl: string | null) => void;
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

  // Only the most recent selection may deliver a preview. Every new pick, clear and
  // unmount bumps the generation and aborts the in-flight read, and a finished read
  // also checks that the form still holds the file it was reading, so a slow read of
  // file A can never revert the form to A after B was chosen, or resurrect a cleared image.
  const generation = useRef(0);
  const activeReader = useRef<FileReader | null>(null);
  const currentFile = useRef(file);
  currentFile.current = file;

  const cancelRead = useCallback(() => {
    generation.current += 1;
    activeReader.current?.abort();
    activeReader.current = null;
  }, []);

  useEffect(() => cancelRead, [cancelRead]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const picked = accepted[0];
      if (!picked) return;
      setProblems([]);
      cancelRead();
      const mine = generation.current;
      onSelect(picked, previewUrl ?? null);
      const reader = new FileReader();
      activeReader.current = reader;
      reader.onload = () => {
        if (generation.current !== mine) return;
        // `file` is optional; when the form tracks it, it must still be this file.
        if (currentFile.current !== undefined && currentFile.current !== picked) return;
        activeReader.current = null;
        onSelect(picked, reader.result as string);
      };
      reader.readAsDataURL(picked);
    },
    [onSelect, previewUrl, cancelRead],
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
            cancelRead();
            onClear();
          }}
        >
          Remove image
        </button>
      )}
    </div>
  );
}
