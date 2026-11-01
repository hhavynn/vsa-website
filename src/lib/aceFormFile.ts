/** Read a Google Sheets File → Download → CSV/TSV export locally. */
export const ACE_FORM_FILE_MAX_BYTES = 5 * 1024 * 1024;

export function aceFormFileProblem(file: Pick<File, 'name' | 'size'>): string | null {
  if (!/\.(csv|tsv)$/i.test(file.name)) {
    return 'Choose a .csv or .tsv file. For an Excel .xlsx file, export the Form Responses tab as CSV first.';
  }
  if (!file.size) return 'The selected file is empty.';
  if (file.size > ACE_FORM_FILE_MAX_BYTES) return 'This file is larger than 5 MB. Export the specific Form Responses tab only.';
  return null;
}

/** No network requests, persistence, uploads, logging, or auto-import writes. */
export function readAceFormFile(file: File): Promise<string> {
  const problem = aceFormFileProblem(file);
  if (problem) return Promise.reject(new Error(problem));
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result.replace(/^\uFEFF/, ''))
        : reject(new Error('Could not read the selected file as text.'));
    reader.onerror = () => reject(new Error('Could not read this file. Try exporting CSV again.'));
    reader.onabort = () => reject(new Error('File reading was interrupted.'));
    reader.readAsText(file, 'UTF-8');
  });
}
