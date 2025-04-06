from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

from app.services.supabase_service import supabase_service
from app.routes.slide_deck import get_current_user

router = APIRouter()
security = HTTPBearer()

class SlideSummaryRequest(BaseModel):
    """
    Request model for creating or updating a slide summary
    """
    slide_deck_id: str
    slide_number: int
    summary_text: Optional[str] = None
    previous_slide_number: Optional[int] = None
    previous_summary: Optional[str] = None

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
        # Optional: Add validation to ensure user owns the slide deck
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
        # Here you would typically call an AI service to regenerate the summary
        # For now, we'll just update the existing record with the provided summary_text
        
        # Optional: Add validation to ensure user owns the slide deck
        slide_summary = supabase_service.create_slide_summary_record(
            slide_deck_id=summary_data.slide_deck_id,
            slide_number=summary_data.slide_number,
            summary_text=summary_data.summary_text
        )

        return {
            "message": "Slide summary regenerated successfully",
            "slide_summary": slide_summary
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