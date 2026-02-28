import os
import chromadb
from langchain_ollama import OllamaEmbeddings
from typing import List, Dict

class VectorManager:
    def __init__(self):
        self.host = os.getenv("CHROMA_HOST", "chromadb")
        self.port = os.getenv("CHROMA_PORT", "8000")
        
        self.client = chromadb.HttpClient(host=self.host, port=self.port)
      
        self.embeddings = OllamaEmbeddings(
            model="nomic-embed-text",
            base_url="http://ollama:11434"
        )
        self.collection_name = "lease_contracts"
        
    def add_documents(self, chunks: List[str], metadatas: List[Dict], ids: List[str]):
        """Inserta fragmentos de contrato con sus metadatos (S3 Key, ID, etc.)"""
        vector_embeddings = self.embeddings.embed_documents(chunks)
        
        collection = self.client.get_or_create_collection(name=self.collection_name)
        
        collection.add(
            embeddings=vector_embeddings,
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )

    def search(self, query: str, n_results: int = 5):
        try:
            collection = self.client.get_or_create_collection(name=self.collection_name)

            if collection.count() == 0:
                return {"documents": [[]], "metadatas": [[]]}

            query_vector = self.embeddings.embed_query(query)
            results = collection.query(
                query_embeddings=[query_vector],
                n_results=n_results
            )
            return results
        except Exception as e:
            print(f"Error en búsqueda vectorial: {e}")
            return {"documents": [[]], "metadatas": [[]]}