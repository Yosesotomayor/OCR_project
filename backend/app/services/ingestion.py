import uuid
import hashlib
import time
import logging
from sqlalchemy.exc import IntegrityError
from app.models.lease import Lease, LeaseStatus
from app.schemas.lease import LeaseBase
from app.repositories.lease_repo import LeaseRepo
from app.services.embedding import EmbeddingService
from app.services.extraction import ExtractionService
from app.services.ocr import OCRService
from app.infrastructure.storage import StorageClient

logger = logging.getLogger(__name__)

class IngestionService:
    def __init__(
        self,
        lease_repo: LeaseRepo,
        storage_client: StorageClient,
        ocr_service: OCRService,
        extraction_service: ExtractionService,
        embedding_service: EmbeddingService,
    ):
        self.lease_repo = lease_repo
        self.storage_client = storage_client
        self.ocr_service = ocr_service
        self.extraction_service = extraction_service
        self.embedding_service = embedding_service

    async def _update_status(
        self,
        lease: Lease,
        status: LeaseStatus,
        error_message: str | None = None,
    ) -> None:
        await self.lease_repo.update(lease, status=status, error_message=error_message)

    async def start(self, filename: str, file_bytes: bytes) -> Lease:
        # 1. Create lease record
        try:
            file_hash = hashlib.sha256(file_bytes).hexdigest()

            lease = await self.lease_repo.create(
                filename=filename,
                file_hash=file_hash,
                minio_path="",
                status=LeaseStatus.UPLOADED,
            )
        except IntegrityError:
            raise ValueError(f"Lease already exists")

        # 2. Upload to MinIO
        minio_path = self.storage_client.upload_file(file_bytes, f"{lease.id}/{filename}")
        await self.lease_repo.update(lease, minio_path=minio_path)

        return lease

    async def _run_ocr(self, lease: Lease) -> str:
        logger.info(f"Processing lease {lease.id} - OCR")

        file_bytes = self.storage_client.get_file(lease.minio_path)
        ocr_result = self.ocr_service.extract_text(file_bytes)

        raw_text = ocr_result["raw_text"]

        if not raw_text.strip():
            raise ValueError("OCR produced empty text")

        await self.lease_repo.update(
            lease,
            raw_text=raw_text,
            ocr_data=ocr_result["ocr_data"],
            ocr_confidence_avg=ocr_result["metrics"]["avg_conf"],
            low_confidence_count=ocr_result["metrics"]["low_conf_count"],
            total_words=ocr_result["metrics"]["total_words"],
        )

        return raw_text

    async def _run_structured_extraction(self, lease: Lease, raw_text: str) -> None:
        logger.info(f"Processing lease {lease.id} - Structured extraction")

        structured = await self.extraction_service.extract_structured(raw_text)

        validated = LeaseBase(
            filename=lease.filename,
            **structured,
        ).model_dump(exclude_unset=True)
        await self.lease_repo.update(lease, **validated)

    async def _run_embedding(self, lease: Lease, raw_text: str) -> None:
        logger.info(f"Processing lease {lease.id} - Chunking and embedding")
        await self.embedding_service.process(raw_text, lease.id)

    async def _process_pipeline(self, lease: Lease, skip_ocr: bool = False) -> None:
        await self._update_status(lease, LeaseStatus.PROCESSING)
        await self.lease_repo.update(lease, progress=20)

        raw_text = lease.raw_text
        if not raw_text and not skip_ocr:
            raw_text = await self._run_ocr(lease)

        await self.lease_repo.update(lease, progress=40)
        await self._run_structured_extraction(lease, raw_text)
        
        await self.lease_repo.update(lease, progress=80)
        await self._run_embedding(lease, raw_text)

        logger.info(f"Processing lease {lease.id} - Marking ready")
        await self._update_status(lease, LeaseStatus.READY)
        await self.lease_repo.update(lease, progress=100)

    async def process(self, lease_id: uuid.UUID) -> None:
        lease = await self.lease_repo.get(lease_id)
        if not lease:
            return

        start_time = time.time()

        try:
            await self._process_pipeline(lease)

        except Exception as e:
            logger.error(f"Processing lease {lease.id} - Failed", exc_info=True)
            await self._update_status(
                lease,
                LeaseStatus.FAILED,
                error_message=str(e),
            )

        finally:
            processing_time = time.time() - start_time
            await self.lease_repo.update(lease, processing_time=processing_time)

    async def retry_failed(self) -> None:
        leases = await self.lease_repo.list_failed()
        logger.info(f"Retrying {len(leases)} failed leases")

        for lease in leases:
            start_time = time.time()

            try:
                await self.embedding_service.chunk_repo.delete_by_lease_id(lease.id)
                await self._process_pipeline(
                    lease,
                    skip_ocr=bool(lease.raw_text),
                )

            except Exception as e:
                logger.error(f"Retrying processing lease {lease.id} - Failed", exc_info=True)
                await self._update_status(
                    lease,
                    LeaseStatus.FAILED,
                    error_message=str(e),
                )

            finally:
                processing_time = time.time() - start_time
                await self.lease_repo.update(lease, processing_time=processing_time)

        logger.info(f"Processed {len(leases)} failed leases")