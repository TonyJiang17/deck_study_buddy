import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, uploadPDFToStorage } from './lib/supabase';
import { FileUpload } from './components/FileUpload';
import { StudyGuideView } from './components/StudyGuideView';
import { PDFViewer } from './components/PDFViewer';
import { ChatInterface } from './components/ChatInterface'
import { Loader2, ChevronLeft, ChevronRight, Plus, FileText, Trash2 } from 'lucide-react';
import { Document, pdfjs } from 'react-pdf';
import type { StudyGuide, UploadStatus, ProcessingProgress, StudySection } from './types';
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
  const [currentSlideDeckId, setCurrentSlideDeckId] = useState<string | null>(null);
  const [slideDecks, setSlideDecks] = useState<Array<{id: string, title: string, pdf_url: string}>>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showUploadUI, setShowUploadUI] = useState(true);
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
    // window.google.accounts.id.prompt();
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
      if (session?.user) {
        // User is logged in
        setUser(session.user);
        window.google?.accounts.id.cancel();
        
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
          window.google?.accounts.id.cancel(); // Hide One Tap UI
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          // Reinitialize Google One Tap after logout
          setTimeout(() => {
            initializeGoogleOneTap();
          }, 500); // Small delay to ensure auth state is fully updated
        }
      }
    );
  
    // Cleanup subscription
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // // Login function
  // const handleLogin = async () => {
  //   const { error } = await supabase.auth.signInWithOAuth({
  //     provider: 'google'
  //   });

  //   if (error) {
  //     console.error('Login error:', error);
  //   }
  // };

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
    setShowUploadUI(false);

    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
      if (sessionError) {
        console.error('Session Error:', sessionError);
        throw sessionError;
      }

      if (!session) {
        console.error('No active session');
        throw new Error('No active session');
      }

      // Upload the PDF to Supabase Storage
      const pdfUrl = await uploadPDFToStorage(file, user.id);
      console.log('PDF uploaded to:', pdfUrl);

      // Create a SlideDeck record in the database
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/slide-decks/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Refresh-Token': session.refresh_token
        },
        body: JSON.stringify({
          title: file.name.replace(/\.pdf$/i, ''),
          pdf_url: pdfUrl
        })
      });

      console.log('Response Status:', response.status);
      const responseData = await response.json();
      console.log('Response Data:', responseData);
      
      if (!response.ok) {
        throw new Error('Failed to create slide deck record');
      }
      
      // Save the slide deck ID for later use
      const slideDeckId = responseData.slide_deck.id;
      setCurrentSlideDeckId(slideDeckId);
      console.log('Slide Deck ID:', slideDeckId);
      
      // Refresh the list of slide decks
      loadUserSlideDecks();
      
      setUploadStatus('processing');

      // Process the PDF
      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
        const pdf = await pdfjs.getDocument(typedArray).promise;
        const totalPages = pdf.numPages;

        // Check if we already have summaries for this slide deck
        const existingSummaries = await fetchSlideSummaries(slideDeckId);
        
        if (existingSummaries.length > 0) {
          // If we have existing summaries, use them
          console.log('Using existing summaries from backend');
          setStudyGuide({ sections: existingSummaries });
          
          // We still need to capture the first slide image for the UI
          const firstSlideImage = await captureSlide(file, 1);
          if (firstSlideImage) {
            setSlideImages([firstSlideImage]);
          }
        } else {
          // If no existing summaries, process the first slide
          const firstSlideImage = await captureSlide(file, 1);
          console.log('First slide image:', firstSlideImage);
          if (firstSlideImage) {
            setSlideImages([firstSlideImage]);
            const firstSection = await processFirstSlide(firstSlideImage, slideDeckId);
            setStudyGuide({ sections: [firstSection] });
          } else {
            console.error('Failed to capture first slide image');
          }
        }
        
        setTotalSlides(totalPages);
        setUploadStatus('complete');
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error processing PDF:', error);
      setUploadStatus('error');
      setShowUploadUI(true);
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

    // Check if the new slide already has a summary
    const existingSummary = studyGuide.sections.find(s => s.slideNumber === newSlide);
    
    // Allow moving backward or to slides with existing summaries without processing
    if (newSlide < currentSlide || existingSummary) {
      setCurrentSlide(newSlide);
      return;
    }

    setIsProcessing(true);
    setCurrentSlide(newSlide);

    try {
      if (!selectedFile) throw new Error('No file selected');
      
      // Capture the new slide image
      const newSlideImage = await captureSlide(selectedFile, newSlide);
      if (!newSlideImage) throw new Error('Failed to capture slide image');

      // Check if we have the previous slide image
      const previousSlideImageName = `slide_${newSlide - 1}.png`;
      let previousSlideImage = slideImages.find(img => img.name === previousSlideImageName);
      
      // If previous slide image doesn't exist, capture it
      if (!previousSlideImage) {
        console.log(`Previous slide image ${previousSlideImageName} not found, capturing it now...`);
        previousSlideImage = await captureSlide(selectedFile, newSlide - 1);
        
        if (!previousSlideImage) {
          throw new Error('Failed to capture previous slide image');
        }
        
        // Add the previous slide image to our collection
        setSlideImages(prev => [...prev, previousSlideImage!]);
      }

      // Add the new slide image to our collection
      setSlideImages(prev => [...prev, newSlideImage]);

      // Get the previous slide's summary for context
      const previousSection = studyGuide.sections.find(s => s.slideNumber === newSlide - 1);
      if (!previousSection) throw new Error('Previous summary data not found');

      // Process the new slide
      const newSection = await processNextSlide(
        newSlide,
        newSlideImage,
        previousSection,
        previousSlideImage,
        currentSlideDeckId || undefined
      );

      setStudyGuide(prev => ({ sections: [...prev.sections, newSection] }));
    } catch (error) {
      console.error('Error processing slide:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to regenerate summary for a specific slide
  const handleSummaryRegenerate = async (slideNumber: number, newSummary: string) => {
    try {
      // Update the summary in the local state
      setStudyGuide(prev => ({
        ...prev,
        sections: prev.sections.map(section => 
          section.slideNumber === slideNumber 
            ? { ...section, summary: newSummary } 
            : section
        )
      }));
      
      // If we have a slide deck ID, update the summary in the backend
      if (currentSlideDeckId) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('No active session for summary regeneration');
          return;
        }
        
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/slide-summaries/regenerate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'X-Refresh-Token': session.refresh_token
          },
          body: JSON.stringify({
            slide_deck_id: currentSlideDeckId,
            slide_number: slideNumber,
            summary_text: newSummary
          })
        });
        
        if (!response.ok) {
          console.error('Failed to regenerate summary on backend:', await response.text());
        } else {
          console.log('Summary regenerated successfully on backend');
        }
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
    }
  };

  // Function to update chat history
  const handleMessagesChange = useCallback((newMessage: [string]) => {
    setChatHistory(newMessage);
  }, []);

  // Function to extract chat history
  const extractChatHistory = () => {
    return chatHistory;
  };

  // Function to fetch slide summaries from the backend
  const fetchSlideSummaries = async (slideDeckId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session for fetching slide summaries');
        return [];
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/slide-summaries?slide_deck_id=${slideDeckId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'X-Refresh-Token': session.refresh_token
        }
      });
      
      if (!response.ok) {
        console.error('Failed to fetch slide summaries:', await response.text());
        return [];
      }
      
      const data = await response.json();
      console.log('Fetched slide summaries:', data);
      
      // Convert the backend format to StudySection format
      return data.slide_summaries.map((summary: any) => ({
        slideNumber: summary.slide_number,
        summary: summary.summary_text,
        content: '' // We don't have the image content from the backend
      }));
    } catch (error) {
      console.error('Error fetching slide summaries:', error);
      return [];
    }
  };

  // Function to load existing slide decks for the user
  const loadUserSlideDecks = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session for loading slide decks');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/slide-decks`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'X-Refresh-Token': session.refresh_token
        }
      });
      
      if (!response.ok) {
        console.error('Failed to fetch slide decks:', await response.text());
        return;
      }
      
      const data = await response.json();
      
      // Store the slide decks in state
      if (data.slide_decks && Array.isArray(data.slide_decks)) {
        setSlideDecks(data.slide_decks);
      }
    } catch (error) {
      console.error('Error loading slide decks:', error);
    }
  };

  // Call loadUserSlideDecks when the user is authenticated
  useEffect(() => {
    if (user) {
      loadUserSlideDecks();
    }
  }, [user]);

  // Function to delete a slide deck
  const deleteUserSlideDeck = async (slideDeckId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/slide-decks/${slideDeckId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'X-Refresh-Token': session.refresh_token
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete slide deck');
      }
      
      // Remove the deleted slide deck from the list
      setSlideDecks(prevDecks => prevDecks.filter(deck => deck.id !== slideDeckId));
      
      // If the current slide deck was deleted, reset to upload UI
      if (currentSlideDeckId === slideDeckId) {
        showNewSlideDeckUI();
      }
      
      // Optional: Show a success toast or notification
      console.log('Slide deck deleted successfully');
    } catch (error) {
      console.error('Error deleting slide deck:', error);
      // Optional: Show an error toast or notification
    }
  };

  // Function to load a specific slide deck
  const loadSlideDeck = useCallback(async (slideDeckId: string, pdfUrl: string) => {
    try {
      setIsProcessing(true);
      setCurrentSlide(1); // Reset to first slide when loading a new deck
      setCurrentSlideDeckId(slideDeckId);
      setShowUploadUI(false);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/slide-summaries?slide_deck_id=${slideDeckId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          }
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch slide summaries:', await response.text());
        return;
      }

      const data = await response.json();
      console.log('Fetched slide summaries:', data);

      // Convert the backend format to StudySection format
      const summaries = data.slide_summaries.map((summary: any) => ({
        slideNumber: summary.slide_number,
        summary: summary.summary_text,
        content: '' // We don't have the image content from the backend
      }));

      setStudyGuide({ sections: summaries });

      // Fetch the PDF file from the URL
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error('Failed to fetch PDF file');
      }

      const pdfBlob = await pdfResponse.blob();
      const pdfFile = new File([pdfBlob], 'slide_deck.pdf', { type: 'application/pdf' });
      setSelectedFile(pdfFile);

      // Process the PDF to get total pages and first slide image
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
        const pdf = await pdfjs.getDocument(typedArray).promise;
        const totalPages = pdf.numPages;
        setTotalSlides(totalPages);

        // Capture the first slide image for display
        const firstSlideImage = await captureSlide(pdfFile, 1);
        if (firstSlideImage) {
          setSlideImages([firstSlideImage]);
        }

        setUploadStatus('complete');
        setIsProcessing(false);
      };

      fileReader.readAsArrayBuffer(pdfFile);
    } catch (error) {
      console.error('Error loading slide deck:', error);
      setUploadStatus('error');
      setIsProcessing(false);
      setShowUploadUI(true);
    }
  }, [supabase.auth]);

  // Function to reset to upload UI
  const showNewSlideDeckUI = () => {
    setShowUploadUI(true);
    setCurrentSlideDeckId(null);
    setSelectedFile(null);
    setStudyGuide({ sections: [] });
    setSlideImages([]);
    setUploadStatus('idle');
    setCurrentSlide(1);
  };

  // Render login/logout buttons or app content
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      <span className="ml-2">Loading...</span>
    </div>;
  }

  return (
    <div>
      {user ? (
        <div className="flex min-h-screen bg-gray-50">
          {/* Sidebar and Toggle Button */}
          <div className="relative h-screen">
            {/* Toggle Button (Only visible when sidebar is collapsed) */}
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="absolute top-4 left-4 z-20 p-2 bg-white rounded-md shadow-md hover:bg-gray-100"
              >
                <ChevronRight size={18} />
              </button>
            )}
            
            {/* Sidebar (Conditionally Visible) */}
            <div className={`absolute h-full bg-white shadow-md transition-all duration-300 ${isSidebarOpen ? 'w-64 opacity-100 visible' : 'w-0 opacity-0 invisible'} flex flex-col z-10 overflow-hidden`}>
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="font-semibold">My Slide Decks</h2>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {slideDecks.length === 0 ? (
                  <div className="p-4 text-gray-500 text-sm">No slide decks found</div>
                ) : (
                  <ul className="py-2">
                    {slideDecks.map(deck => (
                      <li key={deck.id} className="px-4 py-2 group flex items-center justify-between">
                        <button 
                          onClick={() => loadSlideDeck(deck.id, deck.pdf_url)}
                          className={`flex-grow text-left flex items-center p-2 rounded hover:bg-gray-100 ${currentSlideDeckId === deck.id ? 'bg-blue-50 text-blue-600' : ''}`}
                        >
                          <FileText size={16} className="mr-2" />
                          <span className="truncate">{deck.title}</span>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent loading the deck when deleting
                            deleteUserSlideDeck(deck.id);
                          }}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded ml-2 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="p-4 border-t">
                <button 
                  onClick={showNewSlideDeckUI}
                  className="flex items-center justify-center p-2 w-full rounded bg-blue-500 text-white hover:bg-blue-600"
                >
                  <Plus size={18} />
                  <span className="ml-2">New Slide Deck</span>
                </button>
              </div>
              
              <div className="p-4 border-t">
                <button 
                  onClick={handleLogout}
                  className="flex items-center justify-center p-2 w-full rounded border border-gray-300 hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
          {/* Main Content */}
          <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-12'}`}>
            <div className="min-h-screen">
              {showUploadUI && uploadStatus === 'idle' ? (
                <div className="container mx-auto py-12">
                  <h1 className="text-3xl font-bold text-center mb-2">SlideSense</h1>
                  <FileUpload onFileSelect={handleFileSelect} status={uploadStatus} />
                </div>
              ) : uploadStatus === 'uploading' ? (
                <div className="container mx-auto py-12 flex flex-col items-center">
                  <h1 className="text-3xl font-bold text-center mb-8">SlideSense</h1>
                  <div className="flex items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="ml-2">Uploading your PDF...</span>
                  </div>
                </div>
              ) : uploadStatus === 'processing' ? (
                <div className="container mx-auto py-12 flex flex-col items-center">
                  <h1 className="text-3xl font-bold text-center mb-8">SlideSense</h1>
                  <div className="flex items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="ml-2">Processing your slides...</span>
                  </div>
                </div>
              ) : uploadStatus === 'error' ? (
                <div className="container mx-auto py-12 flex flex-col items-center">
                  <div className="flex justify-center items-center mb-8">
                    <h1 className="text-3xl font-bold">SlideSense</h1>
                  </div>
                  <div className="text-center">
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
                        slideDeckId={currentSlideDeckId || undefined}
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
          </div>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
          <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
            <h1 className="text-2xl font-bold text-center mb-6">
              SlideSense <span className="text-sm font-normal text-gray-500 ml-2">by Tony</span>
            </h1>
            <p className="mb-6 text-center text-gray-600">
              Make sense of your slides — fast.
            </p>
            {/* <div className="flex justify-center">
              <button
                onClick={handleLogin}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Sign in with Google
              </button>
            </div> */}
            {!user && <div ref={googleButtonRef} className="mt-4 flex justify-center"></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
