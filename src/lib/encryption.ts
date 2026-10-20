import { encryptPDF, AlreadyEncryptedError } from '@pdfsmaller/pdf-encrypt-lite';

export async function encryptPdfBuffer(pdfBuffer: Buffer, password: string): Promise<Buffer> {
  if (!password) return pdfBuffer;
  try {
    const encryptedBytes = await encryptPDF(new Uint8Array(pdfBuffer), password, password);
    return Buffer.from(encryptedBytes);
  } catch (err: any) {
    if (err instanceof AlreadyEncryptedError || err?.name === 'AlreadyEncryptedError') {
      return pdfBuffer;
    }
    throw err;
  }
}

export async function encryptWordBuffer(docxBuffer: Buffer, password: string): Promise<Buffer> {
  if (!password) return docxBuffer;
  const officeCryptoMod: any = await import('officecrypto-tool');
  const officeCrypto = officeCryptoMod.default || officeCryptoMod;
  try {
    if (officeCrypto.isEncrypted(docxBuffer)) {
      return docxBuffer;
    }
    const encrypted = await officeCrypto.encrypt(docxBuffer, { password });
    return Buffer.from(encrypted);
  } catch {
    // If file is legacy binary .doc rather than OOXML .docx, return raw buffer safely
    return docxBuffer;
  }
}
