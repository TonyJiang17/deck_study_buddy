import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { FileUpload } from './components/FileUpload';
import { StudyGuideView } from './components/StudyGuideView';
import { PDFViewer } from './components/PDFViewer';
import { ChatInterface } from './components/ChatInterface'
import { Loader2 } from 'lucide-react';
import { Document, pdfjs } from 'react-pdf';
import type { StudyGuide, UploadStatus, ProcessingProgress, StudySection } from './types';
import { generateStudyGuide as generateSingleSlideGuide } from './utils/studyGuideProcessor';
import { processFirstSlide, processNextSlide } from './utils/studyGuideProcessor';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function App() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [currentSlide, setCurrentSlide] = useState(1);
  const [studyGuide, setStudyGuide] = useState<StudyGuide>({ sections: [] });
  const [progress, setProgress] = useState<ProcessingProgress>({
    currentSlide: 0,
    totalSlides: 0,
    status: 'processing',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalSlides, setTotalSlides] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [canNavigateNext, setCanNavigateNext] = useState(true);
  const [slideImages, setSlideImages] = useState<File[]>([]);
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Generate nonce for Google ID token sign-in
  const generateNonce = async (): Promise<string[]> => {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const encoder = new TextEncoder();
    const encodedNonce = encoder.encode(nonce);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return [nonce, hashedNonce];
  };

  // Initialize Google One Tap
  const initializeGoogleOneTap = async () => {
    if (!window.google || !googleButtonRef.current) return;

    const [nonce, hashedNonce] = await generateNonce();

    // Check if there's already an existing session
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      return; // User is already logged in
    }

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response: CredentialResponse) => {
        try {
          // Send ID token to Supabase
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce,
          });

          if (error) throw error;
          console.log('Successfully logged in with Google One Tap');
        } catch (error) {
          console.error('Error logging in with Google One Tap', error);
        }
      },
      nonce: hashedNonce,
      use_fedcm_for_prompt: true,
    });

    // Render the Google Sign In button
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
    });

    // Also display the One Tap UI
    window.google.accounts.id.prompt();
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
  
    script.onload = () => {
      const waitForRef = setInterval(() => {
        if (googleButtonRef.current && window.google?.accounts?.id) {
          clearInterval(waitForRef);
          initializeGoogleOneTap(); // now the ref exists
        }
      }, 100); // check every 100ms until ready
    };
  
    document.body.appendChild(script);
  
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  

  useEffect(() => {
    // Check current session
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('hello', session?.user.id)
      if (session?.user) {
        // User is logged in
        setUser(session.user);
        
        // Optional: Check if user exists in your database
        // If not, create a new user record
        const { data: existingUser, error } = await supabase
          .from('User')  // Assuming you have a User table
          .select('*')
          .eq('id', session.user.id)
          .single();

        console.log(existingUser)
  
        if (!existingUser) {
          // First-time login: create user record
          const { error: insertError } = await supabase
            .from('User')
            .insert({
              id: session.user.id, // match auth.users.id
              email: session.user.email,
              display_name: session.user.user_metadata?.full_name,
            });
  
          if (insertError) {
            console.error('Error creating user:', insertError);
          }
        }
      }
      
      setIsLoading(false);
    };
  
    checkUser();
  
    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN') {
          // Additional first-time login logic can go here
          console.log('User signed in for the first time or logged in again');
        }
      }
    );
  
    // Cleanup subscription
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Login function
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google'
    });

    if (error) {
      console.error('Login error:', error);
    }
  };

  // Logout function
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
    }
  };

  const handleFileSelect = async (file: File) => {
    console.log('File selected:', file.name);
    setSelectedFile(file);
    setUploadStatus('uploading');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    setUploadStatus('processing');

    try {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
        const pdf = await pdfjs.getDocument(typedArray).promise;
        const totalPages = pdf.numPages;

        const firstSlideImage = await captureSlide(file, 1);
        console.log('First slide image:', firstSlideImage);
        if (firstSlideImage) {
          setSlideImages([firstSlideImage]);
          const firstSection = await processFirstSlide(firstSlideImage);
          console.log('First section:', firstSection);
          setStudyGuide({ sections: [firstSection] });
        } else {
          console.error('Failed to capture first slide image');
        }
        
        setTotalSlides(totalPages);
        setUploadStatus('complete');
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error processing PDF:', error);
      setUploadStatus('error');
    }
  };

  const captureSlide = async (file: File, slideNumber: number): Promise<File | null> => {
    console.log('Capturing slide:', slideNumber);
    try {
      const fileReader = new FileReader();
      const typedArray = await new Promise<Uint8Array>((resolve, reject) => {
        fileReader.onload = (e) => {
          const result = e.target?.result;
          if (result instanceof ArrayBuffer) {
            resolve(new Uint8Array(result));
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
      });
  
      const pdf = await pdfjs.getDocument(typedArray).promise;
      const page = await pdf.getPage(slideNumber);
  
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not get canvas context');
  
      const viewport = page.getViewport({ scale: 2.0 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
  
      await page.render({ canvasContext: context, viewport }).promise;
  
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert canvas to blob'));
        }, 'image/png');
      });
  
      return new File([blob], `slide_${slideNumber}.png`, { type: 'image/png' });
    } catch (error) {
      console.error('Error capturing slide:', error);
      return null;
    }
  };
  

  const handleSlideChange = async (newSlide: number) => {
    console.log(chatHistory)
    // Don't allow moving forward if we're processing or don't have the current slide's summary
    if (newSlide > currentSlide && !studyGuide.sections.find(s => s.slideNumber === currentSlide)) {
      return;
    }

    // Allow moving backward
    if (newSlide < currentSlide) {
      setCurrentSlide(newSlide);
      return;
    }

    // Moving forward
    
    // Check if we already have the next slide's summary
    if (studyGuide.sections.find(s => s.slideNumber === newSlide)) {
      setCurrentSlide(newSlide);
      return;
    }

    // Immediately update current slide
    setCurrentSlide(newSlide);
    
    // Start processing the new slide
    setIsProcessing(true);
    try {
      // Capture the new slide image
      const newSlideImage = await captureSlide(selectedFile!, newSlide);
      if (!newSlideImage) throw new Error('Failed to capture slide');

      // Update state
      setSlideImages(prev => [...prev, newSlideImage]);

      // Get the previous slide's data
      const previousSection = studyGuide.sections.find(s => s.slideNumber === newSlide - 1);
      const previousSlideImage = slideImages[newSlide - 2];
      
      // console.log(currentSlide, previousSection);
      if (!previousSection ) throw new Error('Previous summary data not found');
      if (!previousSlideImage) throw new Error('Previous slide image not found');

      // Process the new slide
      const newSection = await processNextSlide(
        newSlide,
        newSlideImage,
        previousSection,
        previousSlideImage
      );

      setStudyGuide(prev => ({ sections: [...prev.sections, newSection] }));
    } catch (error) {
      console.error('Error processing slide:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to regenerate summary for a specific slide
  const handleSummaryRegenerate = (slideNumber: number, newSummary: string) => {
    // Update the summary for the specific slide in the studyGuide state
    setStudyGuide(prev => ({
      ...prev,
      sections: prev.sections.map(section => 
        section.slideNumber === slideNumber 
          ? { ...section, summary: newSummary } 
          : section
      )
    }));
  };

  // Function to update chat history
  const handleMessagesChange = useCallback((newMessage: [string]) => {
    setChatHistory(newMessage);
  }, []);

  // Function to extract chat history
  const extractChatHistory = () => {
    return chatHistory;
  };

  // Render login/logout buttons or app content
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {user ? (
        <>
          <button onClick={handleLogout}>Logout</button>
          <div className="min-h-screen bg-gray-50">
            {uploadStatus === 'idle' ? (
              <div className="container mx-auto py-12">
                <h1 className="text-3xl font-bold text-center mb-8">AI Study Buddy</h1>
                <FileUpload onFileSelect={handleFileSelect} status={uploadStatus} />
              </div>
            ) : uploadStatus === 'uploading' || uploadStatus === 'processing' ? (
              <div className="h-screen flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                  <p className="text-lg text-gray-700 mb-2">
                    {uploadStatus === 'uploading' ? 'Uploading your slides...' : 'Generating your study guide...'}
                  </p>
                  {uploadStatus === 'processing' && (
                    <p className="text-sm text-gray-500">
                      Processing slide {progress.currentSlide} of {progress.totalSlides}
                    </p>
                  )}
                </div>
              </div>
            ) : uploadStatus === 'error' ? (
              <div className="h-screen flex items-center justify-center">
                <div className="text-center text-red-600">
                  <p className="text-lg">An error occurred while processing your slides.</p>
                  <button
                    onClick={() => setUploadStatus('idle')}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-screen flex">
                {/* PDF Viewer Panel (Left) */}
                <div className="flex-1 overflow-auto p-4 border-r"> {/* Left panel */}
                  <PDFViewer 
                    file={selectedFile}
                    currentSlide={currentSlide}
                    onSlideChange={handleSlideChange}
                    disabled={isProcessing}
                  />
                </div>

                {/* Study Guide and Chat Panel (Right) */}
                <div className="w-1/2 flex flex-col">
                  <div className="flex-grow overflow-y-auto">
                    <StudyGuideView
                      sections={studyGuide.sections}
                      currentSlide={currentSlide}
                      isProcessing={isProcessing}
                      onSummaryRegenerate={handleSummaryRegenerate}
                      chatHistory={chatHistory}
                    />
                  </div>
                  <div className="h-1/2 border-t border-gray-200">
                    <ChatInterface
                      currentSlide={currentSlide}
                      currentSlideSummary={
                        studyGuide.sections.find((s) => s.slideNumber === currentSlide)?.summary || ''
                      }
                      onMessagesChange={handleMessagesChange}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="h-screen flex items-center justify-center flex-col bg-gray-50">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">AI Study Buddy</h1>
            <p className="text-gray-600">Your intelligent companion for studying slide decks</p>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-md">
            {/* <h2 className="text-xl font-semibold mb-6 text-center">Sign in to continue</h2> */}
            <div ref={googleButtonRef} className="flex justify-center" />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
