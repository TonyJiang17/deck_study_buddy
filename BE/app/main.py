from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import slide_deck, slide_summary

app = FastAPI()

# CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(slide_deck.router, prefix="/api/slide-decks", tags=["slide-decks"])
app.include_router(slide_summary.router, prefix="/api/slide-summaries", tags=["slide-summaries"])

# Optional: Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}