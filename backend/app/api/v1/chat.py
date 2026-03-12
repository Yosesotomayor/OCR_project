from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_active_user, get_chat_service, get_query_service
from app.schemas.user import User
from app.schemas.chat import (
    ChatCreate, 
    ChatRead, 
    MessageRead, 
    SendMessageRequest
)
from app.services.chat import ChatService
from app.services.query import QueryService

router = APIRouter(
    prefix="/chat", 
    tags=["chat"],
    dependencies=[Depends(get_current_active_user)],
)


@router.get("/", response_model=list[ChatRead])
async def list_chats(
    current_user: User = Depends(get_current_active_user),
    chat_service: ChatService = Depends(get_chat_service),
):
    chats = await chat_service.get_user_chats(current_user.id)
    return [ChatRead.model_validate(c) for c in chats]


@router.post("/", response_model=ChatRead, status_code=status.HTTP_201_CREATED)
async def create_chat(
    chat_in: ChatCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    chat_service: ChatService = Depends(get_chat_service),
):
    chat = await chat_service.create_chat(current_user.id, chat_in.content)

    background_tasks.add_task(
        chat_service.update_chat_title,
        chat_id=chat.id,
        content=chat_in.content,
    )

    return ChatRead.model_validate(chat)


@router.get("/{chat_id}/messages", response_model=list[MessageRead])
async def get_messages(
    chat_id: UUID,
    current_user: User = Depends(get_current_active_user),
    chat_service: ChatService = Depends(get_chat_service),
):
    messages = await chat_service.get_chat_messages(chat_id, current_user.id)
    return [MessageRead.model_validate(m) for m in messages]


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_active_user),
    chat_service: ChatService = Depends(get_chat_service),
):
    await chat_service.delete_chat(chat_id, current_user.id)


@router.post("/{chat_id}/message")
async def send_message(
    chat_id: UUID,
    request: SendMessageRequest,
    current_user: User = Depends(get_current_active_user),
    query_service: QueryService = Depends(get_query_service),
    chat_service: ChatService = Depends(get_chat_service),
):
    # Verify chat ownership
    await chat_service.get_chat_messages(chat_id, current_user.id)
    
    return StreamingResponse(
        query_service.stream_answer(
            query=request.query,
            lease_filenames=request.lease_filenames,
            chat_id=chat_id,
        ),
        media_type="text/event-stream"
    )
