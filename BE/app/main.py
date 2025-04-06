from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import slide_deck

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

# Optional: Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}