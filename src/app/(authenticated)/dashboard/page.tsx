'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { Plus, Edit2, Calendar, Check, X, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/Toast';

// Generate a range of years: 10 years back to 10 years ahead from current year
function generateYears() {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 10; y <= currentYear + 10; y++) {
    years.push(y);
  }
  return years;
}

const YEAR_OPTIONS = generateYears();

export default function DepartmentHeadDashboard() {
  const router = useRouter();
  const { user, currentRole } = useAuth();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentYear, setCurrentYear] = useState('');
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear());
  const [currentSemester, setCurrentSemester] = useState(1);
  const [isEditingAcademic, setIsEditingAcademic] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastElement } = useToast();

  // Individual editing state for subject assignment (row-by-row)
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editAssignmentForm, setEditAssignmentForm] = useState<{ lecturerId: string; moderatorId: string }>({
    lecturerId: '',
    moderatorId: '',
  });
  const [savingAssignment, setSavingAssignment] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    try {
      const dept = user.department || 'Department of Computing & Information Systems';
      const [subjectsRes, usersRes, settingsRes] = await Promise.all([
        fetch(`/api/subjects?department=${encodeURIComponent(dept)}`),
        fetch(`/api/users?department=${encodeURIComponent(dept)}`),
        fetch('/api/settings'),
      ]);

      if (subjectsRes.ok && usersRes.ok) {
        const subjectsData = await subjectsRes.json();
        const usersData = await usersRes.json();
        setSubjects(subjectsData);
        setUsers(usersData);

        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          const year = settings.academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
          const sem = Number(settings.semester || 1);
          setCurrentYear(year);
          setStartYear(Number(year.split('/')[0]) || new Date().getFullYear());
          setCurrentSemester(sem);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.isDepartmentHead || currentRole !== 'department_head') {
      router.push('/lecturer/dashboard');
      return;
    }
    fetchData();
  }, [user, currentRole, router]);

  // Start editing a single subject assignment row
  const handleStartEditAssignment = (subject: any) => {
    setEditingSubjectId(subject.id);
    setEditAssignmentForm({
      lecturerId: subject.lecturerId || '',
      moderatorId: subject.moderatorId || '',
    });
  };

  // Cancel editing single subject assignment row
  const handleCancelEditAssignment = () => {
    setEditingSubjectId(null);
    setEditAssignmentForm({ lecturerId: '', moderatorId: '' });
  };

  // Save single subject assignment row
  const handleSaveSingleAssignment = async (subjectId: string) => {
    setSavingAssignment(true);
    try {
      const res = await fetch(`/api/subjects/${subjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecturerId: editAssignmentForm.lecturerId || null,
          moderatorId: editAssignmentForm.moderatorId || null,
          academicYear: currentYear,
        }),
      });

      if (res.ok) {
        showToast('Subject assignment updated successfully!', 'success');
        setEditingSubjectId(null);
        await fetchData();
      } else {
        showToast('Failed to save subject assignment.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to save subject assignment.', 'error');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleSaveAcademicSettings = async () => {
    if (isEditingAcademic) {
      try {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            academicYear: currentYear,
            semester: currentSemester,
          }),
        });
      } catch (e) {
        console.error('Failed to save academic settings:', e);
      }
    }
    setIsEditingAcademic(!isEditingAcademic);
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {ToastElement}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Department Head Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage subjects, lecturers, and moderators</p>
      </div>

      <RoleSwitcher />

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Academic Settings</h2>
          <button
            onClick={handleSaveAcademicSettings}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            {isEditingAcademic ? 'Save' : 'Change'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Academic Year</label>
            {isEditingAcademic ? (
              <div className="flex items-center gap-2">
                <select
                  value={startYear}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setStartYear(y);
                    setCurrentYear(`${y}/${y + 1}`);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <span className="text-gray-500 font-bold text-lg">/</span>
                <div className="flex-1 px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-center font-medium text-gray-600">
                  {startYear + 1}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-500" />
                <span className="font-medium">{currentYear}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Semester</label>
            {isEditingAcademic ? (
              <select
                value={currentSemester}
                onChange={(e) => setCurrentSemester(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
              </select>
            ) : (
              <div className="px-4 py-2 bg-gray-50 rounded-lg">
                <span className="font-medium">Semester {currentSemester}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Subject Assignments</h2>
              <p className="text-sm text-gray-500 mt-1">
                Assign academic staff members to lecture and moderate courses.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/add-subject"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Subject
              </Link>
              <Link
                href="/add-lecturer"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Lecturer
              </Link>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lecturer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Moderator
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => {
                const filteredSubjects = subjects.filter(
                  (s) => s.semester === currentSemester
                );
                
                if (filteredSubjects.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium bg-white">
                        No subjects found for Semester {currentSemester}.
                      </td>
                    </tr>
                  );
                }

                return filteredSubjects.map((subject) => {
                  const isEditingRow = editingSubjectId === subject.id;

                  return (
                    <tr key={subject.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                        {subject.code}
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-medium">{subject.name}</td>
                      
                      {/* Lecturer Column */}
                      <td className="px-6 py-4">
                        {isEditingRow ? (
                          <select
                            value={editAssignmentForm.lecturerId}
                            onChange={(e) => setEditAssignmentForm((prev) => ({ ...prev, lecturerId: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                          >
                            <option value="">Select Lecturer</option>
                            {users.map((lecturer) => (
                              <option key={lecturer.id} value={lecturer.id}>
                                {lecturer.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            {subject.lecturer?.name ? (
                              <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                                {subject.lecturer.name}
                              </span>
                            ) : (
                              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Unassigned
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Moderator Column */}
                      <td className="px-6 py-4">
                        {isEditingRow ? (
                          <select
                            value={editAssignmentForm.moderatorId}
                            onChange={(e) => setEditAssignmentForm((prev) => ({ ...prev, moderatorId: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                          >
                            <option value="">Select Moderator</option>
                            {users.map((moderator) => (
                              <option key={moderator.id} value={moderator.id}>
                                {moderator.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            {subject.moderator?.name ? (
                              <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
                                {subject.moderator.name}
                              </span>
                            ) : (
                              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Unassigned
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions Column - Row-by-Row Edit */}
                      <td className="px-6 py-4 space-x-2 text-sm whitespace-nowrap">
                        {isEditingRow ? (
                          <>
                            <button
                              onClick={() => handleSaveSingleAssignment(subject.id)}
                              disabled={savingAssignment}
                              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save
                            </button>
                            <button
                              onClick={handleCancelEditAssignment}
                              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStartEditAssignment(subject)}
                            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
