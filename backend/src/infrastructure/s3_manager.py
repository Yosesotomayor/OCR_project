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

        # Cliente interno para operaciones Docker-to-Docker
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name="us-east-1",
            config=boto3.session.Config(signature_version='s3v4')
        )

    def upload_file(self, file_content: bytes, object_name: str) -> bool:
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_name,
                Body=file_content,
                ContentType='application/pdf'
            )
            return True
        except Exception as e:
            print(f"Error subiendo a MinIO: {e}")
            return False

    def generate_presigned_url(self, object_name: str, expires_in: int = 3600) -> Optional[str]:
        try:
            # Creamos un cliente temporal con 'localhost' para que la firma coincida con lo que el navegador usa
            # Esto evita el error SignatureDoesNotMatch
            public_s3 = boto3.client(
                "s3",
                endpoint_url="http://localhost:9000",
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name="us-east-1",
                config=boto3.session.Config(signature_version='s3v4')
            )
            
            url = public_s3.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name, 
                    'Key': object_name,
                    'ResponseContentType': 'application/pdf',
                    'ResponseContentDisposition': 'inline'
                },
                ExpiresIn=expires_in
            )
            return url
        except Exception:
            return None

    def delete_file(self, object_name: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_name)
            return True
        except Exception:
            return False
