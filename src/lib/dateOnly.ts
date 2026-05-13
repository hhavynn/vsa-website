const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export function toDateOnlyString(value: string | null | undefined): string {
  if (!value) return '';

  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return '';
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseDateOnlyAsLocalDate(value: string | null | undefined): Date | null {
  const dateOnly = toDateOnlyString(value);
  if (!dateOnly) return null;

  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateOnly(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  const date = parseDateOnlyAsLocalDate(value);
  return date ? new Intl.DateTimeFormat('en-US', options).format(date) : '';
}
