import httpx
import json
from collections.abc import AsyncGenerator
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class OllamaClient:
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=None)

    async def pull_model(self) -> None:
        async with self.client.stream(
            "POST", 
            "/api/pull", 
            json={"model": self.model}
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        status = data.get("status", "")
                        completed = data.get("completed")
                        total = data.get("total")
                        if completed and total:
                            pct = round(completed / total * 100, 1)
                            if pct == int(pct):
                                logger.info(f"Pulling {self.model}: {status} {pct}%")
                        else:
                            logger.info(f"Pulling {self.model}: {status}")
                    except json.JSONDecodeError:
                        continue
        logger.info(f"Model {self.model} ready.")


    async def generate(self, prompt: str, temperature: float = 0.7) -> str:
        response = await self.client.post(
            "/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                }
            },
        )
        response.raise_for_status()
        return response.json().get("response", "")

    async def generate_stream(self, prompt: str, temperature: float = 0.7) -> AsyncGenerator[str, None]:
        async with self.client.stream(
            "POST",
            "/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "stream": True,
                "options": {
                    "temperature": temperature,
                }
            },
        ) as response:
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    token = data.get("response", "")
                    if token:
                        yield token
                    if data.get("done"):
                        break
                except json.JSONDecodeError:
                    continue

    async def close(self) -> None:
        await self.client.aclose()
