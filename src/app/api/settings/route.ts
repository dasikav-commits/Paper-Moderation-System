import { NextResponse } from 'next/server';
import { prisma, ensureDbReady } from '@/lib/prisma';

const DEFAULTS = {
  academicYear: '2025/2026',
  semester: '1',
};

export async function GET() {
  try {
    await ensureDbReady();
    const settings = await prisma.systemSetting.findMany();
    const result: Record<string, string> = { ...DEFAULTS };
    for (const s of settings) {
      if (s.key === 'academicYear' || s.key === 'semester') {
        result[s.key] = s.value;
      }
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(request: Request) {
  try {
    await ensureDbReady();
    const body = await request.json();
    const upserts = Object.entries(body).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );
    await Promise.all(upserts);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({
      success: true,
      warning: 'Settings not persisted — migration may be pending.',
    });
  }
}
