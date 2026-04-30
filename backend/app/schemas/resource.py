from pydantic import BaseModel, Field
from typing import Optional

# Базова схема
class ResourceBase(BaseModel):
    name: str = Field(..., example="Переговорна №1")
    type: str = Field(..., example="Room", description="Може бути 'Room' або 'Equipment'")
    capacity: Optional[int] = Field(default=None, example=15)

# Схема для створення
class ResourceCreate(ResourceBase):
    pass

# Схема для оновлення
class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    capacity: Optional[int] = None

# Схема для повернення
class ResourceResponse(ResourceBase):
    id: int

    model_config = {
        "from_attributes": True
    }
