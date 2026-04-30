from pydantic import BaseModel
from typing import Optional

# Схема відповіді
class Token(BaseModel):
    access_token: str
    token_type: str

# Схема для даних
class TokenData(BaseModel):
    email: Optional[str] = None
