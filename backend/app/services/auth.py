from typing import Any
from app.core import security
from app.models.user import User, UserRole, UserStatus
from app.repositories.user_repo import UserRepo
from app.schemas.token import Token


class AuthService:
    def __init__(self, user_repo: UserRepo):
        self.user_repo = user_repo

    async def authenticate(self, username: str, password: str) -> User | None:
        user = await self.user_repo.get_by_username(username)
        if not user:
            return None
        if not security.verify_password(password, user.hashed_password):
            return None
        return user

    async def has_users(self) -> bool:
        return await self.user_repo.count_users() > 0

    async def bootstrap_admin(self, username: str, password: str) -> User:
        if await self.has_users():
            raise ValueError("System already initialized")

        return await self.register_user(
            username, 
            password, 
            role=UserRole.ADMIN, 
            status=UserStatus.APPROVED
        )

    async def register_user(
        self, 
        username: str,
        password: str,
        role: UserRole = UserRole.USER, 
        status: UserStatus = UserStatus.PENDING
    ) -> User:
        user = await self.user_repo.get_by_username(username)
        if user:
            raise ValueError("The user with this username already exists in the system.")

        hashed_password = security.get_password_hash(password)
        return await self.user_repo.create(
            username=username,
            hashed_password=hashed_password,
            role=role,
            status=status,
        )

    def create_tokens(self, user_id: str) -> Token:
        access_token = security.create_access_token(user_id)
        refresh_token = security.create_refresh_token(user_id)
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )

    async def get_users(self) -> list[User]:
        return await self.user_repo.list()

    async def update_user(
        self, 
        user_id: str, 
        update_data: dict[str, Any]
    ) -> User:
        user = await self.user_repo.get(user_id)
        if not user:
            raise ValueError("User not found")
        
        return await self.user_repo.update(user, **update_data)

    async def delete_user(self, user_id: str) -> None:
        user = await self.user_repo.get(user_id)
        if not user:
            raise ValueError("User not found")
        
        await self.user_repo.delete(user)