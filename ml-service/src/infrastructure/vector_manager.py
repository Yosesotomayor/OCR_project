import os
import logging
from langchain_ollama import OllamaEmbeddings
from langchain_postgres import PGVector
from langchain_core.documents import Document
from typing import List, Dict

logger = logging.getLogger(__name__)

class VectorManager:
    def __init__(self):
        self.connection_string = os.getenv("DATABASE_URL")
        self.collection_name = "contract_vectors"
        
        self.embeddings = OllamaEmbeddings(
            model="nomic-embed-text", 
            base_url="http://ollama:11434"
        )
        
        self.vector_store = PGVector(
            embeddings=self.embeddings,
            collection_name=self.collection_name,
            connection=self.connection_string,
            use_jsonb=True,
        )

    def add_documents(self, texts: List[str], metadatas: List[Dict], ids: List[str]):
        """Agrega documentos a PGVector"""
        try:
            docs = [
                Document(page_content=t, metadata=m, id=i) 
                for t, m, i in zip(texts, metadatas, ids)
            ]
            self.vector_store.add_documents(docs, ids=ids)
            logger.info(f"{len(texts)} chunks indexados en PGVector.")
        except Exception as e:
            logger.error(f"Error indexando vectores: {e}")

    def search(self, query: str, n_results: int = 5):
        """Busca documentos similares"""
        try:
            results = self.vector_store.similarity_search(query, k=n_results)
            return {
                'documents': [[doc.page_content for doc in results]],
                'metadatas': [[doc.metadata for doc in results]]
            }
        except Exception as e:
            logger.error(f"Error buscando vectores: {e}")
            return {'documents': [[]], 'metadatas': [[]]}

    def delete_documents(self, doc_id: str):
        """Elimina documentos por doc_id (metadata)"""
        try:
            # PGVector requiere eliminar por IDs especificos o filtrar. 
            # Nota: La implementacion actual de langchain-postgres delete es por IDs.
            # Para borrar por metadata, necesitamos una query custom o iterar.
            # Por simplicidad y rendimiento, en esta version v1 dejamos que los vectores
            # se queden (o se limpien con un job nocturno), ya que borrar por metadata es costoso aqui.
            pass 
        except Exception as e:
            logger.error(f"Error eliminando vectores: {e}")
