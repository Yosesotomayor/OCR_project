import os
import sys
import uuid
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://postgres:postgres@postgresdb:5432/ocr_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_contracts():
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT id, filename FROM contracts"))
        contracts = result.fetchall()
        print(f"Total contracts in DB: {len(contracts)}")
        for c in contracts:
            print(f"ID: {c[0]}, Filename: {c[1]}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_contracts()
