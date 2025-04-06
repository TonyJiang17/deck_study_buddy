from fastapi import (
    APIRouter, 
    Depends, 
    HTTPException
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.supabase_service import supabase_service
from pydantic import BaseModel
from typing import Dict
from app.config import settings
from supabase import create_client


router = APIRouter()
security = HTTPBearer()

class SlideDeckUploadRequest(BaseModel):
    """
    Request model for uploading a slide deck
    """
    pdf_url: str
    title: str

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Validate Supabase JWT token and return user ID
    
    :param credentials: HTTP Authorization credentials
    :return: User ID
    """
    try:
        print(f"Full Authorization Header: {credentials}")
        print(f"Credentials Type: {type(credentials)}")
        print(f"Raw Token: {credentials.credentials}")

        # Create Supabase client for verification
        supabase = create_client(
            settings.SUPABASE_URL, 
            settings.SUPABASE_SERVICE_KEY
        )
        
        # Verify the token
        user = supabase.auth.get_user(credentials.credentials)
        print(user.user.id)
        
        return user.user.id
    except Exception as e:
        print(f"Authentication Error: {str(e)}")
        print(f"Error Type: {type(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/upload")
async def upload_slide_deck(
    slide_deck_data: SlideDeckUploadRequest, 
    user_id: str = Depends(get_current_user)
):
    """
    Create SlideDeck record from PDF URL
    
    :param slide_deck_data: Slide deck upload request data
    :param user_id: ID of the authenticated user
    :return: Created slide deck record
    """
    try:
        # Validate PDF URL (optional)
        if not slide_deck_data.pdf_url.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF URLs are allowed")

        # Create SlideDeck record
        slide_deck = supabase_service.create_slide_deck_record(
            user_id=user_id, 
            title=slide_deck_data.title, 
            pdf_url=slide_deck_data.pdf_url
        )

        return {
            "message": "Slide deck record created successfully",
            "slide_deck": slide_deck
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))        

@router.get("")
async def get_user_slide_decks(user_id: str = Depends(get_current_user)):
    """
    Get all slide decks for the authenticated user
    
    :param user_id: ID of the authenticated user
    :return: List of slide decks
    """
    try:
        # Fetch slide decks for the user
        slide_decks = supabase_service.get_slide_decks_by_user_id(user_id)
        
        return {
            "slide_decks": slide_decks
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{slide_deck_id}")
async def delete_slide_deck(
    slide_deck_id: str, 
    user_id: str = Depends(get_current_user)
):
    """
    Delete a slide deck and its associated summaries
    
    :param slide_deck_id: ID of the slide deck to delete
    :param user_id: ID of the authenticated user
    :return: Deletion confirmation
    """
    try:
        # First, verify the slide deck belongs to the user
        slide_deck = supabase_service.get_slide_deck_by_id(slide_deck_id)
        
        if not slide_deck or slide_deck['user_id'] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this slide deck")
        
        # Delete slide summaries first
        supabase_service.delete_slide_summaries_by_deck_id(slide_deck_id)
        
        # Delete the slide deck record
        supabase_service.delete_slide_deck(slide_deck_id)
        
        return {
            "message": "Slide deck and associated summaries deleted successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))