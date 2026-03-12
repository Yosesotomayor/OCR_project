from uuid import UUID
from app.infrastructure.ml import LLM
from app.repositories.chat_repo import ChatRepo, MessageRepo
from app.models.chat import Chat, Message
from app.prompts.chat import CHAT_TITLE_PROMPT

class ChatService:
    def __init__(
        self, 
        chat_repo: ChatRepo, 
        message_repo: MessageRepo,
        llm: LLM
    ):
        self.chat_repo = chat_repo
        self.message_repo = message_repo
        self.llm = llm

    async def create_chat(self, user_id: UUID, content: str) -> Chat:
        return await self.chat_repo.create(
            user_id=user_id,
            title="Nueva conversación",
        )
    
    async def update_chat_title(self, chat_id: UUID, content: str) -> Chat:
        chat = await self.chat_repo.get(chat_id)
        if not chat:
            raise ValueError("Chat not found")
        
        prompt = CHAT_TITLE_PROMPT.format(query=content)
        title = await self.llm.generate(prompt)
        return await self.chat_repo.update(chat, title=title)

    async def get_user_chats(self, user_id: UUID) -> list[Chat]:
        return await self.chat_repo.get_by_user(user_id)

    async def get_chat_messages(self, chat_id: UUID, user_id: UUID) -> list[Message]:
        chat = await self.chat_repo.get(chat_id)
        if not chat or chat.user_id != user_id:
            raise ValueError("Chat not found")
        
        return await self.message_repo.get_by_chat(chat_id)

    async def delete_chat(self, chat_id: UUID, user_id: UUID) -> None:
        chat = await self.chat_repo.get(chat_id)
        if not chat or chat.user_id != user_id:
            raise ValueError("Chat not found")
        
        await self.chat_repo.delete(chat)
