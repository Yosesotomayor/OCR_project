import re
from typing import Dict, Any
from ocr_engine import OCREngine

class DataParser:
    def __init__(self):
        self.money_pattern = re.compile(r'\$(\d{1,3}(?:,\d{3})*\.\d{2})')
        self.cp_pattern = re.compile(r'C\.?P\.?\s*(\d{5})', re.IGNORECASE)
        self.name_pattern = re.compile(r'^([A-ZÁÉÍÓÚÑ]+\s[A-ZÁÉÍÓÚÑ]+\s[A-ZÁÉÍÓÚÑ]+(?:[A-ZÁÉÍÓÚÑ ]*)?)$', re.MULTILINE)

    def parse(self, raw_text: str) -> Dict[str, Any]:
        data = {
            "raw_text": raw_text,
            "amounts": [],
            "postal_code": None,
            "possible_name": None,
            "status": "incomplete"
        }

        matches = self.money_pattern.findall(raw_text)
        if matches:
            data["amounts"] = [float(m.replace(',', '')) for m in matches]
            data["max_amount"] = max(data["amounts"])

        cp_match = self.cp_pattern.search(raw_text)
        if cp_match:
            data["postal_code"] = cp_match.group(1)

        stop_words = ["REALIZA", "PAGO", "ESCANEANDO", "CÓDIGO", "RFC", "CALLE", "DOMICILIO", "COLONIA"]
        
        lines = raw_text.split('\n')
        for line in lines:
            line = line.strip()
            words = line.split()
            if len(words) < 3: 
                  continue
            if not words[0][0].isupper(): 
                  continue
            if any(char in line[:3] for char in ['|', '$', ':', '.', '0','1','2','3','4','5','6','7','8','9']): 
                  continue

            candidate_name = []
            for word in words:
                if word.upper() in stop_words or not word.isupper():
                    break
                clean_word = re.sub(r'[^A-ZÑ]', '', word)
                if len(clean_word) > 1:
                    candidate_name.append(clean_word)
            
            if len(candidate_name) >= 2:
                full_name = " ".join(candidate_name)
                data["possible_name"] = full_name
                break

        return data

if __name__ == "__main__":
    dirty_text = OCREngine().extract_text("data/Image.jpeg")
    
    parser = DataParser()
    result = parser.parse(dirty_text)
    
    import json
    print(json.dumps(result, indent=2, ensure_ascii=False))