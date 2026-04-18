'use client';

/**
 * @file file-upload.tsx
 * @description File upload component with drag & drop support.
 *
 * Features:
 * - Drag and drop files onto the zone
 * - Click to browse files
 * - Shows upload progress
 * - Preview images after upload
 * - List existing attachments
 * - Delete attachments
 */

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  X,
  FileText,
  Image,
  Trash2,
  Download,
  Loader2,
} from 'lucide-react';
import { useOrgApi } from '@/hooks/use-org-api';
import api from '@/lib/axios';

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: string;
  mimeType: string;
  uploader: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface FileUploadProps {
  taskId: string;
  attachments: Attachment[];
  onUpdate: () => void;
}

function formatFileSize(bytes: string): string {
  const n = parseInt(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/'))
    return <Image size={14} className="text-blue-500" />;
  return <FileText size={14} className="text-[#708a83]" />;
}

export function FileUpload({ taskId, attachments, onUpdate }: FileUploadProps) {
  const { orgId, buildUrl } = useOrgApi();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!orgId) return;
    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(buildUrl(`/tasks/${taskId}/attachments`), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [taskId, orgId],
  );

  const handleDelete = async (attachmentId: string) => {
    if (!orgId) return;
    setDeletingId(attachmentId);
    try {
      await api.delete(buildUrl(`/tasks/attachments/${attachmentId}`));
      onUpdate();
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-[#476e66] bg-[#476e66]/5'
            : 'border-[#dfdfe2] dark:border-slate-700 hover:border-[#708a83]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
            e.target.value = '';
          }}
        />
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 text-[#708a83]">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Uploading...</span>
          </div>
        ) : (
          <>
            <Upload size={16} className="text-[#bec0bf] mx-auto mb-1.5" />
            <p className="text-xs text-[#708a83]">
              Drag & drop or{' '}
              <span className="text-[#476e66] font-medium">browse</span>
            </p>
            <p className="text-xs text-[#bec0bf] mt-0.5">
              Images and PDFs up to 10MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Attachment List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[#dfdfe2] dark:border-slate-700 bg-[#fefefe] dark:bg-slate-900"
            >
              {/* Preview or icon */}
              {attachment.mimeType.startsWith('image/') ? (
                <img
                  src={attachment.fileUrl}
                  alt={attachment.fileName}
                  className="w-8 h-8 rounded object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 bg-[#f4f4f4] dark:bg-slate-800 rounded flex items-center justify-center shrink-0">
                  <FileIcon mimeType={attachment.mimeType} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                  {attachment.fileName}
                </p>
                <p className="text-xs text-[#bec0bf]">
                  {formatFileSize(attachment.fileSize)} · {attachment.uploader.firstName}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                
                  href={attachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded hover:bg-[#f4f4f4] dark:hover:bg-slate-800 text-[#708a83] transition-colors"
                >
                  <Download size={12} />
                </a>
                <button
                  onClick={() => handleDelete(attachment.id)}
                  disabled={deletingId === attachment.id}
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-[#bec0bf] hover:text-red-500 transition-colors"
                >
                  {deletingId === attachment.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}