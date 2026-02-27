import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)

def get_url():
    url = os.getenv("DATABASE_URL")
    
    if not url or url == "None":
        user = os.getenv("POSTGRES_USER")
        password = os.getenv("POSTGRES_PASSWORD")
        host = os.getenv("POSTGRES_HOST", "postgresdb")
        port = os.getenv("POSTGRES_PORT", "5432")
        db_name = os.getenv("POSTGRES_DB")
        
        missing = [k for k, v in {"USER": user, "PASS": password, "DB": db_name}.items() if not v or v == "None"]
        if missing:
            raise ValueError(f"Faltan variables esenciales en el .env o tienen valor 'None': {', '.join(missing)}")
            
        url = f"postgresql://{user}:{password}@{host}:{port}/{db_name}"
    
    return url

SQLALCHEMY_DATABASE_URL = get_url()

logger.info(f"Conectando a base de datos en: {SQLALCHEMY_DATABASE_URL.split('@')[-1]}")

try:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,
    )
except Exception as e:
    logger.error(f"Error fatal al crear engine: {e}")
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()