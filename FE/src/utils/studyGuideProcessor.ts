import type { StudyGuide, StudySection } from '../types';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Use with caution, prefer backend
});

async function generateSlideSummary(
  slideImage: File,
  previousContext?: { summary: string; image: File } // Optional previous slide context
): Promise<{ summary: string, content: string }> {
  try {
    // Convert current image to base64
    const imageBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(slideImage);
    });

    // Convert previous image to base64 if it exists
    let previousImageBase64 = '';
    if (previousContext?.image) {
      previousImageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(previousContext.image);
      });
    }

    // Prepare messages array based on whether we have previous context
    const messages = [
      {
        role: "system",
        content: previousContext 
          ? "You are an expert academic slide summarizer. Analyze both the previous and current slides to generate a contextual, informative summary of the current slide."
          : "You are an expert academic slide summarizer. Analyze the slide image and generate a concise, informative summary."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: previousContext
              ? `Previous Slide Summary: ${previousContext.summary}\n\nPlease generate a precise, academic summary of the current slide, taking into account the context from the previous slide.`
              : "Please generate a precise, academic summary of this slide."
          },
          ...(previousContext ? [
            {
              type: "image_url",
              image_url: { url: previousImageBase64 }
            }
          ] : []),
          {
            type: "image_url",
            image_url: { url: imageBase64 }
          }
        ]
      }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 150
    });

    const summary = response.choices[0].message.content || '';
    return {
      summary,
      content: imageBase64
    };
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return {
      summary: 'Unable to generate summary',
      content: ''
    };
  }
}

async function processFirstSlide(
  slideImage: File
): Promise<StudySection> {
  console.log('Processing first slide, image:', slideImage);
  try {
    const { summary, content } = await generateSlideSummary(slideImage);
    console.log('First slide summary:', summary);
    console.log('First slide content:', content);
    return {
      slideNumber: 1,
      content,
      summary
    };
  } catch (error) {
    console.error('Error processing first slide:', error);
    return {
      slideNumber: 1,
      content: '',
      summary: 'Failed to generate summary'
    };
  }
}

async function processNextSlide(
  slideNumber: number,
  currentSlideImage: File,
  previousSection: StudySection,
  previousSlideImage: File
): Promise<StudySection> {
  const { summary, content } = await generateSlideSummary(
    currentSlideImage,
    { summary: previousSection.summary, image: previousSlideImage }
  );

  return {
    slideNumber,
    content,
    summary
  };
}

export {
  processFirstSlide,
  processNextSlide
};