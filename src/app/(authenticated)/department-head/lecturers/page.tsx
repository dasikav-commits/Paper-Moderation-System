'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  User,
  Mail,
  Phone,
  ShieldCheck,
  ShieldAlert,
  X,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';

interface LecturerDetail {
  id: string;
  name: string;
  email: string;
  contact: string;
  department: string;
  role: string;
  facultyBoardApproved: boolean;
}

export default function LecturerDetailsPage() {
  const router = useRouter();
  const { user, currentRole } = useAuth();
  const { showToast, ToastElement } = useToast();

  const [lecturers, setLecturers] = useState<LecturerDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingLecturer, setEditingLecturer] = useState<LecturerDetail | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    contact: '',
    isDepartmentHead: false,
    facultyBoardApproved: true,
  });
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLecturers = async () => {
    if (!user) return;
    try {
      const dept = user.department || 'Department of Computing & Information Systems';
      const res = await fetch(`/api/users?department=${encodeURIComponent(dept)}`);
      if (res.ok) {
        const data = await res.json();
        setLecturers(
          data.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            contact: u.contact || '',
            department: u.department || 'Department of Computing & Information Systems',
            role: u.role || 'LECTURER',
            facultyBoardApproved: u.facultyBoardApproved !== false,
          }))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.isDepartmentHead || currentRole !== 'department_head') {
      router.push('/dashboard');
      return;
    }
    fetchLecturers();
  }, [user, currentRole, router]);

  const toggleFacultyBoardApproval = async (lecturer: LecturerDetail) => {
    const nextApproved = !lecturer.facultyBoardApproved;
    try {
      const res = await fetch(`/api/users/${lecturer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facultyBoardApproved: nextApproved }),
      });
      if (res.ok) {
        showToast(
          nextApproved
            ? `${lecturer.name} marked as Approved by the Faculty Board.`
            : `${lecturer.name} removed from Faculty Board approved list.`,
          'success'
        );
        fetchLecturers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openEditModal = (lecturer: LecturerDetail) => {
    setEditingLecturer(lecturer);
    setEditFormData({
      name: lecturer.name,
      email: lecturer.email,
      contact: lecturer.contact,
      isDepartmentHead: lecturer.role === 'DEPARTMENT_HEAD',
      facultyBoardApproved: lecturer.facultyBoardApproved,
    });
    setEditError('');
  };

  const closeEditModal = () => {
    setEditingLecturer(null);
    setEditError('');
  };

  const handleSaveLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLecturer) return;
    setEditError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editFormData.email.trim())) {
      setEditError('Please enter a valid email address.');
      return;
    }

    const digitsOnly = editFormData.contact.replace(/\D/g, '');
    if (editFormData.contact.trim() && digitsOnly.length !== 10) {
      setEditError('Contact number must be exactly 10 digits.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/users/${editingLecturer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name.trim(),
          email: editFormData.email.trim(),
          contact: digitsOnly || null,
          role: editFormData.isDepartmentHead ? 'DEPARTMENT_HEAD' : 'LECTURER',
          facultyBoardApproved: editFormData.facultyBoardApproved,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setEditError(errorData.error || 'Failed to update lecturer');
        return;
      }

      showToast('Lecturer details & Faculty Board approval updated!', 'success');
      closeEditModal();
      fetchLecturers();
    } catch (e: any) {
      setEditError(e.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const deleteLecturer = async (lecturerId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this lecturer? All their assigned subjects will be unassigned.'
      )
    ) {
      return;
    }
    try {
      const response = await fetch(`/api/users/${lecturerId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        showToast('Lecturer deleted successfully.', 'info');
        fetchLecturers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading lecturer details...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {ToastElement}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-gray-500">Department Head</p>
          <h1 className="text-3xl font-bold text-gray-900">
            Lecturers &amp; Faculty Board Approval
          </h1>
          <p className="text-gray-600 mt-2">
            Verify Faculty Board approval status before assigning First Examiners, Lecturers, and Moderators.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <Link
            href="/add-lecturer"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <User className="w-4 h-4" />
            Add Lecturer
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow p-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Faculty Board Status
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Portal Role
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {lecturers.map((lecturer) => (
              <tr key={lecturer.id} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-blue-600 shrink-0" />
                    <span className="font-medium text-gray-900">{lecturer.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-gray-700">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{lecturer.email}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-gray-700 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{lecturer.contact || '—'}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => toggleFacultyBoardApproval(lecturer)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${
                      lecturer.facultyBoardApproved
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    }`}
                    title="Click to toggle Faculty Board approval status"
                  >
                    {lecturer.facultyBoardApproved ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Approved by Faculty Board
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                        Pending Approval (Click to Approve)
                      </>
                    )}
                  </button>
                </td>
                <td className="px-5 py-4 text-gray-700">
                  {lecturer.role === 'DEPARTMENT_HEAD' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Department Head
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                      Examiner / Moderator
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 space-x-2 text-sm whitespace-nowrap">
                  <button
                    onClick={() => openEditModal(lecturer)}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => deleteLecturer(lecturer.id)}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Lecturer Modal */}
      {editingLecturer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 relative my-8">
            <button
              onClick={closeEditModal}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Edit2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Edit Lecturer &amp; Approval</h2>
                <p className="text-gray-600">
                  Update staff contact information, Faculty Board approval, and role
                </p>
              </div>
            </div>

            {editError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveLecturer} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={editFormData.contact}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '');
                      if (digitsOnly.length <= 10) {
                        setEditFormData({ ...editFormData, contact: digitsOnly });
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0711234567"
                    maxLength={10}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border-2 border-emerald-200 bg-emerald-50/60 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.facultyBoardApproved}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        facultyBoardApproved: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Approved by Faculty Board</div>
                    <div className="text-sm text-gray-600">
                      Allows HOD to assign this staff member as First Examiner, Lecturer, or Moderator
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.isDepartmentHead}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, isDepartmentHead: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Department Head (HOD)</div>
                    <div className="text-sm text-gray-500">
                      Grants full HOD administrative &amp; finalized paper access
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
