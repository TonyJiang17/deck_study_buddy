from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv
from openai import OpenAI

from app.routes.slide_deck import get_current_user

router = APIRouter()
security = HTTPBearer()

# Initialize OpenAI client
load_dotenv(override=True)
openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

class ChatRequest(BaseModel):
    """
    Request model for chat interactions
    """
    userMessage: str
    slideDeckId: Optional[str] = None
    slideNumber: Optional[int] = None
    slideSummary: Optional[str] = None
    chatHistory: Optional[List[str]] = None

@router.post("")
async def process_chat(
    chat_data: ChatRequest, 
    user_id: str = Depends(get_current_user)
):
    """
    Process a chat message and return AI response
    
    :param chat_data: Chat request data
    :param user_id: ID of the authenticated user
    :return: AI response
    """
    try:
        # Construct context-rich prompt
        context_prompt = f"""
        Current Slide ({chat_data.slideNumber}): {chat_data.slideSummary or "No summary available"}
        Previous Conversation: {' '.join(chat_data.chatHistory) if chat_data.chatHistory else ''}
        
        User Question: {chat_data.userMessage}
        
        Please provide a helpful, concise, and academic response that directly addresses the user's question while referencing the slide context.
        """
        
        # Call OpenAI API
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an academic assistant helping a student understand slide content."
                },
                {
                    "role": "user",
                    "content": context_prompt
                }
            ],
            max_tokens=250
        )
        
        ai_response = response.choices[0].message.content
        
        return {
            "response": ai_response
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))