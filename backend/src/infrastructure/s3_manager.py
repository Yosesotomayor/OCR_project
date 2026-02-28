import os
import boto3
from botocore.exceptions import ClientError
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

class S3Manager:
    def __init__(self):
        self.endpoint = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
        self.access_key = os.getenv("MINIO_ACCESS_KEY", "admin")
        self.secret_key = os.getenv("MINIO_SECRET_KEY", "una_password_segura_123")
        self.bucket_name = os.getenv("MINIO_BUCKET", "artifacts")

        self.s3_client = boto3.client(
            "s3",
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name="us-east-1", 
        )

    def upload_file(self, file_content: bytes, object_name: str) -> bool:
        """Sube un archivo (en bytes) a MinIO."""
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_name,
                Body=file_content
            )
            return True
        except ClientError as e:
            print(f"Error subiendo a MinIO: {e}")
            return False

    def generate_presigned_url(self, object_name: str, expires_in: int = 3600) -> Optional[str]:
        """
        Genera una URL firmada (Presigned URL). 
        ESTO ES VITAL: Tu React no debe entrar a MinIO, usa esta URL temporal.
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_name},
                ExpiresIn=expires_in
            )
            return url
        except ClientError:
            return None

    def delete_file(self, object_name: str) -> bool:
        """Elimina un archivo de MinIO."""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=object_name
            )
            return True
        except ClientError as e:
            print(f"Error eliminando de MinIO: {e}")
            return False