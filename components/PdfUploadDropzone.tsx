import React, { useCallback, useState } from 'react';
import { ArrowUpTrayIcon, DocumentTextIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { t } from '../i18n/en';

interface PdfUploadDropzoneProps {
  onFileSelect: (file: File | null) => void;
  loading: boolean;
  fileName: string | null;
  error: string | null;
}

const PdfUploadDropzone: React.FC<PdfUploadDropzoneProps> = ({ onFileSelect, loading, fileName, error }) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert('Please drop a PDF file.'); // Simple alert for non-PDF files
      }
      e.dataTransfer.clearData();
    }
  }, [onFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert('Please select a PDF file.'); // Simple alert for non-PDF files
      }
    }
  }, [onFileSelect]);

  const handleRemoveFile = useCallback(() => {
    onFileSelect(null);
  }, [onFileSelect]);

  return (
    <div
      className={`relative p-6 border-2 border-dashed rounded-lg text-center transition-colors duration-200
        ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white'}
        ${error ? 'border-red-500 bg-red-50' : ''}
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="pdf-upload"
        accept="application/pdf"
        onChange={handleFileInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={loading}
      />
      {loading ? (
        <div className="flex flex-col items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-700"></div>
          <p className="mt-3 text-sm text-gray-600 font-medium">{t('processing_pdf')}</p>
        </div>
      ) : fileName ? (
        <div className="flex items-center justify-between space-x-2 text-indigo-700 font-medium">
          <div className="flex items-center space-x-2 truncate">
            <DocumentTextIcon className="h-6 w-6" />
            <span className="truncate">{fileName}</span>
          </div>
          <button
            onClick={handleRemoveFile}
            className="text-red-500 hover:text-red-700 transition-colors duration-200"
            aria-label="Remove PDF file"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4">
          <ArrowUpTrayIcon className="h-10 w-10 text-gray-400" />
          <p className="mt-3 text-sm text-gray-600 font-medium">{t('upload_pdf_instructions')}</p>
        </div>
      )}
    </div>
  );
};

export default PdfUploadDropzone;