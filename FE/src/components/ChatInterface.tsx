import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';


function normalizeLatexBrackets(text: string): string {
  return text
    .replace(/\\\((.+?)\\\)/g, (_match, inner) => `$${inner.trim()}$`)
    .replace(/\\\[(.+?)\\\]/gs, (_match, inner) => `$$${inner.trim()}$$`);
}

interface ChatInterfaceProps {
  currentSlide: number;
  currentSlideSummary: string;
  onMessagesChange?: (messages: string[]) => void;
  chatHistory?: string[];
  slideDeckId?: string;
}

export function ChatInterface({ 
  currentSlide, 
  currentSlideSummary,
  onMessagesChange,
  chatHistory,
  slideDeckId
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<{
    text: string;
    sender: 'user' | 'ai';
  }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Effect to notify parent component of message changes
  useEffect(() => {
    if (onMessagesChange) {
      // Pass full chat history with sender information
      const chatHistoryWithContext = messages.map(msg => 
        `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`
      );
      onMessagesChange(chatHistoryWithContext);
    }
  }, [messages, onMessagesChange]);

  const generateAIResponse = async (userMessage: string) => {
    try {
      setIsLoading(true);
      
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Prepare the chat history for the API request
      const formattedChatHistory = messages.map(m => m.text);
      
      // Call the backend API endpoint
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userMessage,
          slideDeckId,
          slideNumber: currentSlide,
          slideSummary: currentSlideSummary,
          chatHistory: formattedChatHistory
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get AI response');
      }
      
      const data = await response.json();
      return data.response || 'I could not generate a response.';
    } catch (error) {
      console.error('Chat API Error:', error);
      return 'Sorry, there was an error processing your request.';
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage = { text: inputMessage, sender: 'user' as const };
    setMessages(prev => [...prev, userMessage]);

    // Generate AI response
    const aiResponseText = await generateAIResponse(inputMessage);
    const aiResponse = { text: aiResponseText, sender: 'ai' as const };
    setMessages(prev => [...prev, aiResponse]);

    // Reset input
    setInputMessage('');
  };

  return (
    <div className="flex flex-col h-full border rounded-lg">
      {/* Chat Context Indicator */}
      <div className="bg-blue-50 p-2 border-b flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <span className="text-sm font-medium text-blue-700">
            Chat Context  
          </span>
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

      {/* Chat Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-2">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`p-2 rounded-lg max-w-[80%] ${
              msg.sender === 'user' 
                ? 'bg-blue-100 self-end ml-auto' 
                : 'bg-gray-100 self-start mr-auto'
            }`}
          >
            {/* {msg.text} */}
            <ReactMarkdown
                children={normalizeLatexBrackets(msg.text)}
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                // className="prose prose-sm max-w-none"
              />
          </div>
        ))}
        {isLoading && (
          <div className="p-2 bg-gray-100 self-start mr-auto rounded-lg">
            Generating response...
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t flex">
        <input 
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask a question about the slides..."
          className="flex-grow p-2 border rounded-l-lg"
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          disabled={isLoading}
        />
        <button 
          onClick={handleSendMessage}
          className={`p-2 rounded-r-lg ${
            isLoading 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-500 text-white'
          }`}
          disabled={isLoading}
        >
          Send
        </button>
      </div>
    </div>
  );
}