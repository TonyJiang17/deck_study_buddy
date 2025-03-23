import type { StudyGuide, StudySection } from '../types';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Use with caution, prefer backend
});

async function generateSlideSummary(
  slideImage: File, 
  previousContext: string
): Promise<{ summary: string, content: string }> {
  try {
    // Convert image to base64
    const imageBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(slideImage);
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system", 
          content: "You are an expert academic slide summarizer. Analyze the slide image and generate a concise, informative summary."
        },
        {
          role: "user", 
          content: [
            { 
              type: "text", 
              text: `Previous Slides Summary: ${previousContext}\n\nPlease generate a precise, academic summary of this slide.` 
            },
            { 
              type: "image_url", 
              image_url: { url: imageBase64 } 
            }
          ]
        }
      ],
      max_tokens: 150
    });

    const summary = response.choices[0].message.content || '';
    return { 
      summary, 
      content: imageBase64 // Store base64 image as content
    };
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return { 
      summary: 'Unable to generate summary', 
      content: '' 
    };
  }
}

async function processSlide(
  slideNumber: number,
  slideImage: File,
  previousSections: StudySection[]
): Promise<StudySection> {
  // Build context from previous slides
  const context = previousSections
    .map(section => section.summary)
    .join('\n');

  // Generate summary using OpenAI
  const { summary, content } = await generateSlideSummary(slideImage, context);

  return {
    slideNumber,
    content,
    summary
  };
}

function generateOverallSummary(sections: StudySection[]): string {
  return sections.map(section => section.summary).join('\n');
}

export async function generateStudyGuide(
  totalSlides: number, 
  slideImages: File[],
  onProgress?: (progress: { currentSlide: number, totalSlides: number, status: 'processing' | 'complete' }) => void
): Promise<StudyGuide> {
  const sections: StudySection[] = [];

  // for (let i = 1; i <= totalSlides; i++) {
  for (let i = 1; i <= 3; i++) {
    // Call progress callback if provided
    if (onProgress) {
      onProgress({
        currentSlide: i,
        totalSlides,
        status: 'processing'
      });
    }

    const section = await processSlide(i, slideImages[i-1], sections);
    sections.push(section);
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      currentSlide: totalSlides,
      totalSlides,
      status: 'complete'
    });
  }

  return {
    sections,
    overallSummary: generateOverallSummary(sections)
  };
}