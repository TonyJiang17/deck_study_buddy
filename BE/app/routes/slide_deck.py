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
        