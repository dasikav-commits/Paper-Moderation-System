'use client';

import { useState, useEffect } from 'react';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import Link from 'next/link';
import {
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Circle,
  Eye,
  ShieldCheck,
  Lock,
  BookOpen,
  ClipboardCheck,
  Download,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isAccessibleUrl } from '@/lib/fileUtils';
import { ModerationReportModal } from '@/components/ModerationReportModal';
import { ProtectedFileModal, ProtectedFileType } from '@/components/ProtectedFileModal';

export default function LecturerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'lecturer' | 'moderator'>('lecturer');
  const [lecturerPapers, setLecturerPapers] = useState<any[]>([]);
  const [moderatorPapers, setModeratorPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reportModalPaper, setReportModalPaper] = useState<any | null>(null);
  const [protectedModalTarget, setProtectedModalTarget] = useState<{
    paperId: string;
    subjectCode: string;
    subjectName: string;
    fileType: ProtectedFileType;
  } | null>(null);

  const fetchAllMySubjects = async () => {
    if (!user) return;
    try {
      const [lecRes, modRes] = await Promise.all([
        fetch(`/api/papers?lecturerId=${encodeURIComponent(user.id)}`),
        fetch(`/api/papers?moderatorId=${encodeURIComponent(user.id)}`),
      ]);

      if (lecRes.ok) {
        setLecturerPapers(await lecRes.json());
      }
      if (modRes.ok) {
        setModeratorPapers(await modRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMySubjects();
  }, [user]);

  const getStatusBadge = (status: string, sentToHod?: boolean) => {
    const configs: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Circle, label: 'Draft' },
      submitted: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock, label: 'Submitted' },
      under_moderation: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: Clock,
        label: 'Under Moderation',
      },
      revision_required: {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        icon: AlertCircle,
        label: 'Revision Required',
      },
      finalized: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: CheckCircle,
        label: sentToHod ? 'Finalized • Sent to HOD' : 'Finalized',
      },
    };
    const config = configs[status] || configs.draft;
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 ${config.bg} ${config.text} rounded-full text-xs font-semibold whitespace-nowrap`}
      >
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading your assigned subjects...</p>
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
        <h1 className="text-3xl font-bold text-gray-900">My Subjects</h1>
        <p className="text-gray-600 mt-1">
          View your assigned subjects as <strong>Lecturer / First Examiner</strong> and as{' '}
          <strong>Moderator</strong>
        </p>
      </div>

      <RoleSwitcher />

      {/* My Subjects Interactive Tabs: Lecturer Tab & Moderator Tab */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="border-b border-gray-200 px-6 pt-4 flex flex-wrap gap-3 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setActiveTab('lecturer')}
            className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl border-b-2 transition-colors cursor-pointer ${
              activeTab === 'lecturer'
                ? 'border-blue-600 text-blue-700 bg-white shadow-xs'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Lecturer Tab
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
              {lecturerPapers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('moderator')}
            className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl border-b-2 transition-colors cursor-pointer ${
              activeTab === 'moderator'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Moderator Tab
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800">
              {moderatorPapers.length}
            </span>
          </button>
        </div>

        {/* LECTURER TAB CONTENT */}
        {activeTab === 'lecturer' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject Code
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignment Role
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Moderator
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lecturerPapers.map((paper) => {
                  const isFirstExaminer =
                    paper.firstExaminerId === user?.id ||
                    (!paper.firstExaminerId && paper.lecturerId === user?.id);

                  return (
                    <tr key={paper.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 whitespace-nowrap font-semibold text-gray-900">
                        {paper.subjectCode}
                        <div className="text-xs font-normal text-gray-500">
                          Sem {paper.semester} • {paper.academicYear}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-900 font-medium">{paper.subjectName}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isFirstExaminer ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            First Examiner (Setter)
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              Course Lecturer
                            </span>
                            <p className="text-[11px] text-gray-500 mt-1">
                              Setter: {paper.firstExaminerName}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {paper.moderatorName || 'Unassigned'}
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(paper.status, paper.sentToHod)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {paper.status === 'draft' &&
                            (isFirstExaminer ? (
                              <Link
                                href={`/subject/${paper.subjectId}`}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-semibold whitespace-nowrap"
                              >
                                Set Paper (PDF + Word)
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-500 italic">
                                Set by First Examiner ({paper.firstExaminerName})
                              </span>
                            ))}

                          {paper.status === 'under_moderation' && (
                            <>
                              {isAccessibleUrl(paper.paperUrl) && (
                                <a
                                  href={paper.paperUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-medium"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Paper (PDF)
                                </a>
                              )}
                              {isAccessibleUrl(paper.paperWordUrl) && (
                                <a
                                  href={paper.paperWordUrl}
                                  download
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-medium"
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Scheme (PDF)
                                </a>
                              )}
                              {isAccessibleUrl(paper.markingSchemeWordUrl) && (
                                <a
                                  href={paper.markingSchemeWordUrl}
                                  download
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Scheme (Word)
                                </a>
                              )}
                            </>
                          )}

                          {paper.status === 'revision_required' &&
                            (isFirstExaminer ? (
                              <Link
                                href={`/revision/${paper.id}`}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-xs font-semibold whitespace-nowrap"
                              >
                                Revise &amp; Send to HOD
                              </Link>
                            ) : (
                              <button
                                onClick={() => setReportModalPaper(paper)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                View Report
                              </button>
                            ))}

                          {paper.status === 'finalized' && (
                            <>
                              <button
                                onClick={() => setReportModalPaper(paper)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white hover:bg-purple-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Moderator Report (PDF / Word)
                              </button>
                              {isFirstExaminer && (
                                <button
                                  onClick={() =>
                                    setProtectedModalTarget({
                                      paperId: paper.id,
                                      subjectCode: paper.subjectCode,
                                      subjectName: paper.subjectName,
                                      fileType: 'paperPdf',
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  Protected Files
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {lecturerPapers.length === 0 && (
              <div className="text-center py-12 text-gray-500 font-medium">
                No subjects assigned to you as Lecturer / First Examiner yet.
              </div>
            )}
          </div>
        )}

        {/* MODERATOR TAB CONTENT */}
        {activeTab === 'moderator' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject Code
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Examiner
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Moderation &amp; Files
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {moderatorPapers.map((paper) => (
                  <tr key={paper.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 whitespace-nowrap font-semibold text-gray-900">
                      {paper.subjectCode}
                      <div className="text-xs font-normal text-gray-500">
                        Sem {paper.semester} • {paper.academicYear}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-900">{paper.subjectName}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {paper.firstExaminerName || paper.lecturerName}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(paper.status, paper.sentToHod)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {paper.status === 'draft' && (
                          <span className="text-xs text-gray-500 italic">
                            Awaiting paper upload from First Examiner ({paper.firstExaminerName})
                          </span>
                        )}

                        {paper.status === 'under_moderation' && (
                          <>
                            {isAccessibleUrl(paper.paperUrl) && (
                              <a
                                href={paper.paperUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-lg text-xs font-medium"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Paper (PDF)
                              </a>
                            )}
                            {isAccessibleUrl(paper.paperWordUrl) && (
                              <a
                                href={paper.paperWordUrl}
                                download
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium"
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
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-lg text-xs font-medium"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Scheme (PDF)
                              </a>
                            )}
                            {isAccessibleUrl(paper.markingSchemeWordUrl) && (
                              <a
                                href={paper.markingSchemeWordUrl}
                                download
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Scheme (Word)
                              </a>
                            )}
                            <Link
                              href={`/moderator/form/${paper.id}`}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-semibold"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Moderate
                            </Link>
                          </>
                        )}

                        {paper.status === 'revision_required' && (
                          <button
                            onClick={() => setReportModalPaper(paper)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white hover:bg-purple-700 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Submitted Report (PDF / Word)
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-medium cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Protected Paper (PDF)
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white hover:bg-teal-700 rounded-lg text-xs font-medium cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Protected Paper (Word)
                            </button>
                            <button
                              onClick={() => setReportModalPaper(paper)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white hover:bg-purple-700 rounded-lg text-xs font-medium cursor-pointer"
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

            {moderatorPapers.length === 0 && (
              <div className="text-center py-12 text-gray-500 font-medium">
                No subjects assigned to you as Moderator yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
