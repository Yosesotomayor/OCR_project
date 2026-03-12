from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Postgres
    postgres_user: str = "user"
    postgres_password: str = "password"
    postgres_db: str = "contracts_db"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    @computed_field
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:"
            f"{self.postgres_password}@{self.postgres_host}:"
            f"{self.postgres_port}/{self.postgres_db}"
        )

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "contracts"
    minio_secure: bool = False

    # Embedding
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Retrieval
    retrieval_top_k: int = 20
    reranker_top_n: int = 5
    reranker_enabled: bool = True

    # OCR
    ocr_dpi: int = 300
    low_conf_threshold: int = 70

    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # ML
    ml_base_url: str = "http://localhost:8000"
    ml_api_key: str

    model_config = SettingsConfigDict(
        env_file="../.env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()