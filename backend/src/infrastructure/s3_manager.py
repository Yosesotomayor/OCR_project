import os
import boto3
from botocore.exceptions import ClientError
from botocore.client import Config
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

class S3Manager:
    def __init__(self):
        self.endpoint = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
        self.access_key = os.getenv("MINIO_ACCESS_KEY", "admin")
        self.secret_key = os.getenv("MINIO_SECRET_KEY", "una_password_segura_123")
        self.bucket_name = os.getenv("MINIO_BUCKET", "artifacts")

        # Cliente para operaciones internas (Upload/Delete)
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name="us-east-1",
            config=Config(signature_version='s3v4', s3={'addressing_style': 'path'})
        )

        # Endpoint para que el navegador acceda (localhost o IP pública)
        self.external_endpoint = os.getenv("MINIO_EXTERNAL_URL", "http://localhost:9000")

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
        """
        Genera una URL firmada utilizando el endpoint externo para el navegador.
        """
        try:
            signing_client = boto3.client(
                "s3",
                endpoint_url=self.external_endpoint,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name="us-east-1",
                config=Config(signature_version='s3v4', s3={'addressing_style': 'path'})
            )
            
            url = signing_client.generate_presigned_url(
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
        except Exception as e:
            print(f"Error generando presigned URL con client externo: {e}. Intentando fallback...")
            try:
                url = self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': self.bucket_name, 
                        'Key': object_name,
                        'ResponseContentType': 'application/pdf',
                        'ResponseContentDisposition': 'inline'
                    },
                    ExpiresIn=expires_in
                )
                if "minio:9000" in url and "localhost" in self.external_endpoint:
                    url = url.replace("minio:9000", "localhost:9000")
                elif self.external_endpoint not in url:
                    from urllib.parse import urlparse, urlunparse
                    parsed_url = urlparse(url)
                    parsed_ext = urlparse(self.external_endpoint)
                    new_url = parsed_url._replace(netloc=parsed_ext.netloc, scheme=parsed_ext.scheme)
                    url = urlunparse(new_url)
                return url
            except Exception as e2:
                print(f"Error fatal generando presigned URL: {e2}")
                return None

    def download_file(self, object_name: str) -> bytes:
        """Descarga un archivo de MinIO y devuelve su contenido en bytes."""
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=object_name)
            return response['Body'].read()
        except Exception as e:
            print(f"Error descargando de MinIO: {e}")
            raise

    def delete_file(self, object_name: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_name)
            return True
        except Exception:
            return False
