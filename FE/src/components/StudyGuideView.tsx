import { Loader2, RefreshCcw } from 'lucide-react';
import React from 'react';
import type { StudySection } from '../types';
import { supabase } from '../lib/supabase';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface StudyGuideViewProps {
  sections: StudySection[];
  currentSlide: number;
  isProcessing: boolean;
  onSummaryRegenerate?: (slideNumber: number, newSummary: string) => void;
  chatHistory: string[];
  slideDeckId?: string;
}

export function StudyGuideView({ 
  sections, 
  currentSlide, 
  isProcessing,
  onSummaryRegenerate,
  chatHistory,
  slideDeckId
}: StudyGuideViewProps) {
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
  const [isRegeneratingSummary, setIsRegeneratingSummary] = React.useState(false);

  const regenerateSummary = async () => {
    try {
      setIsRegeneratingSummary(true);
      
      // Find the current slide's summary
      const currentSlideSummary = sections.find(s => s.slideNumber === currentSlide)?.summary || '';
      
      // Get auth token
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      if (!token) {
        console.error('No auth token available');
        throw new Error('Authentication required');
      }
      
      // Call backend API to regenerate summary
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/slide-summaries/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          slide_deck_id: slideDeckId,
          slide_number: currentSlide,
          summary_text: currentSlideSummary,
          chat_context: chatHistory
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${await response.text()}`);
      }
      
      const data = await response.json();
      const newSummary = data.summary_text;
      
      // If a callback is provided, call it with the new summary
      if (onSummaryRegenerate) {
        onSummaryRegenerate(currentSlide, newSummary);
      }

      return newSummary;
    } catch (error) {
      console.error('Summary Regeneration Error:', error);
      return 'Error regenerating summary.';
    } finally {
      setIsRegeneratingSummary(false);
    }
  };

  const toggleSection = (slideNumber: number) => {
    setExpandedSections((prev) =>
      prev.includes(slideNumber)
        ? prev.filter((n) => n !== slideNumber)
        : [...prev, slideNumber]
    );
  };

  // // Log render information
  // console.log('StudyGuideView Render:', {
  //   currentSlide,
  //   isProcessing,
  //   sectionsCount: sections.length
  // });

  return (
    <div className="h-full flex flex-col">
      {/* Persistent Top Banner */}
      <div className="bg-blue-50 p-2 border-b flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-blue-700">
            Slide {currentSlide} Summary
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={regenerateSummary}
            disabled={isProcessing || isRegeneratingSummary}
            className="text-blue-600 hover:bg-blue-100 p-1 rounded transition-colors flex items-center"
            title="Regenerate Summary"
          >
            {isRegeneratingSummary ? (
              <>
                <RefreshCcw className="w-4 h-4 animate-spin mr-1" /> 
                <span className="text-xs">Regenerating...</span>
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-1" />
                <span className="text-xs">Regenerate</span>
              </>
            )}
          </button>
          <span className="text-[0.6rem] bg-blue-100 text-blue-800 px-2 py-1 rounded">
            Slide {currentSlide} 
          </span>
          <span className="text-[0.6rem] bg-blue-100 text-blue-800 px-2 py-1 rounded">
            Slide {currentSlide} Summary
          </span>
          <span className="text-[0.6rem] bg-blue-100 text-blue-800 px-2 py-1 rounded">
            Chat History
          </span>
        </div>
      </div>

      {/* Content Area with Overflow */}
      <div className="flex-1 overflow-y-auto p-4">
        {isProcessing || isRegeneratingSummary ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">
              {isProcessing ? 'Generating summary...' : 'Regenerating summary...'}
            </span>
          </div>
        ) : (
          // Render existing sections for the current slide
          // Use a key based on the current slide to force re-render when slide changes
          <div key={`slide-summary-${currentSlide}`} className="text-gray-700 whitespace-pre-wrap">
            {sections
              .filter((section) => section.slideNumber === currentSlide)
              .map((section) => (
                <React.Fragment key={section.slideNumber}>
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
                </React.Fragment>
              ))}
          </div>
        )}

        {/* Additional debug information if no sections found */}
        {!isProcessing && sections.filter((section) => section.slideNumber === currentSlide).length === 0 && (
          <div className="bg-red-100 p-2 rounded">
            <p className="text-red-800">
              No sections found for slide {currentSlide}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}