import { ChangeEvent, useRef, useState } from "react";
import toast from "react-hot-toast";
import { toUserMessage } from "../../../data/errors";
import {
  getSafeLogoUrl,
  isAcceptedSchoolLogoType,
} from "../../../lib/uvsaSchoolLogos";
import { Button } from "../../ui/Button";
import { SchoolVisualMark } from "../uvsa/SchoolVisualMark";

interface SchoolLogoFieldProps {
  school: { slug: string; short_name: string };
  value: string;
  onChange: (url: string) => void;
  /** Compresses + uploads the file and resolves to its public URL. */
  onUpload: (file: File) => Promise<string>;
}

const labelCls =
  "block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary";
const inputCls =
  "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";

/**
 * Logo / Instagram PFP editor: live preview, Upload Image, paste-a-URL, Remove.
 * Writes only to the form's `logo_url`; nothing is public until the school is saved.
 */
export function SchoolLogoField({
  school,
  value,
  onChange,
  onUpload,
}: SchoolLogoFieldProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const hasValue = value.trim().length > 0;
  const isUnsafe = hasValue && !getSafeLogoUrl(value);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isAcceptedSchoolLogoType(file)) {
      toast.error("Logo must be a PNG, JPG, or WebP image.");
      return;
    }

    setUploading(true);
    try {
      onChange(await onUpload(file));
      toast.success("Logo uploaded. Save the school to publish it.");
    } catch (error) {
      toast.error(toUserMessage(error, "Unable to upload logo"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <fieldset className="rounded-md border border-border bg-surface2 p-4 md:col-span-2">
      <legend className={`${labelCls} px-1`}>
        School Logo / Instagram PFP
      </legend>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <SchoolVisualMark
          school={{ ...school, logo_url: value }}
          size="lg"
          interactive={false}
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              loading={uploading}
              onClick={() => fileInput.current?.click()}
            >
              Upload Image
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasValue || uploading}
              onClick={() => onChange("")}
            >
              Remove
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label="Upload school logo file"
              onChange={handleFile}
            />
          </div>

          <label className="block">
            <span className={labelCls}>Or paste image URL</span>
            <input
              type="url"
              className={inputCls}
              value={value}
              placeholder="https://…"
              onChange={(event) => onChange(event.target.value)}
            />
          </label>

          {isUnsafe ? (
            <p
              role="alert"
              className="text-xs font-medium text-red-700 dark:text-red-400"
            >
              This URL can’t be shown publicly. Use an https image link or
              upload a file instead.
            </p>
          ) : (
            <p className="text-xs text-text-secondary">
              Square images work best (an Instagram profile picture is perfect).
              PNG, JPG, or WebP — resized automatically. Not live until you save
              the school.
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}
