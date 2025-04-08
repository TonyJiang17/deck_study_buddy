from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import slide_deck, slide_summary, chat

app = FastAPI()

origins = [
    "https://deck-study-buddy.vercel.app",  # e.g. https://myapp.vercel.app
    "http://localhost:5173",  # for local dev if needed
]

# CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, #["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(slide_deck.router, prefix="/api/slide-decks", tags=["slide-decks"])
app.include_router(slide_summary.router, prefix="/api/slide-summaries", tags=["slide-summaries"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])

# Optional: Health check endpoint
# @app.get("/health")
# def health_check():
#     return {"status": "healthy"}