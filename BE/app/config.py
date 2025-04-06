from dotenv import load_dotenv
import os

load_dotenv()

class Settings:
    SUPABASE_URL: str = os.getenv('SUPABASE_URL')
    SUPABASE_SERVICE_KEY: str = os.getenv('SUPABASE_SERVICE_KEY')
    SUPABASE_BUCKET_NAME: str = 'slidedecks'

settings = Settings()