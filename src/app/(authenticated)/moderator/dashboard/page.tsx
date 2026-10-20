'use client';

import { useState, useEffect, Suspense } from 'react';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, FileText, Download, Lock, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isAccessibleUrl } from '@/lib/fileUtils';
import { ModerationReportModal } from '@/components/ModerationReportModal';
import { ProtectedFileModal, ProtectedFileType } from '@/components/ProtectedFileModal';
import {
  downloadModerationReportPdf,
  downloadModerationReportWord,
} from '@/lib/reportGenerator';

function ModeratorDashboardInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'reports' ? 'reports' : 'papers';

  const [activeTab, setActiveTab] = useState<'papers' | 'reports'>(initialTab);
  const [papers, setPapers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reportModalPaper, setReportModalPaper] = useState<any | null>(null);
  const [protectedModalTarget, setProtectedModalTarget] = useState<{
    paperId: string;
    subjectCode: string;
    subjectName: string;
    fileType: ProtectedFileType;
  } | null>(null);

  useEffect(() => {
    setActiveTab(searchParams.get('tab') === 'reports' ? 'reports' : 'papers');
  }, [searchParams]);

  useEffect(() => {
    const fetchModeratorData = async () => {
      if (!user) return;
      try {
        const [papersRes, reportsRes] = await Promise.all([
          fetch(`/api/papers?moderatorId=${encodeURIComponent(user.id)}`),
          fetch(`/api/moderation-reports?moderatorId=${encodeURIComponent(user.id)}`),
        ]);

        if (papersRes.ok) {
          setPapers(await papersRes.json());
        }
        if (reportsRes.ok) {
          setReports(await reportsRes.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchModeratorData();
  }, [user]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading moderator portal...</p>
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
        <h1 className="text-3xl font-bold text-gray-900">Moderator Portal</h1>
        <p className="text-gray-600 mt-1">
          Review PDF &amp; Word examination papers, submit moderation reports, and access password-protected finalized papers
        </p>
      </div>

      <RoleSwitcher />

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="border-b border-gray-200 px-6 pt-4 flex gap-3 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setActiveTab('papers')}
            className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl border-b-2 transition-colors cursor-pointer ${
              activeTab === 'papers'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Assigned Subjects &amp; Papers ({papers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl border-b-2 transition-colors cursor-pointer ${
              activeTab === 'reports'
                ? 'border-purple-600 text-purple-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Submitted Moderation Reports ({reports.length})
          </button>
        </div>

        {activeTab === 'papers' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Examiner
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Files &amp; Actions (PDF + Word)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {papers.map((paper) => (
                  <tr key={paper.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{paper.subjectCode}</div>
                      <div className="text-sm text-gray-600">{paper.subjectName}</div>
                      <div className="text-xs text-gray-400">
                        {paper.academicYear} • Semester {paper.semester}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-800">
                      {paper.firstExaminerName || paper.lecturerName}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs font-semibold">
                      {paper.status === 'under_moderation' ? (
                        <span className="px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800">
                          Ready to Moderate
                        </span>
                      ) : paper.status === 'revision_required' ? (
                        <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">
                          Revision Requested
                        </span>
                      ) : paper.status === 'finalized' ? (
                        <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-800">
                          Finalized • Sent to HOD
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                          Awaiting Paper Upload
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 flex-wrap">
                        {paper.status === 'draft' && (
                          <span className="text-xs text-gray-500 italic">
                            Waiting for First Examiner to upload PDF &amp; Word files
                          </span>
                        )}

                        {paper.status === 'under_moderation' && (
                          <>
                            {isAccessibleUrl(paper.paperUrl) && (
                              <a
                                href={paper.paperUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-xs font-medium"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Paper (PDF)
                              </a>
                            )}
                            {isAccessibleUrl(paper.paperWordUrl) && (
                              <a
                                href={paper.paperWordUrl}
                                download
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-medium"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Paper (Word)
                              </a>
                            )}
                            {isAccessibleUrl(paper.markingSchemeUrl) && (
                              <a
                                href={paper.markingSchemeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-xs font-medium"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Scheme (PDF)
                              </a>
                            )}
                            {isAccessibleUrl(paper.markingSchemeWordUrl) && (
                              <a
                                href={paper.markingSchemeWordUrl}
                                download
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-medium"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Scheme (Word)
                              </a>
                            )}
                            <Link
                              href={`/moderator/form/${paper.id}`}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Moderate
                            </Link>
                          </>
                        )}

                        {paper.status === 'revision_required' && (
                          <button
                            onClick={() => setReportModalPaper(paper)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Submitted Report
                          </button>
                        )}

                        {paper.status === 'finalized' && (
                          <>
                            <button
                              onClick={() =>
                                setProtectedModalTarget({
                                  paperId: paper.id,
                                  subjectCode: paper.subjectCode,
                                  subjectName: paper.subjectName,
                                  fileType: 'paperPdf',
                                })
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-medium cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Final Paper (PDF)
                            </button>
                            <button
                              onClick={() =>
                                setProtectedModalTarget({
                                  paperId: paper.id,
                                  subjectCode: paper.subjectCode,
                                  subjectName: paper.subjectName,
                                  fileType: 'paperWord',
                                })
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-xs font-medium cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Final Paper (Word)
                            </button>
                            <button
                              onClick={() => setReportModalPaper(paper)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Report (PDF / Word)
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {papers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No subjects assigned for moderation
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Examiner
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Workflow Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Report Actions (View / PDF / Word)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{rep.paper.subjectCode}</div>
                      <div className="text-sm text-gray-600">{rep.paper.subjectName}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {rep.paper.firstExaminerName}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold">
                      {rep.paper.status === 'finalized' ? (
                        <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-800">
                          Finalized &amp; Sent to HOD
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">
                          Awaiting First Examiner Finalization
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setReportModalPaper(rep.paper)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Report
                        </button>
                        <button
                          onClick={() => downloadModerationReportPdf(rep.paper, rep)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                        <button
                          onClick={() => downloadModerationReportWord(rep.paper, rep)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Word (.docx)
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {reports.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No moderation reports submitted yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ModeratorDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading moderator portal...</div>}>
      <ModeratorDashboardInner />
    </Suspense>
  );
}
