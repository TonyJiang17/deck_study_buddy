import React, { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { StudyGuideView } from './components/StudyGuideView';
import { PDFViewer } from './components/PDFViewer';
import { ChatInterface } from './components/ChatInterface'
import { Loader2 } from 'lucide-react';
import { Document, pdfjs } from 'react-pdf';
import type { StudyGuide, UploadStatus, ProcessingProgress, StudySection } from './types';
import { generateStudyGuide as generateSingleSlideGuide } from './utils/studyGuideProcessor';
import { processFirstSlide, processNextSlide } from './utils/studyGuideProcessor';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [canNavigateNext, setCanNavigateNext] = useState(true);
  const [slideImages, setSlideImages] = useState<File[]>([]);

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
    console.log('File selected:', file.name);
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

        const firstSlideImage = await captureSlide(file, 1);
        console.log('First slide image:', firstSlideImage);
        if (firstSlideImage) {
          setSlideImages([firstSlideImage]);
          const firstSection = await processFirstSlide(firstSlideImage);
          console.log('First section:', firstSection);
          setStudyGuide({ sections: [firstSection] });
        } else {
          console.error('Failed to capture first slide image');
        }
        
        setTotalSlides(totalPages);
        setUploadStatus('complete');
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error processing PDF:', error);
      setUploadStatus('error');
    }
  };

  const captureSlide = async (file: File, slideNumber: number): Promise<File | null> => {
    console.log('Capturing slide:', slideNumber);
    try {
      const fileReader = new FileReader();
      const typedArray = await new Promise<Uint8Array>((resolve, reject) => {
        fileReader.onload = (e) => {
          const result = e.target?.result;
          if (result instanceof ArrayBuffer) {
            resolve(new Uint8Array(result));
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
      });
  
      const pdf = await pdfjs.getDocument(typedArray).promise;
      const page = await pdf.getPage(slideNumber);
  
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not get canvas context');
  
      const viewport = page.getViewport({ scale: 2.0 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
  
      await page.render({ canvasContext: context, viewport }).promise;
  
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert canvas to blob'));
        }, 'image/png');
      });
  
      return new File([blob], `slide_${slideNumber}.png`, { type: 'image/png' });
    } catch (error) {
      console.error('Error capturing slide:', error);
      return null;
    }
  };
  

  const handleSlideChange = async (newSlide: number) => {
    // Don't allow moving forward if we're processing or don't have the current slide's summary
    if (newSlide > currentSlide && !studyGuide.sections.find(s => s.slideNumber === currentSlide)) {
      return;
    }

    // Allow moving backward
    if (newSlide < currentSlide) {
      setCurrentSlide(newSlide);
      return;
    }

    // Moving forward
    
    // Check if we already have the next slide's summary
    if (studyGuide.sections.find(s => s.slideNumber === newSlide)) {
      setCurrentSlide(newSlide);
      return;
    }

    // Immediately update current slide
    setCurrentSlide(newSlide);
    
    // Start processing the new slide
    setIsProcessing(true);
    try {
      // Capture the new slide image
      const newSlideImage = await captureSlide(selectedFile!, newSlide);
      if (!newSlideImage) throw new Error('Failed to capture slide');

      // Update state
      setSlideImages(prev => [...prev, newSlideImage]);

      // Get the previous slide's data
      const previousSection = studyGuide.sections.find(s => s.slideNumber === newSlide - 1);
      const previousSlideImage = slideImages[newSlide - 2];
      
      // console.log(currentSlide, previousSection);
      if (!previousSection ) throw new Error('Previous summary data not found');
      if (!previousSlideImage) throw new Error('Previous slide image not found');

      // Process the new slide
      const newSection = await processNextSlide(
        newSlide,
        newSlideImage,
        previousSection,
        previousSlideImage
      );

      setStudyGuide(prev => ({ sections: [...prev.sections, newSection] }));
    } catch (error) {
      console.error('Error processing slide:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to regenerate summary for a specific slide
  const handleSummaryRegenerate = (slideNumber: number, newSummary: string) => {
    // Update the summary for the specific slide in the studyGuide state
    setStudyGuide(prev => ({
      ...prev,
      sections: prev.sections.map(section => 
        section.slideNumber === slideNumber 
          ? { ...section, summary: newSummary } 
          : section
      )
    }));
  };

  // Extract chat history from ChatInterface
  const extractChatHistory = () => {
    // This is a placeholder. You'll need to modify ChatInterface to expose its messages
    // For now, we'll return an empty array
    return [];
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
              disabled={isProcessing}
            />
          </div>

          {/* Study Guide and Chat Panel (Right) */}
          <div className="w-1/2 flex flex-col">
            <div className="flex-grow overflow-y-auto">
              <StudyGuideView
                sections={studyGuide.sections}
                currentSlide={currentSlide}
                isProcessing={isProcessing}
                onSummaryRegenerate={handleSummaryRegenerate}
              />
            </div>
            <div className="h-1/2 border-t border-gray-200">
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
