import { parseCsvRecords } from './csvParse';

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

/**
 * Refuses a file that would otherwise read as a clean, shorter roster: an open
 * quote swallows every later row, and a non-UTF-8 export mangles names.
 */
export function aceFormFileContentProblem(text: string): string | null {
  if (text.includes('\uFFFD')) {
    return 'This file is not UTF-8, so names would be garbled. Export it again as CSV UTF-8 or from Google Sheets.';
  }
  const firstLine = text.split(/\r\n|\r|\n/).find((line) => line.trim().length > 0) ?? '';
  const table = parseCsvRecords(text, firstLine.includes('\t') ? '\t' : ',');
  if (table.unterminatedQuote) {
    return `A quotation mark on line ${table.unterminatedQuoteLine} never closes, so later rows would be lost. Fix that cell and export again.`;
  }
  return null;
}

/** No network requests, persistence, uploads, logging, or auto-import writes. */
export function readAceFormFile(file: File): Promise<string> {
  const problem = aceFormFileProblem(file);
  if (problem) return Promise.reject(new Error(problem));
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read the selected file as text.'));
        return;
      }
      const text = reader.result.replace(/^\uFEFF/, '');
      const contentProblem = aceFormFileContentProblem(text);
      if (contentProblem) reject(new Error(contentProblem));
      else resolve(text);
    };
    reader.onerror = () => reject(new Error('Could not read this file. Try exporting CSV again.'));
    reader.onabort = () => reject(new Error('File reading was interrupted.'));
    reader.readAsText(file, 'UTF-8');
  });
}
