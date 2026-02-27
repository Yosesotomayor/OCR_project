import os
import sys
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.models import Base, User
from src.security import get_password_hash

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")
DEFAULT_ADMIN_EMAIL = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@vertiche.mx")
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin_vertiche")

if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable not set.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_default_admin_user():
    db = SessionLocal()
    try:
        Base.metadata.create_all(bind=engine)

        existing_user = db.query(User).filter(User.email == DEFAULT_ADMIN_EMAIL).first()
        if existing_user:
            print(f"Default admin user '{DEFAULT_ADMIN_EMAIL}' already exists.")
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
        db.refresh(admin_user)
        print(f"Default admin user '{DEFAULT_ADMIN_EMAIL}' created successfully.")
    except Exception as e:
        print(f"Error creating default admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_default_admin_user()
