from shared_schemas.schemas import BaseModel

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Lista de orígenes permitidos
origins = [
    "http://localhost",
    "http://localhost:5173",
    "http://localhost:80",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:80",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Backend running for React frontend"}