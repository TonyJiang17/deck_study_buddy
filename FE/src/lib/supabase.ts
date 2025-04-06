// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Upload a PDF file directly to Supabase storage
 * @param file PDF file to upload
 * @param userId ID of the authenticated user
 * @returns Public URL of the uploaded file
 */
export const uploadPDFToStorage = async (file: File, userId: string): Promise<string> => {
  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const uniqueFilename = `${userId}/${crypto.randomUUID()}.${fileExt}`;
  
  // Upload file to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from(import.meta.env.VITE_SUPABASE_BUCKET_NAME)
    .upload(uniqueFilename, file);
    
  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    throw uploadError;
  }
  
  // Get public URL
  const { data } = await supabase.storage
    .from(import.meta.env.VITE_SUPABASE_BUCKET_NAME)
    .getPublicUrl(uniqueFilename);
    
  return data.publicUrl;
};

// /**
//  * Create a new SlideDeck record in the database
//  * @param userId ID of the authenticated user
//  * @param title Title of the slide deck
//  * @param pdfUrl Public URL of the uploaded PDF
//  * @returns Created slide deck record
//  */
// export const createSlideDeckRecord = async (
//   userId: string, 
//   title: string, 
//   pdfUrl: string
// ) => {
//   const slideDeckData = {
//     user_id: userId,
//     title,
//     pdf_url: pdfUrl,
//     created_at: new Date().toISOString()
//   };
  
//   const { data, error } = await supabase
//     .from('SlideDeck')
//     .insert(slideDeckData)
//     .select()
//     .single();
    
//   if (error) {
//     console.error('Error creating slide deck record:', error);
//     throw error;
//   }
  
//   return data;
// };