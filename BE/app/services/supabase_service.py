from supabase import create_client, Client
from app.config import settings
import uuid
from datetime import datetime

class SupabaseService:
    def __init__(self):
        self.supabase: Client = create_client(
            settings.SUPABASE_URL, 
            settings.SUPABASE_SERVICE_KEY
        )
        print("Service key prefix:", settings.SUPABASE_SERVICE_KEY)

    def create_slide_deck_record(self, user_id: str, title: str, pdf_url: str):
        """
        Create a new SlideDeck record in the database
        
        :param user_id: ID of the user
        :param title: Title of the slide deck
        :param pdf_url: Public URL of the uploaded PDF
        :return: Created slide deck record
        """
        print(f"Creating slide deck for user ID: {user_id}")
        print(f"User ID type: {type(user_id)}")
        try:
            
            slide_deck_data = {
                'user_id': user_id,
                'title': title,
                'pdf_url': pdf_url,
                'created_at': datetime.utcnow().isoformat()
            }
            print(slide_deck_data)
            response = self.supabase.table('SlideDeck').insert(slide_deck_data).execute()
            
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Database insert error: {e}")
            raise

supabase_service = SupabaseService()