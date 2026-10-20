'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import {
  Plus,
  Edit2,
  Calendar,
  Check,
  X,
  ShieldAlert,
  ShieldCheck,
  Lock,
  FileText,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/Toast';
import { ProtectedFileModal, ProtectedFileType } from '@/components/ProtectedFileModal';
import { ModerationReportModal } from '@/components/ModerationReportModal';

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
  const [papers, setPapers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentYear, setCurrentYear] = useState('2025/2026');
  const [startYear, setStartYear] = useState<number>(2025);
  const [currentSemester, setCurrentSemester] = useState(1);
  const [isEditingAcademic, setIsEditingAcademic] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastElement } = useToast();

  // Row-by-row editing for First Examiner + Lecturers + Moderator
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editAssignmentForm, setEditAssignmentForm] = useState<{
    firstExaminerId: string;
    lecturerIds: string[];
    moderatorId: string;
  }>({
    firstExaminerId: '',
    lecturerIds: [],
    moderatorId: '',
  });
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Modals for viewing Finalized Reports / Password-Protected Final Papers directly
  const [reportModalPaper, setReportModalPaper] = useState<any | null>(null);
  const [protectedModalTarget, setProtectedModalTarget] = useState<{
    paperId: string;
    subjectCode: string;
    subjectName: string;
    fileType: ProtectedFileType;
  } | null>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      const dept = user.department || 'Department of Computing & Information Systems';
      const [subjectsRes, usersRes, papersRes, settingsRes] = await Promise.all([
        fetch(`/api/subjects?department=${encodeURIComponent(dept)}`),
        fetch(`/api/users?department=${encodeURIComponent(dept)}`),
        fetch(`/api/papers?department=${encodeURIComponent(dept)}`),
        fetch('/api/settings'),
      ]);

      if (subjectsRes.ok && usersRes.ok) {
        const subjectsData = await subjectsRes.json();
        const usersData = await usersRes.json();
        setSubjects(subjectsData);
        setUsers(usersData);

        if (papersRes.ok) {
          setPapers(await papersRes.json());
        }

        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          const year = settings.academicYear || '2025/2026';
          const sem = Number(settings.semester || 1);
          setCurrentYear(year);
          setStartYear(Number(year.split('/')[0]) || 2025);
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

  const approvedStaff = users.filter((u) => u.facultyBoardApproved !== false);
  const pendingApprovalCount = users.filter((u) => u.facultyBoardApproved === false).length;

  const handleStartEditAssignment = (subject: any) => {
    const existingIds: string[] = Array.isArray(subject.lecturerIds)
      ? subject.lecturerIds
      : subject.lecturerId
      ? [subject.lecturerId]
      : [];
    setEditingSubjectId(subject.id);
    setEditAssignmentForm({
      firstExaminerId: subject.firstExaminerId || subject.lecturerId || '',
      lecturerIds: existingIds,
      moderatorId: subject.moderatorId || '',
    });
  };

  const handleCancelEditAssignment = () => {
    setEditingSubjectId(null);
    setEditAssignmentForm({ firstExaminerId: '', lecturerIds: [], moderatorId: '' });
  };

  const toggleLecturerSelection = (staffId: string) => {
    setEditAssignmentForm((prev) => {
      const exists = prev.lecturerIds.includes(staffId);
      const updated = exists
        ? prev.lecturerIds.filter((id) => id !== staffId)
        : [...prev.lecturerIds, staffId];
      return { ...prev, lecturerIds: updated };
    });
  };

  const handleSaveSingleAssignment = async (subjectId: string) => {
    if (
      editAssignmentForm.firstExaminerId &&
      editAssignmentForm.moderatorId &&
      editAssignmentForm.firstExaminerId === editAssignmentForm.moderatorId
    ) {
      showToast('First Examiner and Moderator must be two different staff members.', 'warning');
      return;
    }

    setSavingAssignment(true);
    try {
      const mergedLecturers = editAssignmentForm.firstExaminerId
        ? Array.from(new Set([editAssignmentForm.firstExaminerId, ...editAssignmentForm.lecturerIds]))
        : editAssignmentForm.lecturerIds;

      const res = await fetch(`/api/subjects/${subjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstExaminerId: editAssignmentForm.firstExaminerId || null,
          lecturerIds: mergedLecturers,
          moderatorId: editAssignmentForm.moderatorId || null,
          academicYear: currentYear,
          assignedByUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Faculty Board approved examiners assigned successfully!', 'success');
        setEditingSubjectId(null);
        await fetchData();
      } else {
        showToast(data.error || 'Failed to save examiner assignment.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to save examiner assignment.', 'error');
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
        showToast('Academic period updated.', 'success');
      } catch (e) {
        console.error('Failed to save academic settings:', e);
      }
    }
    setIsEditingAcademic(!isEditingAcademic);
  };

  const finalizedPapers = papers.filter((p) => p.status === 'finalized');

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading HOD dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {ToastElement}

      {reportModalPaper && (
        <ModerationReportModal
          paper={reportModalPaper}
          onClose={() => setReportModalPaper(null)}
        />
      )}

      {protectedModalTarget && (
        <ProtectedFileModal
          paperId={protectedModalTarget.paperId}
          subjectCode={protectedModalTarget.subjectCode}
          subjectName={protectedModalTarget.subjectName}
          initialFileType={protectedModalTarget.fileType}
          onClose={() => setProtectedModalTarget(null)}
        />
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Department Head Portal</h1>
        <p className="text-gray-600 mt-1">
          Assign Faculty Board approved First Examiners, Lecturers, and Moderators &amp; review finalized examination papers
        </p>
      </div>

      <RoleSwitcher />

      {/* Faculty Board Approval Notice Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-gray-900">
              Faculty Board Examiner Panel Verification ({approvedStaff.length} Approved Staff
              {pendingApprovalCount > 0 ? ` • ${pendingApprovalCount} Pending Approval` : ''})
            </p>
            <p className="text-gray-600">
              Only academic staff approved by the Faculty Board appear in examiner assignment dropdowns below, and only the designated <strong>First Examiner</strong> may set and finalize examination papers.
            </p>
          </div>
        </div>
        <Link
          href="/department-head/lecturers"
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shrink-0"
        >
          Manage Faculty Board Approvals
        </Link>
      </div>

      {/* Academic Settings */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Academic Settings</h2>
          <button
            onClick={handleSaveAcademicSettings}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
            {isEditingAcademic ? 'Save' : 'Change'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Academic Year
            </label>
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
                    <option key={y} value={y}>
                      {y}
                    </option>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Semester
            </label>
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

      {/* Subject Examiner Assignments */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Faculty Board Approved Examiner Assignments
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Assign First Examiner (Paper Setter), Course Lecturer(s), and Moderator for Semester{' '}
                {currentSemester}.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
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
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  First Examiner (Setter)
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Course Lecturers
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Moderator
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paper Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => {
                const filteredSubjects = subjects.filter((s) => s.semester === currentSemester);

                if (filteredSubjects.length === 0) {
                  return (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-gray-500 font-medium bg-white"
                      >
                        No subjects found for Semester {currentSemester}.
                      </td>
                    </tr>
                  );
                }

                return filteredSubjects.map((subject) => {
                  const isEditingRow = editingSubjectId === subject.id;
                  const subjectPaper = papers.find((p) => p.subjectId === subject.id);

                  return (
                    <tr key={subject.id} className="hover:bg-gray-50 align-top">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">{subject.code}</div>
                        <div className="text-sm text-gray-600">{subject.name}</div>
                      </td>

                      {/* First Examiner (Paper Setter) */}
                      <td className="px-5 py-4">
                        {isEditingRow ? (
                          <select
                            value={editAssignmentForm.firstExaminerId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditAssignmentForm((prev) => ({
                                ...prev,
                                firstExaminerId: val,
                                lecturerIds: val
                                  ? Array.from(new Set([val, ...prev.lecturerIds]))
                                  : prev.lecturerIds,
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                          >
                            <option value="">Select First Examiner</option>
                            {approvedStaff.map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.name} ✓
                              </option>
                            ))}
                          </select>
                        ) : subject.firstExaminer?.name ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {subject.firstExaminer.name}
                          </span>
                        ) : (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Lecturers Panel */}
                      <td className="px-5 py-4">
                        {isEditingRow ? (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                            {approvedStaff.map((staff) => {
                              const checked =
                                editAssignmentForm.lecturerIds.includes(staff.id) ||
                                editAssignmentForm.firstExaminerId === staff.id;
                              return (
                                <label
                                  key={staff.id}
                                  className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={editAssignmentForm.firstExaminerId === staff.id}
                                    onChange={() => toggleLecturerSelection(staff.id)}
                                    className="rounded text-blue-600"
                                  />
                                  <span className="truncate">{staff.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : subject.lecturers && subject.lecturers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {subject.lecturers.map((lec: any) => (
                              <span
                                key={lec.id}
                                className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                              >
                                {lec.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">None assigned</span>
                        )}
                      </td>

                      {/* Moderator */}
                      <td className="px-5 py-4">
                        {isEditingRow ? (
                          <select
                            value={editAssignmentForm.moderatorId}
                            onChange={(e) =>
                              setEditAssignmentForm((prev) => ({
                                ...prev,
                                moderatorId: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                          >
                            <option value="">Select Moderator</option>
                            {approvedStaff
                              .filter((s) => s.id !== editAssignmentForm.firstExaminerId)
                              .map((moderator) => (
                                <option key={moderator.id} value={moderator.id}>
                                  {moderator.name} ✓
                                </option>
                              ))}
                          </select>
                        ) : subject.moderator?.name ? (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {subject.moderator.name}
                          </span>
                        ) : (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Paper Status */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        {subjectPaper?.status === 'finalized' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-800">
                            <Send className="w-3 h-3" />
                            Finalized &amp; Sent to HOD
                          </span>
                        ) : subjectPaper?.status === 'revision_required' ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full font-semibold bg-orange-100 text-orange-800">
                            Revision Required
                          </span>
                        ) : subjectPaper?.status === 'under_moderation' ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full font-semibold bg-yellow-100 text-yellow-800">
                            Under Moderation
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
                            Draft / Pending Paper
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 space-x-2 text-sm whitespace-nowrap">
                        {isEditingRow ? (
                          <>
                            <button
                              onClick={() => handleSaveSingleAssignment(subject.id)}
                              disabled={savingAssignment}
                              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save
                            </button>
                            <button
                              onClick={handleCancelEditAssignment}
                              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartEditAssignment(subject)}
                              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Assign
                            </button>
                            {subjectPaper?.status === 'finalized' && (
                              <>
                                <button
                                  onClick={() =>
                                    setProtectedModalTarget({
                                      paperId: subjectPaper.id,
                                      subjectCode: subject.code,
                                      subjectName: subject.name,
                                      fileType: 'paperPdf',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                  title="Access Password-Protected Final Files"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  Final Files
                                </button>
                                <button
                                  onClick={() => setReportModalPaper(subjectPaper)}
                                  className="inline-flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors cursor-pointer"
                                  title="View Finalized Moderator Report"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Report
                                </button>
                              </>
                            )}
                          </div>
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

      {/* Finalized Packages Sent to HOD Quick Summary */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Finalized Papers &amp; Moderator Reports Received by HOD
            </h2>
            <p className="text-sm text-gray-500">
              Password-protected PDF &amp; Word examination papers and signed Moderator Reports
            </p>
          </div>
          <Link
            href="/history"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Open Full Finalized Papers Archive →
          </Link>
        </div>

        {finalizedPapers.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">
            No finalized papers have been sent to HOD yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {finalizedPapers.map((fp) => (
              <div
                key={fp.id}
                className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between gap-3 bg-slate-50/60"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-gray-900">
                      {fp.subjectCode} — {fp.subjectName}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">
                      <Lock className="w-3 h-3" />
                      Protected
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    First Examiner: <strong>{fp.firstExaminerName || fp.lecturerName}</strong> •
                    Moderator: <strong>{fp.moderatorName || 'Assigned'}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setProtectedModalTarget({
                        paperId: fp.id,
                        subjectCode: fp.subjectCode,
                        subjectName: fp.subjectName,
                        fileType: 'paperPdf',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Paper (PDF)
                  </button>
                  <button
                    onClick={() =>
                      setProtectedModalTarget({
                        paperId: fp.id,
                        subjectCode: fp.subjectCode,
                        subjectName: fp.subjectName,
                        fileType: 'paperWord',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Paper (Word)
                  </button>
                  <button
                    onClick={() => setReportModalPaper(fp)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Moderator Report (View / PDF / Word)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
