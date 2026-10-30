import { OptimizedImage } from "../../common/OptimizedImage";
import { cn } from "../../../lib/utils";

interface AvatarProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  avatarUrl?: string | null;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-24 h-24",
};

const sizePixels = { sm: 32, md: 48, lg: 96 };

function AvatarPlaceholder() {
  return (
    <svg
      data-testid="avatar-placeholder"
      className="h-1/2 w-1/2 text-text-muted"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Avatar({
  size = "md",
  className = "",
  avatarUrl,
}: AvatarProps) {
  const pixels = sizePixels[size];
  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          sizeClasses[size],
          "flex items-center justify-center overflow-hidden rounded-full bg-surface2",
        )}
      >
        {/* A removed or expired photo falls back to the silhouette, not a broken-image glyph. */}
        <OptimizedImage
          src={avatarUrl}
          alt=""
          width={pixels}
          height={pixels}
          className="h-full w-full object-cover"
          fallback={<AvatarPlaceholder />}
        />
      </div>
    </div>
  );
}
