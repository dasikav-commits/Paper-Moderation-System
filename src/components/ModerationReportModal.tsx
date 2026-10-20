'use client';

import { useEffect, useState } from 'react';
import { X, Download, FileText, CheckCircle, AlertCircle, Send } from 'lucide-react';
import {
  MODERATION_CRITERIA,
  downloadModerationReportPdf,
  downloadModerationReportWord,
} from '@/lib/reportGenerator';

interface ModerationReportModalProps {
  paper: any;
  onClose: () => void;
}

export function ModerationReportModal({ paper, onClose }: ModerationReportModalProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/moderation-reports?paperId=${encodeURIComponent(paper.id)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Moderation report not available yet for this paper.');
        }
        return res.json();
      })
      .then((data) => setReport(data))
      .catch((e) => setError(e.message || 'Unable to load report'))
      .finally(() => setLoading(false));
  }, [paper.id]);

  const isFinalized = paper.status === 'finalized';
  const actions: string[] = Array.isArray(report?.followUpActions)
    ? report.followUpActions.filter((a: string) => a && a.trim())
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold">
                Moderation Report — {paper.subjectCode}: {paper.subjectName}
              </h2>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              Wayamba University of Sri Lanka — Faculty of Applied Sciences
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-3">Loading moderation report...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-6 text-center text-amber-800">
              {error}
            </div>
          ) : (
            <>
              {isFinalized && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold">
                    <Send className="w-4 h-4 text-emerald-600" />
                    Finalized &amp; Officially Delivered to Head of Department (HOD)
                  </div>
                  {paper.sentToHodAt && (
                    <span className="text-xs text-emerald-700 font-mono">
                      {new Date(paper.sentToHodAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Summary Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4 border border-gray-200 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs">Academic Period</span>
                  <span className="font-semibold text-gray-900">
                    {paper.academicYear} — Semester {paper.semester}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">First Examiner (Paper Setter)</span>
                  <span className="font-semibold text-gray-900">
                    {paper.firstExaminerName || paper.lecturerName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Moderator</span>
                  <span className="font-semibold text-gray-900">
                    {report.moderatorName || paper.moderatorName}
                  </span>
                </div>
              </div>

              {/* 10 Criteria Checklist */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  1. Moderator&apos;s Evaluation Criteria
                </h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-600">Criteria</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-600 w-28">
                          Assessment
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {MODERATION_CRITERIA.map((c, idx) => {
                        const yes = Boolean(report.remarks?.[c.key]);
                        return (
                          <tr key={c.key} className="hover:bg-gray-50/70">
                            <td className="px-4 py-2.5 text-gray-800">
                              {idx + 1}. {c.label}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {yes ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Yes
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  No
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Additional Comments */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  2. Moderator&apos;s Additional Comments
                </h3>
                <div className="rounded-xl bg-orange-50/70 border border-orange-200 p-4 text-sm text-gray-800 whitespace-pre-wrap">
                  {report.additionalComments || 'No additional comments recorded.'}
                </div>
              </div>

              {/* Follow-Up Actions */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  3. Follow-Up Actions Taken by First Examiner
                </h3>
                {actions.length > 0 ? (
                  <ul className="space-y-2 rounded-xl bg-blue-50/60 border border-blue-200 p-4 text-sm text-gray-800 list-decimal list-inside">
                    {actions.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic bg-gray-50 rounded-xl p-4 border border-gray-200">
                    Pending First Examiner follow-up response.
                  </p>
                )}
              </div>

              {/* Digital Signatures */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 text-sm">
                  <p className="font-semibold text-blue-900 mb-1">Moderator Signature</p>
                  <p className="text-gray-700">Signed by: {report.moderatorName}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                  {report.moderatorSignatureUrl && (
                    <img
                      src={report.moderatorSignatureUrl}
                      alt="Moderator Signature"
                      className="mt-3 max-h-14 object-contain bg-white p-1.5 rounded border"
                    />
                  )}
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4 text-sm">
                  <p className="font-semibold text-purple-900 mb-1">First Examiner Signature</p>
                  <p className="text-gray-700">
                    Signed by: {paper.firstExaminerName || paper.lecturerName}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    {isFinalized
                      ? new Date(paper.sentToHodAt || paper.updatedAt).toLocaleString()
                      : 'Pending Finalization'}
                  </p>
                  {report.lecturerSignatureUrl && (
                    <img
                      src={report.lecturerSignatureUrl}
                      alt="First Examiner Signature"
                      className="mt-3 max-h-14 object-contain bg-white p-1.5 rounded border"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer with PDF + Word Downloads */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap gap-2.5">
            {report && (
              <>
                <button
                  onClick={() => downloadModerationReportPdf(paper, report)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Report (PDF)
                </button>
                <button
                  onClick={() => downloadModerationReportWord(paper, report)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Report (Word .docx)
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
