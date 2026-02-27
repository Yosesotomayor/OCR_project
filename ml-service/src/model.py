from langchain_ollama import OllamaLLM, OllamaEmbeddings
from langchain_community.vectorstores import Chroma

llm = OllamaLLM(model="llama3.1:8b", base_url="http://ollama:11434")
embeddings = OllamaEmbeddings(model="nomic-embed-text", base_url="http://ollama:11434")

vector_db = Chroma(
    persist_directory="./chroma_data", 
    embedding_function=embeddings,
    collection_name="lease_contracts"
)

def ask_agent(question: str):
    docs = vector_db.similarity_search(question, k=3)
    context = "\n".join([d.page_content for d in docs])
    
    prompt = f"Contexto de contratos:\n{context}\n\nPregunta: {question}"
    return llm.invoke(prompt)
