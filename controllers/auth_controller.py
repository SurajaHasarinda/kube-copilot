"""
Auth controller — handles API key → JWT token exchange.

POST /api/v1/auth/token
"""

from fastapi import APIRouter, HTTPException, status

from config.auth import create_access_token
from config.schemas import TokenRequest, TokenResponse
from config.settings import JWT_ACCESS_TOKEN_EXPIRE_MINUTES
from services.auth_service import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.post("/token", response_model=TokenResponse)
async def get_token(request: TokenRequest):
    """
    Authenticate with username and password and receive a JWT bearer token.
    Use this token in the `Authorization: Bearer <token>` header for all
    subsequent requests.
    """
    if not auth_service.authenticate_user(request.username, request.password):
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


from fastapi import Depends
from config.auth import verify_jwt_token
from config.schemas import ChangePasswordRequest, ChangeUsernameRequest, UserInfoResponse

@router.get("/me", response_model=UserInfoResponse)
async def get_current_user(token_payload: dict = Depends(verify_jwt_token)):
    """
    Get the current authenticated user's information.
    """
    username = token_payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )
    
    user_info = auth_service.get_user_info(username)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    
    return UserInfoResponse(**user_info)


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    token_payload: dict = Depends(verify_jwt_token)
):
    """
    Change the password for the currently authenticated user.
    """
    username = token_payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )
        
    success = auth_service.change_password(
        username, request.current_password, request.new_password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid current password.",
        )
        
    return {"message": "Password updated successfully."}


@router.post("/change-username")
async def change_username(
    request: ChangeUsernameRequest,
    token_payload: dict = Depends(verify_jwt_token)
):
    """
    Change the username for the currently authenticated user.
    Returns a new token with the updated username.
    """
    old_username = token_payload.get("sub")
    if not old_username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )
    
    success = auth_service.change_username(
        old_username, request.new_username, request.password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password or username already exists.",
        )
    
    # Generate new token with updated username
    new_token = create_access_token(
        data={"sub": request.new_username, "type": "access"}
    )
    
    return {
        "message": "Username updated successfully.",
        "access_token": new_token,
        "expires_in_minutes": JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    }
