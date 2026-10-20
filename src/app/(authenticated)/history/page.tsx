'use client';

import { useState, useEffect, Fragment } from 'react';
import { ChevronDown, ChevronUp, FileText, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { ProtectedFileModal, ProtectedFileType } from '@/components/ProtectedFileModal';
import { ModerationReportModal } from '@/components/ModerationReportModal';

export default function HistoryPage() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedSemester, setSelectedSemester] = useState('ALL');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [finalizedPapers, setFinalizedPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reportModalPaper, setReportModalPaper] = useState<any | null>(null);
  const [protectedModalTarget, setProtectedModalTarget] = useState<{
    paperId: string;
    subjectCode: string;
    subjectName: string;
    fileType: ProtectedFileType;
  } | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const dept = user.department || 'Department of Computing & Information Systems';
        const query = user.isDepartmentHead
          ? `/api/papers?department=${encodeURIComponent(dept)}`
          : `/api/papers?moderatorId=${encodeURIComponent(user.id)}`;

        const res = await fetch(query);
        if (res.ok) {
          const papers = await res.json();
          const finals = papers.filter((p: any) => p.status === 'finalized');
          setFinalizedPapers(finals);
          // Expand rows automatically so HOD & Moderator immediately see all finalized files per subject
          setExpandedRows(new Set(finals.map((p: any) => p.id)));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const availableYears = Array.from(
    new Set(['2025/2026', '2026/2027', ...finalizedPapers.map((p) => p.academicYear)])
  );

  const filteredHistory = finalizedPapers.filter((entry) => {
    if (selectedYear !== 'ALL' && entry.academicYear !== selectedYear) return false;
    if (selectedSemester !== 'ALL' && String(entry.semester) !== selectedSemester) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading finalized papers...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
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
        <h1 className="text-3xl font-bold text-gray-900">Finalized Papers</h1>
        <p className="text-gray-600 mt-1">
          Password-protected PDF &amp; Word examination papers and finalized Moderator Reports visible to HOD &amp; Moderator
        </p>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3 text-sm text-amber-950">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
        <span>
          All finalized examination papers and marking schemes below are <strong>password-protected files</strong>{' '}
          (encrypted PDF &amp; encrypted Microsoft Word <code>.docx</code>) restricted strictly to the{' '}
          <strong>Department Head (HOD)</strong> and assigned <strong>Moderator</strong>.
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="ALL">All Academic Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="ALL">All Semesters</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subject Code
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                First Examiner
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Moderator
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredHistory.map((entry) => (
              <Fragment key={entry.id}>
                <tr
                  onClick={() => toggleRow(entry.id)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {expandedRows.has(entry.id) ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-4 font-semibold text-gray-900">{entry.subjectCode}</td>
                  <td className="px-5 py-4 text-gray-900 font-medium">{entry.subjectName}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {entry.firstExaminerName || entry.lecturerName}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {entry.moderatorName || 'Assigned'}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {entry.academicYear} • Sem {entry.semester}
                  </td>
                </tr>
                {expandedRows.has(entry.id) && (
                  <tr className="bg-slate-50/80">
                    <td colSpan={6} className="px-6 md:px-12 py-5">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2.5">
                            Password-Protected Final Examination Paper &amp; Marking Scheme (PDF + Word)
                          </h3>
                          <div className="flex flex-wrap gap-2.5">
                            <button
                              onClick={() =>
                                setProtectedModalTarget({
                                  paperId: entry.id,
                                  subjectCode: entry.subjectCode,
                                  subjectName: entry.subjectName,
                                  fileType: 'paperPdf',
                                })
                              }
                              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors cursor-pointer"
                            >
                              <Lock className="w-4 h-4" />
                              Final Paper (Protected PDF)
                            </button>

                            <button
                              onClick={() =>
                                setProtectedModalTarget({
                                  paperId: entry.id,
                                  subjectCode: entry.subjectCode,
                                  subjectName: entry.subjectName,
                                  fileType: 'paperWord',
                                })
                              }
                              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors cursor-pointer"
                            >
                              <Lock className="w-4 h-4" />
                              Final Paper (Protected Word .docx)
                            </button>

                            <button
                              onClick={() =>
                                setProtectedModalTarget({
                                  paperId: entry.id,
                                  subjectCode: entry.subjectCode,
                                  subjectName: entry.subjectName,
                                  fileType: 'schemePdf',
                                })
                              }
                              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
                            >
                              <Lock className="w-4 h-4" />
                              Final Marking Scheme (Protected PDF)
                            </button>

                            <button
                              onClick={() =>
                                setProtectedModalTarget({
                                  paperId: entry.id,
                                  subjectCode: entry.subjectCode,
                                  subjectName: entry.subjectName,
                                  fileType: 'schemeWord',
                                })
                              }
                              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm font-medium transition-colors cursor-pointer"
                            >
                              <Lock className="w-4 h-4" />
                              Final Marking Scheme (Protected Word .docx)
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2.5">
                            Finalized Moderator Report (Sent to HOD)
                          </h3>
                          <div className="flex flex-wrap gap-2.5">
                            <button
                              onClick={() => setReportModalPaper(entry)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors cursor-pointer"
                            >
                              <FileText className="w-4 h-4" />
                              View &amp; Download Moderator Report (PDF / Word)
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        {filteredHistory.length === 0 && (
          <div className="text-center py-12 text-gray-500 font-medium bg-white">
            No finalized papers found for the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
