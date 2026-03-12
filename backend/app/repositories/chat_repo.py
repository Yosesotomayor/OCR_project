from typing import Sequence
from uuid import UUID
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.chat import Chat, Message
from app.repositories.base import BaseRepo

class ChatRepo(BaseRepo[Chat]):
    def __init__(self, db: AsyncSession):
        super().__init__(Chat, db)

    async def get_by_user(self, user_id: UUID) -> Sequence[Chat]:
        result = await self.db.execute(
            select(Chat).where(Chat.user_id == user_id).order_by(desc(Chat.updated_at))
        )
        return result.scalars().all()

class MessageRepo(BaseRepo[Message]):
    def __init__(self, db: AsyncSession):
        super().__init__(Message, db)

    async def get_by_chat(self, chat_id: UUID, limit: int = 50) -> Sequence[Message]:
        result = await self.db.execute(
            select(Message)
            .where(Message.chat_id == chat_id)
            .order_by(desc(Message.created_at))
            .limit(limit)
        )
        # Return in chronological order
        return list(reversed(result.scalars().all()))

    async def create_message(self, chat_id: UUID, role: str, content: str, metadata: dict = None) -> Message:
        message = Message(
            chat_id=chat_id,
            role=role,
            content=content,
            metadata_=metadata
        )
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)
        return message
