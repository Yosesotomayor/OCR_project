
# OCR & Data Pipeline Project

Este proyecto implementa un pipeline de procesamiento de imágenes (OCR) integrado con **PySpark** para la estructuración de datos a gran escala. Diseñado bajo principios de MLOps, utilizando contenedores para garantizar la reproducibilidad.

## Stack Tecnológico

* **Lenguaje:** Python 3.11
* **Gestor de Dependencias:** [uv](https://github.com/astral-sh/uv)
* **Procesamiento:** PySpark (Spark 3.5.x)
* **OCR:** Tesseract / EasyOCR
* **Infraestructura:** Docker (Debian Slim + OpenJDK 21)
* **Calidad:** Pytest

## Estructura del Proyecto

```text
OCR_project/
├── src/                # Lógica central del negocio
│   └── func.py         # Funciones de transformación y OCR
├── tests/              # Pruebas unitarias y de integración
├── pyproject.toml      # Configuración central (PEP 621)
├── Makefile            # Atajos de comandos de ingeniería
└── Dockerfile          # Entorno reproducible
```

### REQUISITOS

* Tener instalado [Docker](https://www.docker.com/).
* (Opcional) [uv](https://github.com/astral-sh/uv) para desarrollo local sin Docker.

### 1. Clonar y Construir

Primero, clona el repositorio y construye la imagen base. Esto instalará automáticamente Java 21, Tesseract y todas las librerías de Python.

**Bash**

```
git clone [https://github.com/tu-usuario/OCR_project.git](https://github.com/tu-usuario/OCR_project.git)
cd OCR_project
make build
```

### 2. Entorno de Desarrollo

Para trabajar dentro del contenedor con acceso a tus archivos locales (modo live-reload):

**Bash**

```
make dev
```

### 3. Ejecutar Pruebas

Garantiza que la lógica de Spark y OCR sea correcta antes de realizar un commit:

**Bash**

```
make test
```

## Prácticas de Ingeniería (MLOps)

* **Ramas:** No se permite hacer push directo a `main`. Todo cambio debe venir de una rama `feature/` o `fix/`.
* **CI/CD:** Cada Pull Request activa un workflow de GitHub Actions que valida los tests en el entorno Docker.
* **Tests:** Los tests de Spark utilizan una `SparkSession` local efímera. Asegúrate de usar el patrón  **Arrange-Act-Assert** .

## Notas para el Equipo

* Si agregas una dependencia, hazlo mediante `uv add <paquete>` para mantener el `uv.lock` actualizado.
* Los archivos pesados de imágenes de prueba deben ir en la carpeta `data/` (ignorada por Git) o referenciarse desde un bucket de S3/Blob Storage.
