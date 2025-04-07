import type { StudySection } from '../types';
import { supabase } from '../lib/supabase';

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

    // Get auth token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (!session?.access_token || !session?.refresh_token) {
      console.error('No auth token available');
      throw new Error('Authentication required');
    }
    
    // Call backend API to generate summary
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/slide-summaries/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'X-Refresh-Token': session?.refresh_token
      },
      body: JSON.stringify({
        slide_deck_id: 'temp', // Will be replaced with actual ID in process functions
        slide_number: 1, // Will be replaced with actual number in process functions
        slide_image: imageBase64,
        previous_slide_image: previousImageBase64 || undefined,
        previous_summary: previousContext?.summary || undefined
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${await response.text()}`);
    }
    
    const data = await response.json();
    return {
      summary: data.slide_summary.summary_text,
      content: imageBase64
    };
  } catch (error) {
    console.error('Summary generation error:', error);
    return {
      summary: 'Unable to generate summary',
      content: ''
    };
  }
}

async function processFirstSlide(
  slideImage: File,
  slideDeckId?: string
): Promise<StudySection> {
  console.log('Processing first slide, image:', slideImage);
  try {
    // Get auth token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (!session?.access_token || !session?.refresh_token) {
      console.error('No auth token available');
      throw new Error('Authentication required');
    }
    
    // Convert image to base64
    const imageBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(slideImage);
    });
    
    // Call backend API to generate summary
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/slide-summaries/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'X-Refresh-Token': session?.refresh_token
      },
      body: JSON.stringify({
        slide_deck_id: slideDeckId || 'temp',
        slide_number: 1,
        slide_image: imageBase64
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${await response.text()}`);
    }
    
    const data = await response.json();
    
    return {
      slideNumber: 1,
      content: imageBase64,
      summary: data.slide_summary.summary_text
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
  previousSlideImage: File,
  slideDeckId?: string
): Promise<StudySection> {
  try {
    // Get auth token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (!session?.access_token || !session?.refresh_token) {
      console.error('No auth token available');
      throw new Error('Authentication required');
    }
    
    // Convert images to base64
    const currentImageBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(currentSlideImage);
    });
    
    const previousImageBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(previousSlideImage);
    });
    
    // Call backend API to generate summary
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/slide-summaries/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'X-Refresh-Token': session.refresh_token
      },
      body: JSON.stringify({
        slide_deck_id: slideDeckId || 'temp',
        slide_number: slideNumber,
        slide_image: currentImageBase64,
        previous_slide_image: previousImageBase64,
        previous_summary: previousSection.summary,
        previous_slide_number: previousSection.slideNumber
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${await response.text()}`);
    }
    
    const data = await response.json();
    
    return {
      slideNumber,
      content: currentImageBase64,
      summary: data.slide_summary.summary_text
    };
  } catch (error) {
    console.error('Error processing slide:', error);
    return {
      slideNumber,
      content: '',
      summary: 'Failed to generate summary'
    };
  }
}

export {
  processFirstSlide,
  processNextSlide
};