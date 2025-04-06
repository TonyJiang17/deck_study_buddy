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

    def create_slide_summary_record(
        self, 
        slide_deck_id: str, 
        slide_number: int, 
        summary_text: str = None, 
    ):
        """
        Create or update a slide summary record
        
        :param slide_deck_id: ID of the slide deck
        :param slide_number: Slide number to summarize
        :param summary_text: Generated summary text
        :return: Created or updated slide summary record
        """
        try:
            slide_summary_data = {
                'slide_deck_id': slide_deck_id,
                'slide_number': slide_number,
                'summary_text': summary_text,
                'updated_at': datetime.utcnow().isoformat()
            }
            
            # Upsert to handle both insert and update scenarios
            response = (
                self.supabase.table('SlideSummary')
                .upsert(slide_summary_data, on_conflict='slide_deck_id,slide_number')
                .execute()
            )
            
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Slide summary creation error: {e}")
            raise
            
    def get_slide_summaries_by_deck_id(self, slide_deck_id: str):
        """
        Get all slide summaries for a slide deck ordered by slide number
        
        :param slide_deck_id: ID of the slide deck
        :return: List of slide summaries
        """
        try:
            response = (
                self.supabase.table('SlideSummary')
                .select('*')
                .eq('slide_deck_id', slide_deck_id)
                .order('slide_number')
                .execute()
            )
            
            return response.data
        except Exception as e:
            print(f"Error fetching slide summaries: {e}")
            raise
            
    def get_slide_decks_by_user_id(self, user_id: str):
        """
        Get all slide decks for a user ordered by creation date (newest first)
        
        :param user_id: ID of the user
        :return: List of slide decks
        """
        try:
            response = (
                self.supabase.table('SlideDeck')
                .select('*')
                .eq('user_id', user_id)
                .order('created_at', desc=True)
                .execute()
            )
            
            return response.data
        except Exception as e:
            print(f"Error fetching slide decks: {e}")
            raise

supabase_service = SupabaseService()