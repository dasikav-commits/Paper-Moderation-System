'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  Users,
  Send,
  Loader2,
  Clock,
  Eye,
  Download,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/Toast';
import {
  PDF_ACCEPT,
  WORD_ACCEPT,
  isValidPdfFile,
  isValidWordFile,
  uploadDocumentFile,
  isAccessibleUrl,
} from '@/lib/fileUtils';

export default function SubjectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.subjectId as string;
  const { user } = useAuth();

  const [subject, setSubject] = useState<any>(null);
  const [existingPaperId, setExistingPaperId] = useState<string | null>(null);
  const [existingPaperStatus, setExistingPaperStatus] = useState<string | null>(null);
  const [submittedPaper, setSubmittedPaper] = useState<any>(null);

  // Side-by-side PDF + Word slots for Paper & Marking Scheme
  const [paperPdfFile, setPaperPdfFile] = useState<File | null>(null);
  const [paperWordFile, setPaperWordFile] = useState<File | null>(null);
  const [schemePdfFile, setSchemePdfFile] = useState<File | null>(null);
  const [schemeWordFile, setSchemeWordFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { showToast, ToastElement } = useToast();

  useEffect(() => {
    const fetchSubjectAndPapers = async () => {
      try {
        const res = await fetch(`/api/subjects/${subjectId}`);
        if (res.ok) {
          const data = await res.json();
          setSubject(data);

          if (data.papers && data.papers.length > 0) {
            setExistingPaperId(data.papers[0].id);
            setExistingPaperStatus(data.papers[0].status?.toLowerCase());
            setSubmittedPaper(data.papers[0]);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSubjectAndPapers();
  }, [subjectId]);

  const handleSubmitForReview = async () => {
    if (!paperPdfFile || !paperWordFile) {
      showToast('Please upload BOTH the PDF and Word (.doc/.docx) Examination Paper files.', 'warning');
      return;
    }
    if (!schemePdfFile || !schemeWordFile) {
      showToast(
        'Please upload BOTH the PDF and Word (.doc/.docx) Marking Scheme files.',
        'warning'
      );
      return;
    }
    if (!isValidPdfFile(paperPdfFile) || !isValidPdfFile(schemePdfFile)) {
      showToast('PDF upload slots must contain valid .pdf files.', 'error');
      return;
    }
    if (!isValidWordFile(paperWordFile) || !isValidWordFile(schemeWordFile)) {
      showToast('Word upload slots must contain valid .doc or .docx files.', 'error');
      return;
    }
    if (!user || !subject) return;

    setUploading(true);
    try {
      const [paperUrl, paperWordUrl, markingSchemeUrl, markingSchemeWordUrl] = await Promise.all([
        uploadDocumentFile(paperPdfFile, `papers-pdf/${subjectId}`),
        uploadDocumentFile(paperWordFile, `papers-word/${subjectId}`),
        uploadDocumentFile(schemePdfFile, `schemes-pdf/${subjectId}`),
        uploadDocumentFile(schemeWordFile, `schemes-word/${subjectId}`),
      ]);

      let response;
      if (existingPaperId && !existingPaperId.startsWith('virtual-')) {
        response = await fetch(`/api/papers/${existingPaperId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'under_moderation',
            paperUrl,
            paperWordUrl,
            markingSchemeUrl,
            markingSchemeWordUrl,
            actingUserId: user.id,
          }),
        });
      } else {
        response = await fetch('/api/papers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId,
            lecturerId: user.id,
            academicYear: subject.academicYear,
            semester: subject.semester,
            status: 'under_moderation',
            paperUrl,
            paperWordUrl,
            markingSchemeUrl,
            markingSchemeWordUrl,
          }),
        });
      }

      const data = await response.json();
      if (response.ok) {
        showToast('Examination Paper & Marking Scheme (PDF + Word) submitted for moderation!', 'success');
        setTimeout(() => router.push('/lecturer/dashboard'), 1200);
      } else {
        showToast(data.error || 'Failed to submit paper for review', 'error');
      }
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'An error occurred while submitting', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    router.push('/lecturer/dashboard');
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading subject details...</p>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Subject not found</h1>
        <button
          onClick={handleCancel}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const designatedFirstExaminerId = subject.firstExaminerId || subject.lecturerId;
  const isFirstExaminer = user?.id === designatedFirstExaminerId;
  const isUnderModeration = existingPaperStatus === 'under_moderation';

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {ToastElement}
      <button
        onClick={handleCancel}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to My Subjects
      </button>

      {/* Subject Info Header */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Set Examination Paper (PDF + Word)</h1>
          {isFirstExaminer ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              <ShieldCheck className="w-4 h-4" />
              Authorized First Examiner (Paper Setter)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              <ShieldAlert className="w-4 h-4" />
              View Only — First Examiner Sets Paper
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm bg-gray-50 rounded-xl p-4">
          <div>
            <span className="text-gray-500 block text-xs">Subject Code</span>
            <span className="font-semibold text-gray-900">{subject.code}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Subject Name</span>
            <span className="font-semibold text-gray-900">{subject.name}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">First Examiner (Setter)</span>
            <span className="font-semibold text-indigo-700">
              {subject.firstExaminer?.name || subject.lecturer?.name || 'Unassigned'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Moderator</span>
            <span className="font-semibold text-emerald-700">
              {subject.moderator?.name || 'Unassigned'}
            </span>
          </div>
        </div>
      </div>

      {/* Block paper setting if logged-in lecturer is NOT the First Examiner */}
      {!isFirstExaminer ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-950 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold">First Examiner Authorization Required</h2>
              <p className="text-sm mt-1">
                Only the Faculty Board approved <strong>First Examiner</strong> (
                <strong>{subject.firstExaminer?.name || 'Unassigned'}</strong>) is permitted to set
                and submit the examination paper and marking scheme for {subject.code}.
              </p>
            </div>
          </div>
        </div>
      ) : isUnderModeration ? (
        <div className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <h2 className="font-semibold text-yellow-800 text-lg">Paper Under Moderation</h2>
                <p className="text-yellow-700 text-sm mt-1">
                  Your PDF and Word examination files have been sent to the Moderator (
                  <strong>{subject.moderator?.name || 'Moderator'}</strong>).
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Submitted Draft Files (PDF &amp; Word)
            </h2>
            <div className="flex flex-wrap gap-3">
              {isAccessibleUrl(submittedPaper?.paperUrl) && (
                <a
                  href={submittedPaper.paperUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  Exam Paper (PDF)
                </a>
              )}
              {isAccessibleUrl(submittedPaper?.paperWordUrl) && (
                <a
                  href={submittedPaper.paperWordUrl}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Exam Paper (Word .docx)
                </a>
              )}
              {isAccessibleUrl(submittedPaper?.markingSchemeUrl) && (
                <a
                  href={submittedPaper.markingSchemeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-xl hover:bg-slate-800 text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  Marking Scheme (PDF)
                </a>
              )}
              {isAccessibleUrl(submittedPaper?.markingSchemeWordUrl) && (
                <a
                  href={submittedPaper.markingSchemeWordUrl}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-600 text-white rounded-xl hover:bg-slate-700 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Marking Scheme (Word .docx)
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Upload Both PDF + Word Side-by-Side */}
          <div className="bg-white rounded-2xl shadow p-6 mb-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                1. Examination Question Paper (Both PDF &amp; Word Required)
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Upload both the formatted PDF version and editable Microsoft Word (.doc / .docx) version.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept={PDF_ACCEPT}
                    onChange={(e) => setPaperPdfFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="paper-pdf-upload"
                  />
                  <label
                    htmlFor="paper-pdf-upload"
                    className="flex flex-col items-center justify-center cursor-pointer text-center"
                  >
                    <Upload className="w-10 h-10 text-red-500 mb-2" />
                    <span className="text-sm font-semibold text-gray-900">
                      Examination Paper — PDF (.pdf)
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {paperPdfFile ? paperPdfFile.name : 'Click to select PDF file'}
                    </span>
                    {paperPdfFile && (
                      <span className="text-xs text-green-600 font-medium mt-1">
                        ✓ PDF file ready
                      </span>
                    )}
                  </label>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 hover:border-indigo-500 transition-colors">
                  <input
                    type="file"
                    accept={WORD_ACCEPT}
                    onChange={(e) => setPaperWordFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="paper-word-upload"
                  />
                  <label
                    htmlFor="paper-word-upload"
                    className="flex flex-col items-center justify-center cursor-pointer text-center"
                  >
                    <Upload className="w-10 h-10 text-blue-600 mb-2" />
                    <span className="text-sm font-semibold text-gray-900">
                      Examination Paper — Word (.doc / .docx)
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {paperWordFile ? paperWordFile.name : 'Click to select Word document'}
                    </span>
                    {paperWordFile && (
                      <span className="text-xs text-green-600 font-medium mt-1">
                        ✓ Word file ready
                      </span>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                2. Marking Scheme / Model Answers (Both PDF &amp; Word Required)
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Upload both the PDF and Microsoft Word (.doc / .docx) marking scheme files.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept={PDF_ACCEPT}
                    onChange={(e) => setSchemePdfFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="scheme-pdf-upload"
                  />
                  <label
                    htmlFor="scheme-pdf-upload"
                    className="flex flex-col items-center justify-center cursor-pointer text-center"
                  >
                    <Upload className="w-10 h-10 text-red-500 mb-2" />
                    <span className="text-sm font-semibold text-gray-900">
                      Marking Scheme — PDF (.pdf)
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {schemePdfFile ? schemePdfFile.name : 'Click to select PDF file'}
                    </span>
                    {schemePdfFile && (
                      <span className="text-xs text-green-600 font-medium mt-1">
                        ✓ PDF file ready
                      </span>
                    )}
                  </label>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 hover:border-indigo-500 transition-colors">
                  <input
                    type="file"
                    accept={WORD_ACCEPT}
                    onChange={(e) => setSchemeWordFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="scheme-word-upload"
                  />
                  <label
                    htmlFor="scheme-word-upload"
                    className="flex flex-col items-center justify-center cursor-pointer text-center"
                  >
                    <Upload className="w-10 h-10 text-blue-600 mb-2" />
                    <span className="text-sm font-semibold text-gray-900">
                      Marking Scheme — Word (.doc / .docx)
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {schemeWordFile ? schemeWordFile.name : 'Click to select Word document'}
                    </span>
                    {schemeWordFile && (
                      <span className="text-xs text-green-600 font-medium mt-1">
                        ✓ Word file ready
                      </span>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold">Assigned Moderator</h2>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="font-medium text-gray-900">
                {subject.moderator?.name || 'Not yet assigned by HOD'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmitForReview}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-xl hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading PDF &amp; Word Files...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit PDF &amp; Word Files for Moderation
                </>
              )}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-3.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
