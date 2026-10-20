import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import fs from 'node:fs/promises';

const BUCKET_NAME = 'uploads';

function resolveMimeType(file: File): string {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  return file.type || 'application/octet-stream';
}

function isAllowedFile(file: File): boolean {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
  ];
  const allowedExts = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const lower = file.name.toLowerCase();
  return allowedMimes.includes(file.type) || allowedExts.some((ext) => lower.endsWith(ext));
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawFolder = (formData.get('folder') as string) || 'files';
    const folder = rawFolder.replace(/\.\./g, '').replace(/^\/+|\/+$/g, '') || 'files';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!isAllowedFile(file)) {
      return NextResponse.json(
        { error: 'Only PDF (.pdf), Word (.doc, .docx), or signature image files are allowed.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const contentType = resolveMimeType(file);

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const storagePath = `${folder}/${timestamp}_${safeName}`;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        if (
          uploadError.message?.includes('Bucket not found') ||
          uploadError.message?.includes('does not exist')
        ) {
          await supabase.storage.createBucket(BUCKET_NAME, { public: true });
          const { error: retryError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, buffer, {
              contentType,
              upsert: true,
            });
          if (retryError) {
            return NextResponse.json({ error: retryError.message }, { status: 500 });
          }
        } else {
          return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      return NextResponse.json({ url: publicUrlData.publicUrl, path: storagePath });
    }

    // Clean local storage fallback when Supabase storage env vars are not configured
    const destDir = path.join(process.cwd(), 'public', 'uploads', folder);
    await fs.mkdir(destDir, { recursive: true });
    const filePath = path.join(destDir, `${timestamp}_${safeName}`);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      url: `/uploads/${storagePath}`,
      path: storagePath,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
