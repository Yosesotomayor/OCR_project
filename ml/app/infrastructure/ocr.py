from paddleocr import PaddleOCR
from PIL import Image
import numpy as np
from typing import Any
from app.core.config import settings


class OCREngine:
    def __init__(self, ocr: PaddleOCR):
        self.ocr = ocr

    def extract_text(self, image: Image.Image) -> dict[str, Any]:
        image = image.convert("RGB")
        img = np.array(image)

        results = self.ocr.predict(img)

        output = {
            "text": [],
            "conf": [],
            "line_num": [],
            "page": [],
            "left": [],
            "top": [],
            "width": [],
            "height": [],
        }

        line_counter = 1

        for line in results:
            for box, (text, conf) in line:
                xs = [p[0] for p in box]
                ys = [p[1] for p in box]

                left = int(min(xs))
                top = int(min(ys))
                right = int(max(xs))
                bottom = int(max(ys))

                width = right - left
                height = bottom - top

                output["text"].append(text)
                output["conf"].append(float(conf))

                # dummy compatibility fields
                output["line_num"].append(line_counter)
                output["page"].append(1)

                output["left"].append(left)
                output["top"].append(top)
                output["width"].append(width)
                output["height"].append(height)

                line_counter += 1

        return output