'use client';

import { useState, useEffect, Fragment } from 'react';
import { ChevronDown, ChevronUp, FileText, Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { ProtectedFileModal, ProtectedFileType } from '@/components/ProtectedFileModal';
import { ModerationReportModal } from '@/components/ModerationReportModal';

export default function LecturerHistoryPage() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedSemester, setSelectedSemester] = useState('ALL');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<any[]>([]);
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
        const res = await fetch(`/api/papers?lecturerId=${encodeURIComponent(user.id)}`);
        if (res.ok) {
          const papers = await res.json();
          const finals = papers.filter((p: any) => p.status === 'finalized');
          setHistory(finals);
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
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRows(next);
  };

  const availableYears = Array.from(
    new Set(['2025/2026', '2026/2027', ...history.map((p) => p.academicYear)])
  );

  const filteredHistory = history.filter((entry) => {
    if (selectedYear !== 'ALL' && entry.academicYear !== selectedYear) return false;
    if (selectedSemester !== 'ALL' && String(entry.semester) !== selectedSemester) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading history...</p>
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
        <h1 className="text-3xl font-bold text-gray-900">Lecturer Finalized History</h1>
        <p className="text-gray-600 mt-1">
          Completed examination papers submitted to HOD and finalized Moderator Reports
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="ALL">All Semesters</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12"></th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Subject Code
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Subject
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Academic Year
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Semester
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredHistory.map((entry) => {
              const isSetter =
                user?.id === (entry.firstExaminerId || entry.lecturerId) ||
                user?.isDepartmentHead ||
                user?.id === entry.moderatorId;

              return (
                <Fragment key={entry.id}>
                  <tr
                    onClick={() => toggleRow(entry.id)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      {expandedRows.has(entry.id) ? (
                        <ChevronUp className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{entry.subjectCode}</td>
                    <td className="px-5 py-4">{entry.subjectName}</td>
                    <td className="px-5 py-4 text-gray-600">{entry.academicYear}</td>
                    <td className="px-5 py-4 text-gray-600">Semester {entry.semester}</td>
                  </tr>
                  {expandedRows.has(entry.id) && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-6 md:px-12 py-4">
                        <div className="flex flex-wrap gap-3 items-center">
                          {isSetter ? (
                            <>
                              <button
                                onClick={() =>
                                  setProtectedModalTarget({
                                    paperId: entry.id,
                                    subjectCode: entry.subjectCode,
                                    subjectName: entry.subjectName,
                                    fileType: 'paperPdf',
                                  })
                                }
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium cursor-pointer"
                              >
                                <Lock className="w-4 h-4" />
                                Protected Final Paper (PDF / Word)
                              </button>
                            </>
                          ) : (
                            <span className="text-xs px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                              Finalized examination files are restricted to HOD &amp; Moderator
                            </span>
                          )}

                          <button
                            onClick={() => setReportModalPaper(entry)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium cursor-pointer"
                          >
                            <FileText className="w-4 h-4" />
                            View Moderator Report (PDF / Word)
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {filteredHistory.length === 0 && (
          <div className="text-center py-12 text-gray-500 font-medium">
            No finalized papers found.
          </div>
        )}
      </div>
    </div>
  );
}
