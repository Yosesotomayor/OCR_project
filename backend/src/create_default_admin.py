import os
import sys
import uuid
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
from dotenv import load_dotenv

# Asegurar que el script encuentre los módulos de src
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.src.models import Base, User
from backend.src.security import get_password_hash

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
# Forzamos el dominio corporativo incluso en el script de carga
DEFAULT_ADMIN_EMAIL = "admin@vertiche.mx" 
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin_vertiche_2026")

def create_default_admin_user():
    if not DATABASE_URL:
        print("❌ Error: DATABASE_URL no configurada.")
        return

    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # --- Lógica de Resiliencia (Wait-for-DB) ---
    retries = 5
    while retries > 0:
        try:
            engine.connect()
            break
        except OperationalError:
            print(f"⏳ Esperando a Postgres... ({retries} reintentos restantes)")
            retries -= 1
            time.sleep(3)
    else:
        print("❌ No se pudo conectar a la base de datos.")
        return

    db = SessionLocal()
    try:
        # Crea las tablas si no existen (Migración básica)
        Base.metadata.create_all(bind=engine)

        # Validación de dominio Vertiche (Seguridad Backend)
        if not DEFAULT_ADMIN_EMAIL.endswith("@vertiche.mx"):
            print("❌ Error: El correo debe ser @vertiche.mx")
            return

        existing_user = db.query(User).filter(User.email == DEFAULT_ADMIN_EMAIL).first()
        
        if existing_user:
            print(f"ℹ️ El administrador '{DEFAULT_ADMIN_EMAIL}' ya existe.")
            return

        hashed_password = get_password_hash(DEFAULT_ADMIN_PASSWORD)
        admin_user = User(
            id=str(uuid.uuid4()),
            email=DEFAULT_ADMIN_EMAIL,
            hashed_password=hashed_password,
            is_active=True,
            is_admin=True
        )
        
        db.add(admin_user)
        db.commit()
        print(f"✅ Administrador '{DEFAULT_ADMIN_EMAIL}' creado con éxito.")
        
    except Exception as e:
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_default_admin_user()