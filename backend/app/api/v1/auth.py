from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt, JWTError

from app.api.deps import get_auth_service, get_current_active_user
from app.core.config import settings
from app.schemas.token import Token, TokenPayload
from app.schemas.user import User, UserCreate, UserStatus
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/status")
async def auth_status(
    auth_service: AuthService = Depends(get_auth_service),
):
    initialized = await auth_service.has_users()
    return initialized


@router.post("/bootstrap", response_model=User)
async def bootstrap_admin(
    user_in: UserCreate,
    auth_service: AuthService = Depends(get_auth_service),
):
    return await auth_service.bootstrap_admin(
        username=user_in.username,
        password=user_in.password,
    )


@router.post("/login", response_model=Token)
async def login(
    auth_service: AuthService = Depends(get_auth_service),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    user = await auth_service.authenticate(
        form_data.username, 
        form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    elif user.status != UserStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not approved",
        )
    
    return auth_service.create_tokens(user.id)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    auth_service: AuthService = Depends(get_auth_service),
):
    try:
        payload = jwt.decode(
            refresh_token, 
            settings.secret_key, 
            algorithms=[settings.algorithm]
        )
        if not payload.get("refresh"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid refresh token",
            )
        token_data = TokenPayload(**payload)
    except (JWTError, Exception):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    
    return auth_service.create_tokens(token_data.sub)


@router.get("/me", response_model=User)
async def get_me(
    current_user: User = Depends(get_current_active_user),
):
    return current_user
