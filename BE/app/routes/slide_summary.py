from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
import os
# import base64
from dotenv import load_dotenv
from openai import OpenAI

from app.services.supabase_service import supabase_service
from app.routes.slide_deck import get_current_user

router = APIRouter()
security = HTTPBearer()

# Initialize OpenAI client
load_dotenv(override=True)
openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

class SlideSummaryRequest(BaseModel):
    """
    Request model for creating or updating a slide summary
    """
    slide_deck_id: str
    slide_number: int
    summary_text: Optional[str] = None
    previous_slide_number: Optional[int] = None
    previous_summary: Optional[str] = None
    slide_image: Optional[str] = None  # Base64 encoded image
    previous_slide_image: Optional[str] = None  # Base64 encoded image
    chat_context: Optional[List[str]] = None  # For regeneration with chat context

@router.post("/generate")
async def generate_slide_summary(
    summary_data: SlideSummaryRequest, 
    user_id: str = Depends(get_current_user)
):
    """
    Generate or upsert a summary for the specified slide
    
    :param summary_data: Slide summary request data
    :param user_id: ID of the authenticated user
    :return: Created or updated slide summary record
    """
    try:
        # Check if we need to generate a summary using OpenAI
        if not summary_data.summary_text and summary_data.slide_image:
            # Prepare messages array based on whether we have previous context
            system_content = "You are an expert academic slide summarizer. Analyze the slide image and generate a concise, informative summary."
            if summary_data.previous_summary:
                system_content = "You are an expert academic slide summarizer. Analyze both the previous and current slides to generate a contextual, informative summary of the current slide. Focus exclusively on the content of the current slide."
            
            messages = [
                {
                    "role": "system",
                    "content": system_content
                }
            ]
            
            user_text = "Please generate a precise, academic summary of this slide."
            if summary_data.previous_summary:
                user_text = f"Previous Slide Summary: {summary_data.previous_summary}\n\nPlease generate a precise, academic summary of the current slide. Do not include content from the previous slide in your summary."
            
            user_content = [
                {
                    "type": "text",
                    "text": user_text
                }
            ]
            
            # Add previous slide image if available
            if summary_data.previous_slide_image:
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": summary_data.previous_slide_image}
                })
                
            # Add current slide image
            user_content.append({
                "type": "image_url",
                "image_url": {"url": summary_data.slide_image}
            })
            
            messages.append({
                "role": "user",
                "content": user_content
            })
            
            # Call OpenAI API
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=150
            )
            
            summary_data.summary_text = response.choices[0].message.content

        # Create or update the summary record in the database
        slide_summary = supabase_service.create_slide_summary_record(
            slide_deck_id=summary_data.slide_deck_id,
            slide_number=summary_data.slide_number,
            summary_text=summary_data.summary_text
        )

        return {
            "message": "Slide summary created/updated successfully",
            "slide_summary": slide_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/regenerate")
async def regenerate_slide_summary(
    summary_data: SlideSummaryRequest, 
    user_id: str = Depends(get_current_user)
):
    """
    Regenerate a summary for the specified slide
    
    :param summary_data: Slide summary request data
    :param user_id: ID of the authenticated user
    :return: Updated slide summary record
    """
    try:
        # Get existing summary if not provided
        existing_summary = summary_data.summary_text
        if not existing_summary:
            summaries = supabase_service.get_slide_summaries_by_deck_id(summary_data.slide_deck_id)
            for summary in summaries:
                if summary['slide_number'] == summary_data.slide_number:
                    existing_summary = summary['summary_text']
                    break
        
        # Construct context-rich prompt for summary regeneration
        chat_history_text = ""
        if summary_data.chat_context:
            chat_history_text = ' '.join(summary_data.chat_context)
            
        regeneration_prompt = f"""
            Current Slide: {summary_data.slide_number}
            Original Summary: {existing_summary or "No summary available"}
            
            Chat History Context: {chat_history_text}
            
            Please regenerate the slide summary, taking into account the conversation history. 
            Incorporate any new insights or clarifications from the chat while maintaining the 
            core content of the original summary. Be concise, academic, and precise.
            
            If the chat history provides additional context or reveals misunderstandings, 
            adjust the summary accordingly to provide a more accurate and comprehensive explanation.
        """
        
        # Call OpenAI API
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an academic assistant who can regenerate slide summaries based on conversation context. Maintain academic rigor while adapting to new insights."
                },
                {
                    "role": "user",
                    "content": regeneration_prompt
                }
            ],
            max_tokens=300
        )
        
        new_summary = response.choices[0].message.content
        
        # Update the summary in the database
        slide_summary = supabase_service.create_slide_summary_record(
            slide_deck_id=summary_data.slide_deck_id,
            slide_number=summary_data.slide_number,
            summary_text=new_summary
        )

        return {
            "message": "Slide summary regenerated successfully",
            "slide_summary": slide_summary,
            "summary_text": new_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def get_slide_summaries(
    slide_deck_id: str, 
    user_id: str = Depends(get_current_user)
):
    """
    Fetch all slide summaries for a given slide deck ordered by slide number
    
    :param slide_deck_id: ID of the slide deck
    :param user_id: ID of the authenticated user
    :return: List of slide summaries
    """
    try:
        # Optional: Add validation to ensure user owns the slide deck
        
        # Fetch slide summaries for the specified deck in order
        slide_summaries = supabase_service.get_slide_summaries_by_deck_id(slide_deck_id)
        
        return {
            "slide_summaries": slide_summaries
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))