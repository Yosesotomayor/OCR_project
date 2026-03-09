from langchain_ollama import OllamaLLM, OllamaEmbeddings
from langchain_community.vectorstores import Chroma

# Configuración de modelo con ventana de contexto de 16k (soporta contratos extensos)
llm = OllamaLLM(
    model="llama3.1:8b", 
    base_url="http://ollama:11434",
    num_ctx=16384,
    temperature=0.0
)

# Nomic-Embed-Text v1.5 con ventana de 8k tokens nativa
embeddings = OllamaEmbeddings(
    model="nomic-embed-text", 
    base_url="http://ollama:11434"
)

vector_db = Chroma(
    persist_directory="./chroma_data", 
    embedding_function=embeddings,
    collection_name="lease_contracts"
)

def ask_agent(question: str):
    # Recuperación optimizada para contexto denso
    docs = vector_db.similarity_search(question, k=5)
    context = "\n".join([d.page_content for d in docs])
    
    prompt = f"Contexto de contratos:\n{context}\n\nPregunta: {question}"
    return llm.invoke(prompt)
