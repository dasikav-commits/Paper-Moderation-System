import { prisma, ensureDbReady } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const normalizeDept = (d: string) =>
  d.toLowerCase().replace(/and/g, '&').replace(/\s+/g, ' ').trim();

export async function GET(request: Request) {
  try {
    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    const allUsers = await prisma.user.findMany({
      orderBy: { name: 'asc' },
    });

    const filtered = department
      ? allUsers.filter((u) => normalizeDept(u.department || '') === normalizeDept(department))
      : allUsers;

    return NextResponse.json(filtered);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbReady();
    const body = await request.json();
    const { name, email, password, department, isDepartmentHead, contact, facultyBoardApproved } =
      body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const digitsOnlyContact = contact ? String(contact).replace(/\D/g, '') : '';
    if (contact && digitsOnlyContact.length !== 10) {
      return NextResponse.json(
        { error: 'Contact number must be exactly 10 digits' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    const role = isDepartmentHead ? 'DEPARTMENT_HEAD' : 'LECTURER';

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        password,
        department: department || 'Department of Computing & Information Systems',
        role,
        contact: digitsOnlyContact || null,
        facultyBoardApproved:
          facultyBoardApproved !== undefined ? Boolean(facultyBoardApproved) : true,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
