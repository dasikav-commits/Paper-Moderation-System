/**
 * Returns true if the URL is accessible either externally (Supabase Storage)
 * or via an internal app route (/api/... or /uploads/...).
 */
export function isAccessibleUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('/mock/')) return false;
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('/api/') ||
    url.startsWith('/uploads/')
  );
}

export const PDF_ACCEPT = '.pdf,application/pdf';
export const WORD_ACCEPT =
  '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function isValidPdfFile(file: File | null | undefined): boolean {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || name.endsWith('.pdf');
}

export function isValidWordFile(file: File | null | undefined): boolean {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export async function uploadDocumentFile(file: File, folder: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    let message = 'File upload failed';
    try {
      const errData = await res.json();
      if (errData?.error) message = errData.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  const data = await res.json();
  return data.url;
}
