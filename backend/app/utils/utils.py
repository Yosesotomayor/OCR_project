import json

def parse_json(text: str) -> dict:
    try:
        start_idx = text.find("{")
        end_idx = text.rfind("}") + 1
        
        if start_idx != -1 and end_idx != -1:
            json_str = text[start_idx:end_idx]
            data = json.loads(json_str)
            return data
        
        return {}
    except json.JSONDecodeError:
        return {}