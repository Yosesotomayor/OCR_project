# Project Agents: Contract OCR & RAG System

This document serves as the primary reference for the development and maintenance of the Contract OCR and RAG (Retrieval-Augmented Generation) system.

## Project Overview

A specialized system for processing lease contracts. It utilizes OCR for text extraction from PDFs and images, processes them into high-quality embeddings, and stores them in a RAG system for intelligent information retrieval via a web frontend.

## System Architecture (Dockerized)

### 1. Frontend

- **Technology: React + Vite**
- **Responsibility:** User interface for uploading contracts, viewing extracted data, and querying the RAG system.

### 2. Backend

- **Technology:** Python (FastAPI).
- **Database (PostgreSQL):** Stores document metadata, user data, processing status, and document summaries.
- **Responsibility:** API orchestration, file management, user authentication, and coordination between the Frontend and ML services.

### 3. ML Service (RAG & LLM)

- **Technology:** Python, LangChain, OCR (Tesseract/PaddleOCR).
- **Vector Database (ChromaDB):** For storing and retrieving contract embeddings.
- **LangChain Usage:**
  - **Document Loaders:** For parsing OCR-extracted text and PDF structures.
  - **Text Splitters:** Recursive character splitting optimized for legal clauses.
  - **Embeddings:** Integration with OpenAI or HuggingFace embeddings.
  - **Vector Stores:** Orchestrating storage and retrieval with MongoDB Atlas.
  - **Chains/Agents:** Using `RetrievalQA` or specialized agents for contract analysis.
- **Responsibility:**
  - **OCR Pipeline:** Extract text from lease contract PDFs/images.
  - **Embedding Engine:** Generate specialized embeddings for legal lease terminology.
  - **RAG Engine:** Retrieve relevant contract clauses based on user queries.
  - **LLM Integration:** Provide natural language answers based on retrieved context.

## Data Domain: Lease Contracts

- **Focus Areas:** Parties involved, property description, duration, monthly rent, deposits, maintenance responsibilities, and termination clauses.
- **Language:** Spanish (primarily).

## Development Guidelines

- Follow a modular, service-oriented architecture.
- Ensure all services are properly containerized with `docker-compose`.
- Prioritize high accuracy in OCR for legal documents.
- Implement robust error handling for complex PDF structures.
