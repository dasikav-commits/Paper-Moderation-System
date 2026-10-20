'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/Toast';

export default function AddLecturerPage() {
  const router = useRouter();
  const { user, currentRole } = useAuth();
  const [error, setError] = useState('');
  const { showToast, ToastElement } = useToast();

  useEffect(() => {
    if (!user?.isDepartmentHead || currentRole !== 'department_head') {
      router.push('/dashboard');
    }
  }, [user, currentRole, router]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    contact: '',
    isLecturer: true,
    isModerator: true,
    isDepartmentHead: false,
    facultyBoardApproved: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    const digitsOnly = formData.contact.replace(/\D/g, '');
    if (formData.contact.trim() && digitsOnly.length !== 10) {
      setError('Contact number must be exactly 10 digits.');
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email: formData.email.trim(),
          contact: digitsOnly || null,
          department: user?.department || 'Department of Computing & Information Systems',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add lecturer');
        return;
      }

      showToast('Lecturer added successfully!', 'success');
      setTimeout(() => router.push('/department-head/lecturers'), 1200);
    } catch (e: any) {
      setError(e.message || 'An error occurred. Please try again.');
    }
  };

  return (
    <div className="p-8">
      {ToastElement}
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Dashboard
      </button>

      <div className="bg-white rounded-2xl shadow p-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add Academic Staff</h1>
            <p className="text-gray-600">Create a lecturer account and set Faculty Board approval status</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Dr. Jane Smith"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '');
                  if (digitsOnly.length <= 10) {
                    setFormData({ ...formData, contact: digitsOnly });
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 0711234567"
                maxLength={10}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. jane.smith@wayamba.lk"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="At least 6 characters"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 border-2 border-emerald-200 bg-emerald-50/70 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={formData.facultyBoardApproved}
                onChange={(e) =>
                  setFormData({ ...formData, facultyBoardApproved: e.target.checked })
                }
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <div>
                <div className="font-semibold text-gray-900">Approved by Faculty Board</div>
                <div className="text-sm text-gray-600">
                  Required before HOD can assign this staff member to examine or moderate courses
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDepartmentHead}
                onChange={(e) =>
                  setFormData({ ...formData, isDepartmentHead: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Department Head (HOD)</div>
                <div className="text-sm text-gray-500">Full administrative access</div>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium cursor-pointer"
            >
              Add Lecturer
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
