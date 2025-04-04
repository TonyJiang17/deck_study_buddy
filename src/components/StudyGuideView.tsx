import React from 'react';
import { StudySection } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import { Loader2 } from 'lucide-react';
import { RefreshCcw } from 'lucide-react';
import 'katex/dist/katex.min.css';
import OpenAI from 'openai';


const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Use with caution, prefer backend
});

interface StudyGuideViewProps {
  sections: StudySection[];
  currentSlide: number;
  isProcessing: boolean;
  onSummaryRegenerate?: (slideNumber: number, newSummary: string) => void;
  chatHistory: string[];
}

export function StudyGuideView({ 
  sections, 
  currentSlide, 
  isProcessing,
  onSummaryRegenerate,
  chatHistory
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
      
      // Construct context-rich prompt for summary regeneration
      const regenerationPrompt = `
        Current Slide: ${currentSlide}
        Original Summary: ${currentSlideSummary}
        
        Chat History Context: ${chatHistory.join('\n')}
        
        Please regenerate the slide summary, taking into account the conversation history. 
        Incorporate any new insights or clarifications from the chat while maintaining the 
        core content of the original summary. Be concise, academic, and precise.
        
        If the chat history provides additional context or reveals misunderstandings, 
        adjust the summary accordingly to provide a more accurate and comprehensive explanation.
      `;
      console.log('Regenerating summary prompt', regenerationPrompt)
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an academic assistant who can regenerate slide summaries based on conversation context. Maintain academic rigor while adapting to new insights."
          },
          {
            role: "user",
            content: regenerationPrompt
          }
        ],
        max_tokens: 300
      });

      const newSummary = response.choices[0].message.content || 'Unable to regenerate summary.';
      
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
    <div className="h-full overflow-y-auto p-4">

      {/* Always render a container for the current slide */}
      <div className="mb-4 rounded-lg border border-gray-200">
        <div className="px-4 py-2 border-b border-gray-200 flex items-center">
          <span className="font-medium text-gray-800 flex-grow">Slide {currentSlide} Summary</span>
          <div className="flex items-center space-x-2">
            <button 
              onClick={regenerateSummary}
              disabled={isProcessing || isRegeneratingSummary}
              className="text-blue-600 hover:bg-blue-100 p-1 rounded transition-colors"
              title="Regenerate Summary"
            >
              {isRegeneratingSummary ? (
                <RefreshCcw className="w-4 h-4 animate-spin" /> 
              ) : (
                <RefreshCcw className="w-4 h-4" />
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