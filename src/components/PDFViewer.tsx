import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  file: File | null;
  currentSlide: number;
  onSlideChange: (pageNumber: number) => void;
}

export function PDFViewer({ file, currentSlide, onSlideChange }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Dynamically update width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth(); // Initial set
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">No PDF file selected</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" ref={containerRef}>
      {/* Slide Container */}
      <div className="flex-1 overflow-hidden flex items-center justify-center bg-gray-50 relative p-2">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          className="w-full h-full flex items-center justify-center"
          loading={<Loader2 className="w-8 h-8 animate-spin text-blue-500" />}
        >
          <Page
            pageNumber={currentSlide}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg"
            width={containerWidth - 2} // Subtract padding (2 * 16px)
          />
        </Document>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center p-2 bg-white">
        <button 
          onClick={() => changePage(-1)} 
          disabled={currentSlide <= 1}
          className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
        >
          <ChevronLeft />
        </button>
        <span className="text-sm text-gray-600">
          Page {currentSlide} of {numPages}
        </span>
        <button 
          onClick={() => changePage(1)} 
          disabled={currentSlide >= numPages}
          className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}
