from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from config.auth import get_current_user
from persistence.settings import get_all_settings, set_setting, get_setting
from config.settings import GOOGLE_API_KEY, GEMINI_MODEL

router = APIRouter(prefix="/api/v1/settings", tags=["Settings"])

class SettingsUpdate(BaseModel):
    google_api_key: Optional[str] = None
    gemini_model: Optional[str] = None

class SettingsResponse(BaseModel):
    google_api_key_configured: bool
    gemini_model: str

@router.get("/", response_model=SettingsResponse)
async def get_settings(current_user=Depends(get_current_user)):
    """Get the current settings (API key is obfuscated)."""
    api_key = get_setting("GOOGLE_API_KEY", GOOGLE_API_KEY)
    model = get_setting("GEMINI_MODEL", GEMINI_MODEL)
    
    is_configured = bool(api_key and api_key != "setup-in-ui")
    
    return SettingsResponse(
        google_api_key_configured=is_configured,
        gemini_model=model if model else "gemini-3.0-flash",
    )

@router.post("/")
async def update_settings(settings: SettingsUpdate, current_user=Depends(get_current_user)):
    """Update settings."""
    if settings.google_api_key is not None:
        set_setting("GOOGLE_API_KEY", settings.google_api_key)
    
    if settings.gemini_model is not None:
        set_setting("GEMINI_MODEL", settings.gemini_model)
    
    return {"status": "success"}

