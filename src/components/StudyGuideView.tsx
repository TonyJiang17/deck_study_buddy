import React from 'react';
import { StudySection } from '../types';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface StudyGuideViewProps {
  sections: StudySection[];
  currentSlide: number;
  overallSummary: string;
}

export function StudyGuideView({ sections, currentSlide, overallSummary }: StudyGuideViewProps) {
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
      {/* Overall Summary Section */}
      <div className="mb-6 bg-white rounded-lg border border-blue-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900">Course Overview</h2>
        </div>
        {/* <p className="text-gray-700 text-sm leading-relaxed">{overallSummary}</p> */}
        <p className="text-gray-700 whitespace-pre-wrap">
          {overallSummary.split(/(\\\(.*?\\\)|\\\[.*?\\\])/).map((part, index) => {
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

      {/* Individual Slide Sections */}
      {sections.map((section) => (
        <div
          key={section.slideNumber}
          className={`mb-4 rounded-lg border ${
            currentSlide === section.slideNumber
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200'
          }`}
        >
          <button
            className="w-full px-4 py-2 flex items-center justify-between text-left"
            onClick={() => toggleSection(section.slideNumber)}
          >
            <span className="font-medium">Slide {section.slideNumber}</span>
            {expandedSections.includes(section.slideNumber) ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
          {/* {expandedSections.includes(section.slideNumber) && (
            <div className="px-4 py-2 border-t border-gray-200">
              <div className="space-y-2">
                <p className="text-gray-700">{section.summary}</p>
              </div>
            </div>
          )} */}
          {expandedSections.includes(section.slideNumber) && (
            <div className="px-4 py-2 border-t border-gray-200">
              <div className="space-y-2">
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
          )}
        </div>
      ))}
    </div>
  );
}