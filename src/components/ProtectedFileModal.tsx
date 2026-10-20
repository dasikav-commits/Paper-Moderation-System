'use client';

import { useEffect, useState } from 'react';
import {
  Lock,
  Download,
  Eye,
  EyeOff,
  X,
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export type ProtectedFileType = 'paperPdf' | 'paperWord' | 'schemePdf' | 'schemeWord';

interface ProtectedFileModalProps {
  paperId: string;
  subjectCode: string;
  subjectName: string;
  initialFileType?: ProtectedFileType;
  onClose: () => void;
}

const FILE_TYPE_LABELS: Record<ProtectedFileType, { title: string; ext: 'pdf' | 'docx' }> = {
  paperPdf: { title: 'Final Examination Paper (PDF)', ext: 'pdf' },
  paperWord: { title: 'Final Examination Paper (Word .docx)', ext: 'docx' },
  schemePdf: { title: 'Final Marking Scheme (PDF)', ext: 'pdf' },
  schemeWord: { title: 'Final Marking Scheme (Word .docx)', ext: 'docx' },
};

export function ProtectedFileModal({
  paperId,
  subjectCode,
  subjectName,
  initialFileType = 'paperPdf',
  onClose,
}: ProtectedFileModalProps) {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<ProtectedFileType>(initialFileType);
  const [passwordInput, setPasswordInput] = useState('');
  const [showInputPassword, setShowInputPassword] = useState(false);
  const [authorizedPassword, setAuthorizedPassword] = useState<string | null>(null);
  const [revealAuthorized, setRevealAuthorized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [busyMode, setBusyMode] = useState<'encrypted' | 'unlocked' | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    fetch(`/api/papers/${paperId}/download?userId=${encodeURIComponent(user.id)}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setAuthorizedPassword(data.filePassword || null);
        } else {
          const err = await res.json().catch(() => ({}));
          setError(err.error || 'Unauthorized access to finalized examination files.');
        }
      })
      .catch(() => {});
  }, [paperId, user]);

  const handleCopyAndFill = () => {
    if (!authorizedPassword) return;
    setPasswordInput(authorizedPassword);
    navigator.clipboard?.writeText(authorizedPassword).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAccessFile = async (mode: 'encrypted' | 'unlocked') => {
    if (!user) return;
    if (!passwordInput.trim()) {
      setError('Please enter the file protection password to proceed.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setBusyMode(mode);

    try {
      const res = await fetch(`/api/papers/${paperId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          password: passwordInput.trim(),
          fileType: selectedType,
          mode,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Incorrect password or unauthorized access.');
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const info = FILE_TYPE_LABELS[selectedType];
      const safeCode = subjectCode.replace(/\s+/g, '_');

      if (mode === 'unlocked' && info.ext === 'pdf') {
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        setSuccessMsg('Password verified — opened unlocked PDF preview in a new tab.');
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${
          mode === 'encrypted' ? 'Protected' : 'Unlocked'
        }_${safeCode}_${selectedType}.${info.ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSuccessMsg(
          mode === 'encrypted'
            ? `Downloaded password-encrypted ${info.ext.toUpperCase()} file! Opening this file in ${
                info.ext === 'pdf' ? 'your PDF viewer' : 'Microsoft Word / LibreOffice'
              } requires the same password.`
            : `Downloaded unlocked ${info.ext.toUpperCase()} copy.`
        );
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to download protected file.');
    } finally {
      setBusyMode(null);
    }
  };

  const currentMeta = FILE_TYPE_LABELS[selectedType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white px-6 py-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-amber-300 font-semibold">
                Password-Protected Final Document
              </span>
              <h2 className="text-lg font-bold leading-snug">
                {subjectCode} — {subjectName}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Document Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Select Finalized Document (PDF or Word)
            </label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as ProtectedFileType);
                setError('');
                setSuccessMsg('');
              }}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(Object.keys(FILE_TYPE_LABELS) as ProtectedFileType[]).map((key) => (
                <option key={key} value={key}>
                  {FILE_TYPE_LABELS[key].title}
                </option>
              ))}
            </select>
          </div>

          {/* Authorized HOD / Moderator Key Vault Box */}
          {authorizedPassword && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Authorized Key (HOD &amp; Moderator Only)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRevealAuthorized((v) => !v)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    {revealAuthorized ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {revealAuthorized ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyAndFill}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied & Filled' : 'Copy & Fill'}
                  </button>
                </div>
              </div>
              <p className="font-mono text-sm bg-white px-3 py-1.5 rounded-lg border border-blue-100 text-gray-900 tracking-wider">
                {revealAuthorized ? authorizedPassword : '••••••••••••'}
              </p>
            </div>
          )}

          {/* Enter Protection Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter File Protection Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showInputPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setError('');
                }}
                placeholder="Enter document password to unlock"
                className="w-full pl-10 pr-11 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowInputPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showInputPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-xs font-medium text-green-800">
              {successMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              disabled={busyMode !== null}
              onClick={() => handleAccessFile('encrypted')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {busyMode === 'encrypted' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download Password-Encrypted {currentMeta.ext.toUpperCase()}
            </button>

            <button
              type="button"
              disabled={busyMode !== null}
              onClick={() => handleAccessFile('unlocked')}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {busyMode === 'unlocked' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              {currentMeta.ext === 'pdf' ? 'Unlock & View' : 'Unlocked Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
