import React, { useCallback } from 'react';
import { Upload } from 'lucide-react';
import { UploadStatus } from '../types';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  status: UploadStatus;
}

export function FileUpload({ onFileSelect, status }: FileUploadProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      className="w-full max-w-2xl mx-auto p-8"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
          disabled={status === 'uploading' || status === 'processing'}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <Upload className="w-12 h-12 text-gray-400 mb-4" />
          <span className="text-xl font-medium text-gray-700 mb-2">
            Upload your slide deck
          </span>
          <span className="text-sm text-gray-500">
            Drag and drop your PDF here, or click to select
          </span>
          <span className="text-xs text-gray-400 mt-2">
            Maximum file size: 100MB
          </span>
        </label>
      </div>
    </div>
  );
}