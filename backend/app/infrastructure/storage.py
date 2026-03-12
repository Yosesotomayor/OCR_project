from io import BytesIO
from minio import Minio
from minio.error import S3Error
from datetime import timedelta
from app.core.config import settings

class StorageClient:
    def __init__(self, client: Minio):
        self.client = client
        self.bucket = settings.minio_bucket

    def _ensure_bucket(self) -> None:
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def upload_file(self, file_bytes: bytes, filename: str) -> str:
        self._ensure_bucket()
        self.client.put_object(
            bucket_name=self.bucket,
            object_name=filename,
            data=BytesIO(file_bytes),
            length=len(file_bytes),
            content_type="application/pdf",
        )
        return f"{self.bucket}/{filename}"

    def get_file(self, minio_path: str) -> bytes:
        bucket, object_name = minio_path.split("/", 1)
        response = None
        try:
            response = self.client.get_object(bucket, object_name)
            return response.read()
        finally:
            if response:
                response.close()
                response.release_conn()

    def delete_file(self, minio_path: str) -> None:
        bucket, object_name = minio_path.split("/", 1)
        try:
            self.client.remove_object(bucket, object_name)
        except S3Error:
            pass

    def get_presigned_url(self, minio_path: str, download: bool = False) -> str:
        bucket, object_name = minio_path.split("/", 1)
        key = "attachment" if download else "inline"
        return self.client.presigned_get_object(
            bucket_name=bucket,
            object_name=object_name,
            expires=timedelta(hours=1),
            response_headers={
                "response-content-disposition": f'{key}; filename="{object_name}"'
            }
        )