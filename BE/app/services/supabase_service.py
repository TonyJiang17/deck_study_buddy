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
        # print("Service key prefix:", settings.SUPABASE_SERVICE_KEY)
        
    def _get_client_with_auth(self, user_token=None, refresh_token=None):
        """
        Get a Supabase client with user authentication if token is provided
        
        :param user_token: JWT token of the authenticated user
        :return: Supabase client
        """
        if not user_token:
            # Return the service client for admin operations
            return self.supabase
            
        try:
            # Create a client with the service key
            client = create_client(
                settings.SUPABASE_URL,  
                settings.SUPABASE_ANON_KEY
            )
            client.auth.set_session(access_token=user_token, refresh_token=refresh_token or '')
            return client
        except Exception as e:
            print(f"Error authenticating with user token: {e}")
            return self.supabase

    def create_slide_deck_record(self, user_id: str, title: str, pdf_url: str, user_token=None, refresh_token=None):
        """
        Create a new SlideDeck record in the database
        
        :param user_id: ID of the user
        :param title: Title of the slide deck
        :param pdf_url: Public URL of the uploaded PDF
        :param user_token: JWT token of the authenticated user
        :return: Created slide deck record
        """
        try:
            slide_deck_data = {
                'user_id': user_id,
                'title': title,
                'pdf_url': pdf_url,
                'created_at': datetime.utcnow().isoformat()
            }
            print(slide_deck_data)
            
            client = self._get_client_with_auth(user_token, refresh_token)
            response = client.table('SlideDeck').insert(slide_deck_data).execute()
            
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Database insert error: {e}")
            raise

    def create_slide_summary_record(
        self, 
        slide_deck_id: str, 
        slide_number: int, 
        summary_text: str = None,
        user_token=None,
        refresh_token=None
    ):
        """
        Create or update a slide summary record
        
        :param slide_deck_id: ID of the slide deck
        :param slide_number: Slide number to summarize
        :param summary_text: Generated summary text
        :param user_token: JWT token of the authenticated user
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
            client = self._get_client_with_auth(user_token, refresh_token)
            response = (
                client.table('SlideSummary')
                .upsert(slide_summary_data, on_conflict='slide_deck_id,slide_number')
                .execute()
            )
            
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Slide summary creation error: {e}")
            raise
            
    def get_slide_summaries_by_deck_id(self, slide_deck_id: str, user_token=None, refresh_token=None):
        """
        Get all slide summaries for a slide deck ordered by slide number
        
        :param slide_deck_id: ID of the slide deck
        :param user_token: JWT token of the authenticated user
        :return: List of slide summaries
        """
        try:
            client = self._get_client_with_auth(user_token, refresh_token)
            response = (
                client.table('SlideSummary')
                .select('*')
                .eq('slide_deck_id', slide_deck_id)
                .order('slide_number')
                .execute()
            )
            
            return response.data
        except Exception as e:
            print(f"Error fetching slide summaries: {e}")
            raise
            
    def get_slide_decks_by_user_id(self, user_id: str, user_token=None, refresh_token=None):
        """
        Get all slide decks for a user ordered by creation date (newest first)
        
        :param user_id: ID of the user
        :param user_token: JWT token of the authenticated user
        :return: List of slide decks
        """
        try:
            client = self._get_client_with_auth(user_token, refresh_token)
            response = (
                client.table('SlideDeck')
                .select('*')
                .eq('user_id', user_id)
                .order('created_at', desc=True)
                .execute()
            )
            
            return response.data
        except Exception as e:
            print(f"Error fetching slide decks: {e}")
            raise

    def get_slide_deck_by_id(self, slide_deck_id: str, user_token=None, refresh_token=None):
        """
        Get a slide deck by its ID
        
        :param slide_deck_id: ID of the slide deck
        :param user_token: JWT token of the authenticated user
        :return: Slide deck record or None
        """
        try:
            client = self._get_client_with_auth(user_token, refresh_token)
            response = (
                client.table('SlideDeck')
                .select('*')
                .eq('id', slide_deck_id)
                .execute()
            )
            
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error fetching slide deck: {e}")
            raise

    def delete_slide_summaries_by_deck_id(self, slide_deck_id: str, user_token=None, refresh_token=None):
        """
        Delete all slide summaries for a given slide deck
        
        :param slide_deck_id: ID of the slide deck
        :param user_token: JWT token of the authenticated user
        """
        try:
            client = self._get_client_with_auth(user_token, refresh_token)
            response = (
                client.table('SlideSummary')
                .delete()
                .eq('slide_deck_id', slide_deck_id)
                .execute()
            )
            
            return response
        except Exception as e:
            print(f"Error deleting slide summaries: {e}")
            raise

    def delete_slide_deck(self, slide_deck_id: str, user_token=None, refresh_token=None):
        """
        Delete a slide deck record
        
        :param slide_deck_id: ID of the slide deck to delete
        :param user_token: JWT token of the authenticated user
        """
        try:
            client = self._get_client_with_auth(user_token, refresh_token)
            response = (
                client.table('SlideDeck')
                .delete()
                .eq('id', slide_deck_id)
                .execute()
            )
            
            return response
        except Exception as e:
            print(f"Error deleting slide deck: {e}")
            raise

supabase_service = SupabaseService()