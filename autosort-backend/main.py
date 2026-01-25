import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routes import router as api_router
from app.api.auth_routes import router as auth_router
from app.gmail.push import router as webhook_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("AutoSort backend starting...")
    yield
    # Shutdown
    print("AutoSort backend shutting down...")


app = FastAPI(
    title="AutoSort API",
    description="Email sorting automation backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for desktop app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for Tauri app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(api_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/auth")
app.include_router(webhook_router, prefix="/webhooks")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "autosort-backend"}
