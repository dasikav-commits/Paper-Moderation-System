import { prisma, ensureDbReady } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    await ensureDbReady();
    const body = await request.json();
    const { name, email, password, confirmPassword, department, contact } = body;

    if (!name?.trim() || !email?.trim() || !password || !department) {
      return NextResponse.json(
        { error: 'Full name, email, password, and department are required.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Please provide a valid university email address.' },
        { status: 400 }
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    const digitsOnlyContact = contact ? String(contact).replace(/\D/g, '') : '';
    if (contact && digitsOnlyContact.length !== 10) {
      return NextResponse.json(
        { error: 'Contact number must be exactly 10 digits.' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 400 }
      );
    }

    // Newly self-registered staff require HOD verification of Faculty Board approval before examiner assignment
    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        password,
        role: 'LECTURER',
        department,
        contact: digitsOnlyContact || null,
        facultyBoardApproved: false,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        email: created.email,
        isDepartmentHead: false,
        isLecturer: true,
        isModerator: true,
        facultyBoardApproved: created.facultyBoardApproved,
        department: created.department || department,
        contact: created.contact || '',
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
