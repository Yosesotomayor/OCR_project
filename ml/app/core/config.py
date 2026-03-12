from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Embedding
    embedding_model: str = "paraphrase-multilingual-mpnet-base-v2"

    # LLM
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:14b"

    # Retrieval
    reranker_enabled: bool = True
    reranker_model: str = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"

    # OCR
    tesseract_lang: str = "spa"
    tesseract_config: str = "--psm 6"

    # ML
    ml_api_key: str

    model_config = SettingsConfigDict(
        env_file="../.env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()