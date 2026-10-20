'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Send,
  KeyRound,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/AuthContext';
import {
  PDF_ACCEPT,
  WORD_ACCEPT,
  isValidPdfFile,
  isValidWordFile,
  uploadDocumentFile,
  isAccessibleUrl,
} from '@/lib/fileUtils';
import {
  downloadModerationReportPdf,
  downloadModerationReportWord,
} from '@/lib/reportGenerator';

export default function PaperRevisionPage() {
  const router = useRouter();
  const params = useParams();
  const paperId = params.paperId as string;
  const { user } = useAuth();

  const [paper, setPaper] = useState<any>(null);
  const [moderationReport, setModerationReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [followUpActions, setFollowUpActions] = useState<string[]>(['', '', '', '', '']);

  // Final PDF + Word slots
  const [finalPaperPdfFile, setFinalPaperPdfFile] = useState<File | null>(null);
  const [finalPaperWordFile, setFinalPaperWordFile] = useState<File | null>(null);
  const [finalSchemePdfFile, setFinalSchemePdfFile] = useState<File | null>(null);
  const [finalSchemeWordFile, setFinalSchemeWordFile] = useState<File | null>(null);
  const [lecturerSignatureFile, setLecturerSignatureFile] = useState<File | null>(null);

  // Protection password set by First Examiner for HOD & Moderator
  const [filePassword, setFilePassword] = useState('');
  const [confirmFilePassword, setConfirmFilePassword] = useState('');
  const [showProtectionPwd, setShowProtectionPwd] = useState(false);

  const { showToast, ToastElement } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [paperRes, reportRes] = await Promise.all([
          fetch(`/api/papers/${paperId}`),
          fetch(`/api/moderation-reports?paperId=${paperId}`),
        ]);

        if (paperRes.ok) {
          setPaper(await paperRes.json());
        }
        if (reportRes.ok) {
          const reportData = await reportRes.json();
          setModerationReport(reportData);
          if (reportData.followUpActions && Array.isArray(reportData.followUpActions)) {
            const actions = [...reportData.followUpActions];
            while (actions.length < 5) {
              actions.push('');
            }
            setFollowUpActions(actions);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [paperId]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading revision details...</p>
      </div>
    );
  }

  if (!paper || !moderationReport) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Paper or moderation report not found</h1>
        <button
          onClick={() => router.push('/lecturer/dashboard')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isFinalized = paper.status === 'finalized';
  const isFirstExaminer =
    user?.id === (paper.firstExaminerId || paper.lecturerId);

  const handleFollowUpChange = (index: number, value: string) => {
    if (isFinalized || !isFirstExaminer) return;
    const newActions = [...followUpActions];
    newActions[index] = value;
    setFollowUpActions(newActions);
  };

  const handleGenerateStrongPassword = () => {
    const codePart = (paper.subjectCode || 'EXAM').replace(/\s+/g, '');
    const generated = `WUSL-${codePart}-${Math.floor(1000 + Math.random() * 9000)}`;
    setFilePassword(generated);
    setConfirmFilePassword(generated);
    setShowProtectionPwd(true);
  };

  const handleFinalizeAndSendToHod = async () => {
    if (isFinalized || !isFirstExaminer) return;

    if (!finalPaperPdfFile || !finalPaperWordFile) {
      showToast('Please upload BOTH Final Paper PDF and Final Paper Word (.doc/.docx).', 'warning');
      return;
    }
    if (!finalSchemePdfFile || !finalSchemeWordFile) {
      showToast(
        'Please upload BOTH Final Marking Scheme PDF and Word (.doc/.docx).',
        'warning'
      );
      return;
    }
    if (!isValidPdfFile(finalPaperPdfFile) || !isValidPdfFile(finalSchemePdfFile)) {
      showToast('PDF slots require valid .pdf files.', 'error');
      return;
    }
    if (!isValidWordFile(finalPaperWordFile) || !isValidWordFile(finalSchemeWordFile)) {
      showToast('Word slots require valid .doc or .docx files.', 'error');
      return;
    }

    const filledActions = followUpActions.filter((a) => a.trim());
    if (filledActions.length === 0) {
      showToast('Please enter at least one follow-up action addressing moderator feedback.', 'warning');
      return;
    }

    if (filePassword.trim().length < 4) {
      showToast(
        'Please set a file protection password (at least 4 characters) for HOD & Moderator access.',
        'warning'
      );
      return;
    }
    if (filePassword !== confirmFilePassword) {
      showToast('File protection passwords do not match.', 'warning');
      return;
    }

    if (!lecturerSignatureFile) {
      showToast('Please upload your digital signature image.', 'warning');
      return;
    }

    setFinalizing(true);
    try {
      const [
        paperUrl,
        paperWordUrl,
        markingSchemeUrl,
        markingSchemeWordUrl,
        lecturerSignatureUrl,
      ] = await Promise.all([
        uploadDocumentFile(finalPaperPdfFile, `papers-final-pdf/${paperId}`),
        uploadDocumentFile(finalPaperWordFile, `papers-final-word/${paperId}`),
        uploadDocumentFile(finalSchemePdfFile, `schemes-final-pdf/${paperId}`),
        uploadDocumentFile(finalSchemeWordFile, `schemes-final-word/${paperId}`),
        uploadDocumentFile(lecturerSignatureFile, `signatures-lecturer/${paperId}`),
      ]);

      const reportRes = await fetch('/api/moderation-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperId,
          moderatorId: moderationReport.moderatorId,
          remarks: moderationReport.remarks,
          additionalComments: moderationReport.additionalComments,
          followUpActions: filledActions,
          lecturerSignatureUrl,
          preserveStatus: true,
        }),
      });

      const paperRes = await fetch(`/api/papers/${paperId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'finalized',
          paperUrl,
          paperWordUrl,
          markingSchemeUrl,
          markingSchemeWordUrl,
          filePassword: filePassword.trim(),
          actingUserId: user?.id,
        }),
      });

      if (reportRes.ok && paperRes.ok) {
        showToast(
          'Paper finalized, encrypted with password protection, and sent to HOD with Moderator Report!',
          'success'
        );
        setTimeout(() => router.push('/lecturer/dashboard'), 1400);
      } else {
        const err = await paperRes.json().catch(() => ({}));
        showToast(err.error || 'Failed to finalize paper', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'An error occurred during finalization', 'error');
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {ToastElement}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>

      {isFinalized && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-5 py-4 rounded-2xl mb-6 flex items-center justify-between flex-wrap gap-3 font-medium">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Finalized &amp; Sent to HOD — Password-protected PDF &amp; Word files and signed Moderator Report are available in HOD &amp; Moderator portals.
            </span>
          </div>
        </div>
      )}

      {/* Course Header */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Paper Revision, Finalization &amp; Submission to HOD
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm bg-gray-50 p-4 rounded-xl">
          <div>
            <span className="text-gray-500 block text-xs">Course</span>
            <span className="font-semibold text-gray-900">
              {paper.subjectCode} — {paper.subjectName}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">First Examiner (Paper Setter)</span>
            <span className="font-semibold text-indigo-700">
              {paper.firstExaminerName || paper.lecturerName}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Moderator</span>
            <span className="font-semibold text-emerald-700">{moderationReport.moderatorName}</span>
          </div>
        </div>
      </div>

      {/* Original Draft Files (PDF + Word) */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Original Submitted Draft Files (PDF &amp; Word)</h2>
        <div className="flex flex-wrap gap-3">
          {isAccessibleUrl(paper.draftPaperUrl || paper.paperUrl) && (
            <a
              href={paper.draftPaperUrl || paper.paperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Draft Paper (PDF)
            </a>
          )}
          {isAccessibleUrl(paper.draftPaperWordUrl || paper.paperWordUrl) && (
            <a
              href={paper.draftPaperWordUrl || paper.paperWordUrl}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-800 rounded-xl hover:bg-blue-100 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Draft Paper (Word .docx)
            </a>
          )}
          {isAccessibleUrl(paper.draftMarkingSchemeUrl || paper.markingSchemeUrl) && (
            <a
              href={paper.draftMarkingSchemeUrl || paper.markingSchemeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Draft Scheme (PDF)
            </a>
          )}
          {isAccessibleUrl(paper.draftMarkingSchemeWordUrl || paper.markingSchemeWordUrl) && (
            <a
              href={paper.draftMarkingSchemeWordUrl || paper.markingSchemeWordUrl}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-800 rounded-xl hover:bg-blue-100 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Draft Scheme (Word .docx)
            </a>
          )}
        </div>
      </div>

      {/* Moderator Feedback */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Moderator&apos;s Feedback</h2>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {moderationReport.additionalComments}
          </p>
        </div>
      </div>

      {/* Follow-Up Actions */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">
          Follow-Up Actions (First Examiner&apos;s Response)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Record the revisions made to address the Moderator&apos;s comments (included in the final report sent to HOD):
        </p>
        <div className="space-y-3">
          {followUpActions.map((action, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-500 w-6">{index + 1}.</span>
              <input
                type="text"
                value={action}
                onChange={(e) => handleFollowUpChange(index, e.target.value)}
                disabled={isFinalized || !isFirstExaminer}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Describe revision completed..."
              />
            </div>
          ))}
        </div>
      </div>

      {/* Upload Final Versions (Both PDF + Word) + Password Protection */}
      {!isFinalized && isFirstExaminer && (
        <>
          <div className="bg-white rounded-2xl shadow p-6 mb-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Upload Final Versions for HOD &amp; Moderator (PDF + Word)
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Both PDF and Word files will be encrypted with your file protection password and delivered to the HOD.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept={PDF_ACCEPT}
                    onChange={(e) => setFinalPaperPdfFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="final-paper-pdf"
                  />
                  <label
                    htmlFor="final-paper-pdf"
                    className="flex flex-col items-center cursor-pointer text-center"
                  >
                    <Upload className="w-8 h-8 text-red-500 mb-1.5" />
                    <span className="text-sm font-semibold text-gray-900">
                      Final Paper — PDF (.pdf)
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {finalPaperPdfFile ? finalPaperPdfFile.name : 'Select final PDF paper'}
                    </span>
                  </label>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-indigo-500 transition-colors">
                  <input
                    type="file"
                    accept={WORD_ACCEPT}
                    onChange={(e) => setFinalPaperWordFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="final-paper-word"
                  />
                  <label
                    htmlFor="final-paper-word"
                    className="flex flex-col items-center cursor-pointer text-center"
                  >
                    <Upload className="w-8 h-8 text-blue-600 mb-1.5" />
                    <span className="text-sm font-semibold text-gray-900">
                      Final Paper — Word (.doc / .docx)
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {finalPaperWordFile ? finalPaperWordFile.name : 'Select final Word paper'}
                    </span>
                  </label>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept={PDF_ACCEPT}
                    onChange={(e) => setFinalSchemePdfFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="final-scheme-pdf"
                  />
                  <label
                    htmlFor="final-scheme-pdf"
                    className="flex flex-col items-center cursor-pointer text-center"
                  >
                    <Upload className="w-8 h-8 text-red-500 mb-1.5" />
                    <span className="text-sm font-semibold text-gray-900">
                      Final Marking Scheme — PDF (.pdf)
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {finalSchemePdfFile ? finalSchemePdfFile.name : 'Select final PDF scheme'}
                    </span>
                  </label>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-indigo-500 transition-colors">
                  <input
                    type="file"
                    accept={WORD_ACCEPT}
                    onChange={(e) => setFinalSchemeWordFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="final-scheme-word"
                  />
                  <label
                    htmlFor="final-scheme-word"
                    className="flex flex-col items-center cursor-pointer text-center"
                  >
                    <Upload className="w-8 h-8 text-blue-600 mb-1.5" />
                    <span className="text-sm font-semibold text-gray-900">
                      Final Marking Scheme — Word (.doc / .docx)
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {finalSchemeWordFile ? finalSchemeWordFile.name : 'Select final Word scheme'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Password Protection Setup */}
            <div className="pt-5 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Set File Protection Password (HOD &amp; Moderator Only)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateStrongPassword}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Generate Recommended Password
                </button>
              </div>
              <p className="text-xs text-gray-600 mb-4">
                Encrypts both the downloaded PDF and Microsoft Word (.docx) finalized files so only authorized HOD &amp; Moderator users with this password can open them.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Protection Password
                  </label>
                  <input
                    type={showProtectionPwd ? 'text' : 'password'}
                    value={filePassword}
                    onChange={(e) => setFilePassword(e.target.value)}
                    placeholder="Enter protection password"
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProtectionPwd((v) => !v)}
                    className="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600"
                  >
                    {showProtectionPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Confirm Protection Password
                  </label>
                  <input
                    type={showProtectionPwd ? 'text' : 'password'}
                    value={confirmFilePassword}
                    onChange={(e) => setConfirmFilePassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Digital Signatures */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Digital Signatures &amp; Verification
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-4 text-sm space-y-2">
            <h3 className="text-xs font-semibold text-blue-900 uppercase tracking-wider">
              Moderator Signature
            </h3>
            <p className="flex justify-between">
              <span className="text-gray-500">Signed By:</span>
              <span className="font-semibold text-gray-900">{moderationReport.moderatorName}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-gray-500">Date:</span>
              <span className="font-mono text-xs">
                {new Date(moderationReport.createdAt).toLocaleString()}
              </span>
            </p>
            {moderationReport.moderatorSignatureUrl && (
              <div className="mt-2 border rounded-lg p-2 bg-white flex justify-center">
                <img
                  src={moderationReport.moderatorSignatureUrl}
                  alt="Moderator Signature"
                  className="max-h-14 object-contain"
                />
              </div>
            )}
          </div>

          <div className="border border-purple-100 bg-purple-50/30 rounded-xl p-4 text-sm space-y-2">
            <h3 className="text-xs font-semibold text-purple-900 uppercase tracking-wider">
              First Examiner Signature
            </h3>
            <p className="flex justify-between">
              <span className="text-gray-500">Signed By:</span>
              <span className="font-semibold text-gray-900">
                {paper.firstExaminerName || paper.lecturerName}
              </span>
            </p>
            {!isFinalized && isFirstExaminer ? (
              <div className="pt-2">
                <div className="border border-dashed border-gray-300 rounded-xl p-3 bg-white hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLecturerSignatureFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="lecturer-sig-upload"
                  />
                  <label
                    htmlFor="lecturer-sig-upload"
                    className="flex flex-col items-center cursor-pointer text-center"
                  >
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-600">
                      {lecturerSignatureFile
                        ? lecturerSignatureFile.name
                        : 'Click to upload First Examiner signature image'}
                    </span>
                  </label>
                </div>
              </div>
            ) : (
              moderationReport.lecturerSignatureUrl && (
                <div className="mt-2 border rounded-lg p-2 bg-white flex justify-center">
                  <img
                    src={moderationReport.lecturerSignatureUrl}
                    alt="First Examiner Signature"
                    className="max-h-14 object-contain"
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Report Downloads (PDF + Word) & Finalize + Send to HOD */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() =>
            downloadModerationReportPdf(
              paper,
              moderationReport,
              followUpActions,
              lecturerSignatureFile ? URL.createObjectURL(lecturerSignatureFile) : null
            )
          }
          className="inline-flex items-center gap-2 px-5 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium text-sm cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          Download Report (PDF)
        </button>

        <button
          onClick={() =>
            downloadModerationReportWord(paper, moderationReport, followUpActions)
          }
          className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          Download Report (Word .docx)
        </button>

        {!isFinalized && isFirstExaminer && (
          <button
            onClick={handleFinalizeAndSendToHod}
            disabled={finalizing}
            className="flex-1 min-w-[240px] flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-6 rounded-xl hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-50 cursor-pointer"
          >
            {finalizing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Encrypting &amp; Sending to HOD...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Finalize &amp; Send to HOD
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
