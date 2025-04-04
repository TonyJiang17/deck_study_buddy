import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { StudyGuideView } from './components/StudyGuideView';
import { PDFViewer } from './components/PDFViewer';
import { ChatInterface } from './components/ChatInterface'
import { Loader2 } from 'lucide-react';
import { Document, pdfjs } from 'react-pdf';
import type { StudyGuide, UploadStatus, ProcessingProgress, StudySection } from './types';
import { generateStudyGuide as generateSingleSlideGuide } from './utils/studyGuideProcessor';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function App() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [currentSlide, setCurrentSlide] = useState(1);
  const [studyGuide, setStudyGuide] = useState<StudyGuide>({ sections: [] });
  const [progress, setProgress] = useState<ProcessingProgress>({
    currentSlide: 0,
    totalSlides: 0,
    status: 'processing',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalSlides, setTotalSlides] = useState(0);

  const extractSlideImages = async (pdf: pdfjs.PDFDocumentProxy): Promise<File[]> => {
    const slideImages: File[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      const viewport = page.getViewport({ scale: 2.0 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context!, viewport }).promise;

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else throw new Error('Failed to convert canvas to blob');
        }, 'image/png');
      });

      const imageFile = new File([blob], `slide_${pageNum}.png`, { type: 'image/png' });
      slideImages.push(imageFile);
    }

    return slideImages;
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setUploadStatus('uploading');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    setUploadStatus('processing');

    try {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
        const pdf = await pdfjs.getDocument(typedArray).promise;
        const totalPages = pdf.numPages;

        const slideImages = await extractSlideImages(pdf);
        setTotalSlides(totalPages);
        
        const guide = await generateSingleSlideGuide(
          totalPages, 
          slideImages, 
          // Progress callback
          (progress) => {
            setProgress({
              currentSlide: progress.currentSlide,
              totalSlides: progress.totalSlides,
              status: progress.status
            });
          }
        );
        
        const finalGuide: StudyGuide = {
          sections: guide.sections,
        };

        setStudyGuide(finalGuide);
        // setProgress({ currentSlide: totalPages, totalSlides, status: 'complete' });
        setUploadStatus('complete');
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error processing PDF:', error);
      setUploadStatus('error');
    }
  };

  const handleSlideChange = (pageNumber: number) => {
    setCurrentSlide(pageNumber);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {uploadStatus === 'idle' ? (
        <div className="container mx-auto py-12">
          <h1 className="text-3xl font-bold text-center mb-8">AI Study Buddy</h1>
          <FileUpload onFileSelect={handleFileSelect} status={uploadStatus} />
        </div>
      ) : uploadStatus === 'uploading' || uploadStatus === 'processing' ? (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-lg text-gray-700 mb-2">
              {uploadStatus === 'uploading' ? 'Uploading your slides...' : 'Generating your study guide...'}
            </p>
            {uploadStatus === 'processing' && (
              <p className="text-sm text-gray-500">
                Processing slide {progress.currentSlide} of {progress.totalSlides}
              </p>
            )}
          </div>
        </div>
      ) : uploadStatus === 'error' ? (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center text-red-600">
            <p className="text-lg">An error occurred while processing your slides.</p>
            <button
              onClick={() => setUploadStatus('idle')}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <div className="h-screen flex">
          {/* PDF Viewer Panel (Left) */}
          <div className="flex-1 overflow-auto p-4 border-r"> {/* Left panel */}
            <PDFViewer 
              file={selectedFile}
              currentSlide={currentSlide}
              onSlideChange={handleSlideChange}
            />
          </div>

          {/* Study Guide and Chat Panel (Right) */}
          <div className="w-1/2 flex flex-col">
            <div className="flex-grow overflow-y-auto">
              <StudyGuideView
                sections={studyGuide.sections}
                currentSlide={currentSlide}
              />
            </div>
            <div className="h-1/3 border-t border-gray-200">
              <ChatInterface
                currentSlide={currentSlide}
                currentSlideSummary={
                  studyGuide.sections.find((s) => s.slideNumber === currentSlide)?.summary || ''
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
