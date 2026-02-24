## System Architecture

El sistema está diseñado bajo una arquitectura de  **microservicios contenedorizados** , priorizando la separación de responsabilidades, la seguridad de red y la eficiencia en el procesamiento de datos no estructurados.

### 1. Componentes del Sistema

* **Frontend (React + Vite):** Interfaz de usuario optimizada para la carga de documentos y consultas de lenguaje natural. Se sirve mediante un servidor Nginx en una etapa de producción.
* **Backend Orchestrator (FastAPI):** Actúa como el cerebro del sistema. Maneja la autenticación, la gestión de metadatos en **PostgreSQL** y la orquestación de tareas entre el usuario y el servicio de ML.
* **ML Service (OCR & RAG Engine):** Nodo de computación pesada especializado en:
  * **OCR Pipeline:** Extracción de texto mediante Tesseract con soporte para idioma español.
  * **RAG Pipeline:** Procesamiento de texto (chunking) y generación de embeddings con LangChain.
* **Data Layer:**
  * **PostgreSQL:** Persistencia de datos relacionales (usuarios, estados de documentos, auditoría).
  * **ChromaDB:** Base de datos vectorial para el almacenamiento de embeddings y búsqueda semántica de alta velocidad.

### 2. Flujo de Procesamiento de Datos

1. **Ingesta:** El usuario carga un contrato (PDF/JPG) desde el Frontend.
2. **Persistencia Binaria:** El Backend recibe el archivo y lo almacena en un **volumen compartido** (`/storage`).
3. **Registro de Metadatos:** Se crea una entrada en PostgreSQL con el estado `PENDING`.
4. **Procesamiento Asíncrono:** El ML Service detecta el nuevo archivo (o es notificado por el Backend), realiza el OCR, fragmenta el texto y genera los vectores.
5. **Indexación:** Los vectores se inyectan en ChromaDB con metadatos que apuntan al ID del documento en Postgres.
6. **Disponibilidad:** El estado cambia a `READY` y el usuario puede realizar consultas sobre el contrato.

### 3. Infraestructura y Seguridad

* **Network Isolation:** Se implementaron dos redes virtuales (`frontend-net` y `backend-net`). El Frontend no tiene visibilidad directa de las bases de datos ni del motor de ML, reduciendo la superficie de ataque.
* **Shared Volume Strategy:** Para evitar el overhead de red al transferir archivos binarios pesados entre servicios, se utiliza un volumen bindeado (`bind mount`) que permite acceso directo al disco desde los contenedores de Backend y ML.
* **Healthchecks:** El sistema garantiza la disponibilidad mediante controles de salud que retrasan el inicio de la aplicación hasta que PostgreSQL y ChromaDB estén plenamente operativos.
