// The public leaderboard's no-photo avatar: first + last initial on a pastel
// circle whose hue is derived from the name, so a member keeps the same color
// everywhere (DOM avatars and canvas-rendered share graphics alike).

export function getAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : (parts[0]?.[0] ?? '?').toUpperCase();
}

export function getInitialsAvatarColors(name: string): { background: string; foreground: string } {
  const hue = (name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 137) % 360;
  return {
    background: `hsl(${hue},45%,88%)`,
    foreground: `hsl(${hue},55%,38%)`,
  };
}
