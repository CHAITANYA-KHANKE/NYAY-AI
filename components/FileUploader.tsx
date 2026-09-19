'use client';

/**
 * components/FileUploader.tsx — Drag & drop PDF upload (PRD F1).
 * Client-side validation mirrors the server rules (PDF only, size cap),
 * with idle / dragging / error / success visual states (brain/08).
 */

import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { AlertCircle, FileText, Loader2, Upload, X } from 'lucide-react';
import Magnetic from '@/components/ui/Magnetic';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants';

interface FileUploaderProps {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function FileUploader({
  selectedFile,
  onFileSelect,
  onClear,
  disabled = false,
}: FileUploaderProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        const code = rejections[0]?.errors[0]?.code;
        setError(
          code === 'file-too-large'
            ? `File exceeds the ${MAX_FILE_SIZE_MB}MB limit.`
            : code === 'too-many-files'
              ? 'Please upload one PDF at a time.'
              : 'Please upload a PDF file only.',
        );
        return;
      }
      const file = accepted[0];
      if (file) {
        setError(null);
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE_BYTES,
    maxFiles: 1,
    multiple: false,
    noClick: true, // we render our own labelled button (clearer a11y)
    noKeyboard: true,
    disabled,
  });

  if (selectedFile) {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 animate-fade-in-up"
        aria-live="polite"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink" title={selectedFile.name}>
            {selectedFile.name}
          </p>
          <p className="text-xs text-slate-500">{formatSize(selectedFile.size)} · PDF ready</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label="Remove selected file"
          className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-red-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps({
          className: `flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
            isDragReject
              ? 'border-red-300 bg-red-50'
              : isDragActive
                ? 'border-brand-400 bg-brand-50'
                : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/50'
          } ${disabled ? 'pointer-events-none opacity-60' : ''}`,
        })}
      >
        <input {...getInputProps({ 'aria-label': 'Upload PDF file' })} />
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-card ${
            isDragReject ? 'bg-red-100 text-red-500' : 'bg-white text-brand-600'
          }`}
        >
          {disabled ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-6 w-6" aria-hidden="true" />
          )}
        </span>
        <p className="mt-4 text-sm font-semibold text-ink">
          {isDragActive ? 'Drop your PDF here…' : 'Drag & drop your legal document'}
        </p>
        <p className="mt-1 text-xs text-slate-500">PDF only · up to {MAX_FILE_SIZE_MB}MB · up to 50 pages</p>
        <Magnetic className="mt-5">
          <button
            type="button"
            onClick={open}
            disabled={disabled}
            aria-label="Browse files to upload a PDF"
            className="btn-shine inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-pop transition hover:from-brand-700 hover:to-indigo-700 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Browse PDF
          </button>
        </Magnetic>
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-xs font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
