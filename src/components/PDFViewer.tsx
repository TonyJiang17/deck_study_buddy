import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  file: File | null;
  currentSlide: number;
  onSlideChange: (pageNumber: number) => void;
}

export function PDFViewer({ file, currentSlide, onSlideChange }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  function changePage(offset: number) {
    const newPage = currentSlide + offset;
    if (newPage >= 1 && newPage <= numPages) {
      onSlideChange(newPage);
    }
  }

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">No PDF file selected</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          }
        >
          <Page
            pageNumber={currentSlide}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg"
            width={500}
          />
        </Document>
      </div>
      
      <div className="h-16 flex items-center justify-between px-4 bg-white border-t">
        <button
          onClick={() => changePage(-1)}
          disabled={currentSlide <= 1}
          className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <p className="text-sm text-gray-600">
          Page {currentSlide} of {numPages}
        </p>
        
        <button
          onClick={() => changePage(1)}
          disabled={currentSlide >= numPages}
          className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}