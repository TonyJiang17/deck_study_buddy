import { Loader2, RefreshCcw } from 'lucide-react';
import React from 'react';
import type { StudySection } from '../types';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// --- Utility: Convert LaTeX-style \( \) and \[ \] to Markdown-style $ $
function normalizeLatexBrackets(text: string): string {
  return text
    .replace(/\\\((.+?)\\\)/g, (_match, inner) => `$${inner.trim()}$`)
    .replace(/\\\[(.+?)\\\]/gs, (_match, inner) => `$$${inner.trim()}$$`);
}

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
  slideDeckId,
}: StudyGuideViewProps) {
  const [isRegeneratingSummary, setIsRegeneratingSummary] = React.useState(false);

  const regenerateSummary = async () => {
    try {
      setIsRegeneratingSummary(true);

      const currentSlideSummary = sections.find(s => s.slideNumber === currentSlide)?.summary || '';
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token || !session?.refresh_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/slide-summaries/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Refresh-Token': session.refresh_token,
        },
        body: JSON.stringify({
          slide_deck_id: slideDeckId,
          slide_number: currentSlide,
          summary_text: currentSlideSummary,
          chat_context: chatHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${await response.text()}`);
      }

      const data = await response.json();
      const newSummary = data.summary_text;

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

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="bg-blue-50 p-2 border-b flex items-center justify-between">
        <span className="text-sm font-medium text-blue-700">
          Slide {currentSlide} Summary
        </span>
        <div className="flex items-center space-x-1">
          <button
            onClick={regenerateSummary}
            disabled={isProcessing || isRegeneratingSummary}
            className="text-blue-600 hover:bg-blue-50 p-2 rounded flex items-center"
            title="Regenerate Summary"
          >
            {isRegeneratingSummary ? (
              <>
                <RefreshCcw className="w-4 h-4 animate-spin mr-1" />
                <span className="text-xs">Refreshing...</span>
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-1" />
                <span className="text-xs">Refresh</span>
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {(isProcessing || isRegeneratingSummary) ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">
              {isProcessing ? 'Generating summary...' : 'Regenerating summary...'}
            </span>
          </div>
        ) : (
          <div key={`slide-summary-${currentSlide}`} className="prose max-w-none text-gray-700 whitespace-pre-wrap">
            {sections
              .filter((section) => section.slideNumber === currentSlide)
              .map((section) => (
                <ReactMarkdown
                  key={section.slideNumber}
                  children={normalizeLatexBrackets(section.summary)}
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                />
              ))}
          </div>
        )}

        {!isProcessing &&
          sections.filter((section) => section.slideNumber === currentSlide).length === 0 && (
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
