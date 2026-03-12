from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_auth_service, get_current_admin_user, get_current_user
from app.schemas.user import User, UserCreate, UserUpdate
from app.services.auth import AuthService

router = APIRouter(
    prefix="/users", 
    tags=["users"],
    dependencies=[Depends(get_current_admin_user)],
)


@router.get("/", response_model=list[User])
async def get_users(
    auth_service: AuthService = Depends(get_auth_service),
):
    return await auth_service.get_users()


@router.post("/", response_model=User)
async def create_user(
    user_in: UserCreate,
    auth_service: AuthService = Depends(get_auth_service),
):
    return await auth_service.register_user(
        username=user_in.username,
        password=user_in.password
    )


@router.patch("/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    auth_service: AuthService = Depends(get_auth_service),
    current_user: User = Depends(get_current_user),
):
    if str(current_user.id) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot update yourself"
        )

    update_data = user_update.model_dump(exclude_unset=True)
    return await auth_service.update_user(user_id, update_data)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    auth_service: AuthService = Depends(get_auth_service),
    current_user: User = Depends(get_current_user),
):
    if str(current_user.id) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete yourself"
        )
        
    await auth_service.delete_user(user_id)