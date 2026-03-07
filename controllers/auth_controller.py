"""
Auth controller — handles API key → JWT token exchange.

POST /api/v1/auth/token
"""

from fastapi import APIRouter, HTTPException, status

from config.auth import create_access_token
from config.schemas import TokenRequest, TokenResponse
from config.settings import JWT_ACCESS_TOKEN_EXPIRE_MINUTES, ADMIN_USERNAME, ADMIN_PASSWORD

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.post("/token", response_model=TokenResponse)
async def get_token(request: TokenRequest):
    """
    Authenticate with username and password and receive a JWT bearer token.
    Use this token in the `Authorization: Bearer <token>` header for all
    subsequent requests.
    """
    if request.username != ADMIN_USERNAME or request.password != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )
    
    token = create_access_token(
        data={"sub": request.username, "type": "access"}
    )
    return TokenResponse(
        access_token=token,
        expires_in_minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    )
