import React from 'react';
import { StudySection } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import { Loader2 } from 'lucide-react';
import 'katex/dist/katex.min.css';

interface StudyGuideViewProps {
  sections: StudySection[];
  currentSlide: number;
  isProcessing?: boolean;
}

export function StudyGuideView({ sections, currentSlide, isProcessing }: StudyGuideViewProps) {
  // Add more comprehensive logging
  React.useEffect(() => {
    console.log('StudyGuideView Effect Triggered:', {
      currentSlide,
      isProcessing,
      sectionsCount: sections.length,
      currentSlideSections: sections.filter(s => s.slideNumber === currentSlide)
    });
  }, [sections, currentSlide, isProcessing]);

  const [expandedSections, setExpandedSections] = React.useState<number[]>([]);

  const toggleSection = (slideNumber: number) => {
    setExpandedSections((prev) =>
      prev.includes(slideNumber)
        ? prev.filter((n) => n !== slideNumber)
        : [...prev, slideNumber]
    );
  };

  // Log render information
  console.log('StudyGuideView Render:', {
    currentSlide,
    isProcessing,
    sectionsCount: sections.length
  });

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Debug information */}
      {/* {isProcessing && (
        <div className="bg-yellow-100 p-2 mb-4 rounded">
          <p className="text-yellow-800">
            Processing slide {currentSlide}... Waiting for summary generation
          </p>
        </div>
      )} */}

      {/* Always render a container for the current slide */}
      <div className="mb-4 rounded-lg border border-gray-200">
        <div className="px-4 py-2 border-b border-gray-200">
          <span className="font-medium text-gray-800">Slide {currentSlide} Summary</span>
        </div>

        {isProcessing ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Generating summary...</span>
          </div>
        ) : (
          // Render existing sections for the current slide
          sections
            .filter((section) => section.slideNumber === currentSlide)
            .map((section) => (
              <div key={section.slideNumber} className="px-4 py-2">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {section.summary.split(/(\\\(.*?\\\)|\\\[.*?\\\])/).map((part, index) => {
                    try {
                      if (part.startsWith('\\(') && part.endsWith('\\)')) {
                        // Inline math
                        return <InlineMath key={index}>{part.slice(2, -2).trim()}</InlineMath>;
                      } else if (part.startsWith('\\[') && part.endsWith('\\]')) {
                        // Block math
                        return <BlockMath key={index}>{part.slice(2, -2).trim()}</BlockMath>;
                      }
                      // Regular text
                      return part;
                    } catch (error) {
                      // Fallback to plain text if LaTeX rendering fails
                      console.warn('LaTeX rendering error:', error);
                      return part;
                    }
                  })}
                </p>
              </div>
            ))
        )}
      </div>

      {/* Additional debug information if no sections found */}
      {!isProcessing && sections.filter((section) => section.slideNumber === currentSlide).length === 0 && (
        <div className="bg-red-100 p-2 rounded">
          <p className="text-red-800">
            No sections found for slide {currentSlide}
          </p>
        </div>
      )}
    </div>
  );
}