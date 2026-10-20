'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Send, Eye, Download, Upload } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/Toast';
import { isAccessibleUrl, uploadDocumentFile } from '@/lib/fileUtils';
import { MODERATION_CRITERIA } from '@/lib/reportGenerator';

function getLevelFromCode(subjectCode: string): number {
  const match = subjectCode?.match(/\d/);
  return match ? parseInt(match[0], 10) : 0;
}

export default function ModeratorFormPage() {
  const router = useRouter();
  const params = useParams();
  const paperId = params.paperId as string;
  const { user } = useAuth();

  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast, ToastElement } = useToast();
  const [remarks, setRemarks] = useState<Record<string, boolean>>({
    standardAppropriate: false,
    coversMainContents: false,
    assessesLearningOutcomes: false,
    clearAndUnambiguous: false,
    appropriateTimeAllocation: false,
    appropriateMarkAllocation: false,
    appropriateNumberingAndFormatting: false,
    clearFigures: false,
    accurateModelAnswers: false,
    structuredModelAnswers: false,
  });
  const [additionalComments, setAdditionalComments] = useState('');

  useEffect(() => {
    const fetchPaper = async () => {
      try {
        const res = await fetch(`/api/papers/${paperId}`);
        if (res.ok) {
          setPaper(await res.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPaper();
  }, [paperId]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading paper details...</p>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Paper not found</h1>
        <button
          onClick={() => router.push('/moderator/dashboard')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!additionalComments.trim()) {
      showToast('Please add additional comments for the First Examiner.', 'warning');
      return;
    }
    if (!signatureFile) {
      showToast('Please upload your signature image.', 'warning');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const moderatorSignatureUrl = await uploadDocumentFile(
        signatureFile,
        `signatures-moderator/${paperId}`
      );

      const response = await fetch('/api/moderation-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperId,
          moderatorId: user.id,
          remarks,
          additionalComments,
          moderatorSignatureUrl,
        }),
      });

      if (response.ok) {
        showToast(
          'Moderation report submitted! Returned to First Examiner for revision & finalization.',
          'success'
        );
        setTimeout(() => router.push('/moderator/dashboard'), 1200);
      } else {
        showToast('Failed to submit moderation report', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'An error occurred while submitting', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {ToastElement}
      <button
        onClick={() => router.push('/moderator/dashboard')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Moderator Portal
      </button>

      <div className="bg-white rounded-2xl shadow mb-6 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">
            Examination Question Paper Moderation
          </h1>
          <p className="text-gray-600 mt-1">
            Wayamba University of Sri Lanka — Faculty of Applied Sciences
          </p>
        </div>

        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Course Code &amp; Title:</span>
              <p className="font-semibold text-gray-900">
                {paper.subjectCode} – {paper.subjectName}
              </p>
            </div>
            <div>
              <span className="text-gray-600">First Examiner (Paper Setter):</span>
              <p className="font-semibold text-indigo-700">
                {paper.firstExaminerName || paper.lecturerName}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Level &amp; Semester:</span>
              <p className="font-medium">
                Level {getLevelFromCode(paper.subjectCode)} — Semester {paper.semester}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Academic Year &amp; Department:</span>
              <p className="font-medium">
                {paper.academicYear} • {paper.department}
              </p>
            </div>
          </div>
        </div>

        {/* Submitted PDF + Word Files */}
        <div className="p-6 border-b border-gray-200 bg-blue-50/70">
          <h2 className="text-lg font-semibold text-blue-950 mb-3">
            Submitted Examination Files for Review (PDF &amp; Word)
          </h2>
          <div className="flex flex-wrap gap-3">
            {isAccessibleUrl(paper.paperUrl) && (
              <a
                href={paper.paperUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm"
              >
                <Eye className="w-4 h-4" />
                View Paper (PDF)
              </a>
            )}
            {isAccessibleUrl(paper.paperWordUrl) && (
              <a
                href={paper.paperWordUrl}
                download
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm"
              >
                <Download className="w-4 h-4" />
                Download Paper (Word .docx)
              </a>
            )}
            {isAccessibleUrl(paper.markingSchemeUrl) && (
              <a
                href={paper.markingSchemeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-xl hover:bg-slate-800 font-medium text-sm"
              >
                <Eye className="w-4 h-4" />
                View Marking Scheme (PDF)
              </a>
            )}
            {isAccessibleUrl(paper.markingSchemeWordUrl) && (
              <a
                href={paper.markingSchemeWordUrl}
                download
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-600 text-white rounded-xl hover:bg-slate-700 font-medium text-sm"
              >
                <Download className="w-4 h-4" />
                Download Marking Scheme (Word .docx)
              </a>
            )}
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Moderator&apos;s Report</h2>

          <div className="overflow-x-auto mb-6 border border-gray-200 rounded-xl">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Moderator Remarks
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-24">
                    Yes
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-24">
                    No
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {MODERATION_CRITERIA.map((item, index) => (
                  <tr key={item.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {index + 1}. {item.label}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name={item.key}
                        checked={remarks[item.key] === true}
                        onChange={() => setRemarks({ ...remarks, [item.key]: true })}
                        className="w-4 h-4 text-blue-600"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name={item.key}
                        checked={remarks[item.key] === false}
                        onChange={() => setRemarks({ ...remarks, [item.key]: false })}
                        className="w-4 h-4 text-blue-600"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Comments by the Moderator
            </label>
            <textarea
              value={additionalComments}
              onChange={(e) => setAdditionalComments(e.target.value)}
              rows={5}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter detailed moderation comments and recommended revisions..."
            />
          </div>

          <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-blue-950 uppercase tracking-wider mb-3">
              Moderator Digital Signature
            </h3>
            <div className="space-y-4 text-sm text-gray-700">
              <p className="flex justify-between border-b border-blue-100 pb-1">
                <span className="text-gray-500">Digitally Signed By:</span>
                <span className="font-semibold text-gray-900">{user?.name}</span>
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Upload Signature Image (PNG/JPG)
                </label>
                <div className="border border-dashed border-gray-300 rounded-xl p-4 bg-white hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="moderator-sig-upload"
                  />
                  <label
                    htmlFor="moderator-sig-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-600">
                      {signatureFile ? signatureFile.name : 'Click to upload signature image'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-5 h-5" />
              {submitting ? 'Submitting Report...' : 'Submit Moderation Report'}
            </button>
            <button
              onClick={() => router.push('/moderator/dashboard')}
              className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
