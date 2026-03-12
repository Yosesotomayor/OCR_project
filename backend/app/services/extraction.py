from app.infrastructure.ml import LLM
from app.prompts.extraction import EXTRACTION_PROMPT
from app.utils.utils import parse_json

class ExtractionService:
    def __init__(self, llm: LLM) -> None:
        self.llm = llm

    async def extract_structured(self, text: str) -> dict:
        prompt = EXTRACTION_PROMPT.format(text=text[:10000])
        raw = await self.llm.generate(prompt, temperature=0.0)
        return parse_json(raw)
