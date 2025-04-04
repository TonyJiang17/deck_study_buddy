import React from 'react';
import { StudySection } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface StudyGuideViewProps {
  sections: StudySection[];
  currentSlide: number;
}

export function StudyGuideView({ sections, currentSlide }: StudyGuideViewProps) {
  React.useEffect(() => {
    console.log('Sections:', sections);
  }, [sections]);
  
  const [expandedSections, setExpandedSections] = React.useState<number[]>([]);

  const toggleSection = (slideNumber: number) => {
    setExpandedSections((prev) =>
      prev.includes(slideNumber)
        ? prev.filter((n) => n !== slideNumber)
        : [...prev, slideNumber]
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Only show summary for current slide */}
      {sections
        .filter((section) => section.slideNumber === currentSlide)
        .map((section) => (
          <div
            key={section.slideNumber}
            className="mb-4 rounded-lg border border-gray-200"
          >
            <div className="px-4 py-2 border-b border-gray-200">
              <span className="font-medium text-gray-800">Slide {section.slideNumber} Summary</span>
            </div>
            <div className="px-4 py-2">
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
          </div>
        ))}
    </div>
  );
}