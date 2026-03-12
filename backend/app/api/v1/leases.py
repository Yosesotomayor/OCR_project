from uuid import UUID
from fastapi import (
    APIRouter, 
    BackgroundTasks, 
    HTTPException, 
    UploadFile, 
    File, 
    status, 
    Depends
)
from app.api.deps import (
    get_ingestion_service, 
    get_lease_repo, 
    get_storage_client, 
    get_chunk_repo, 
    get_current_active_user,
    get_current_admin_user
)
from app.schemas.user import User
from app.schemas.lease import LeaseOut, LeaseList
from app.services.ingestion import IngestionService
from app.repositories.lease_repo import LeaseRepo
from app.repositories.chunk_repo import ChunkRepo
from app.infrastructure.storage import StorageClient

router = APIRouter(
    prefix="/leases", 
    tags=["leases"],
    dependencies=[Depends(get_current_active_user)],
)


@router.post("", response_model=LeaseOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_lease(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    ingestion_service: IngestionService = Depends(get_ingestion_service),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted",
        )

    file_bytes = await file.read()
    try:
        lease = await ingestion_service.start(
            filename=file.filename,
            file_bytes=file_bytes,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    background_tasks.add_task(
        ingestion_service.process,
        lease_id=lease.id,
    )

    return lease


@router.post("/retry-failed", status_code=status.HTTP_202_ACCEPTED)
async def retry_failed_leases(
    background_tasks: BackgroundTasks,
    ingestion_service: IngestionService = Depends(get_ingestion_service),
):
    background_tasks.add_task(
        ingestion_service.retry_failed,
    )


@router.get("", response_model=LeaseList)
async def list_leases(repo: LeaseRepo = Depends(get_lease_repo)):
    items = await repo.list_ordered()
    return LeaseList(total=len(items), items=items)


@router.get("/{lease_id}", response_model=LeaseOut)
async def get_lease(lease_id: UUID, repo: LeaseRepo = Depends(get_lease_repo)):
    lease = await repo.get(lease_id)
    if not lease:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lease not found",
        )
    return lease


@router.delete("/{lease_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lease(
    lease_id: UUID, 
    lease_repo: LeaseRepo = Depends(get_lease_repo),
    chunk_repo: ChunkRepo = Depends(get_chunk_repo),
    storage: StorageClient = Depends(get_storage_client),
    current_user: User = Depends(get_current_admin_user),
):
    lease = await lease_repo.get(lease_id)
    if not lease:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lease not found",
        )
    
    # Delete from storage
    storage.delete_file(lease.minio_path)
    await lease_repo.delete(lease)
    await chunk_repo.delete_by_lease_id(lease_id)


@router.get("/{lease_id}/url", status_code=status.HTTP_200_OK)
async def get_lease_url(
    lease_id: UUID,
    download: bool = False,
    lease_repo: LeaseRepo = Depends(get_lease_repo),
    storage: StorageClient = Depends(get_storage_client),
):
    lease = await lease_repo.get(lease_id)
    if not lease:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lease not found",
        )
    
    return storage.get_presigned_url(lease.minio_path, download)