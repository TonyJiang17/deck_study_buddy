export interface StudyGuide {
  sections: StudySection[];
  overallSummary: string;
}

export interface StudySection {
  slideNumber: number;
  content: string;
  summary: string;
}

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

export interface ProcessingProgress {
  currentSlide: number;
  totalSlides: number;
  status: 'processing' | 'complete';
}