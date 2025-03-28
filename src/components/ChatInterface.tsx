import React, { useState } from 'react';
import OpenAI from 'openai';

// Initialize OpenAI client (same as in studyGuideProcessor.ts)
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Use with caution, prefer backend
});

interface ChatInterfaceProps {
  overallSummary: string;
  currentSlide: number;
  currentSlideSummary: string;
}

export function ChatInterface({ 
  overallSummary, 
  currentSlide, 
  currentSlideSummary 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<{
    text: string;
    sender: 'user' | 'ai';
  }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateAIResponse = async (userMessage: string) => {
    try {
      setIsLoading(true);
      
      // Construct context-rich prompt
      const contextPrompt = `
        Course Overview: ${overallSummary}
        Current Slide (${currentSlide}): ${currentSlideSummary}
        Previous Conversation: ${messages.map(m => m.text).join('\n')}
        
        User Question: ${userMessage}
        
        Please provide a helpful, concise, and academic response that directly addresses the user's question while referencing the slide context.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant specialized in explaining academic slide content. Provide clear, precise answers."
          },
          {
            role: "user",
            content: contextPrompt
          }
        ],
        max_tokens: 250
      });

      return response.choices[0].message.content || 'I could not generate a response.';
    } catch (error) {
      console.error('OpenAI API Error:', error);
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
            {msg.text}
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