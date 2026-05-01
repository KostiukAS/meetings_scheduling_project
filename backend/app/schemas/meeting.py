from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

# Схема для передачі учасника або ресурсу з його вагою
class ParticipantItem(BaseModel):
    id: int
    weight: int

# Запит на пошук часу
class FindSlotsRequest(BaseModel):
    duration_minutes: int  # Тривалість у хвилинах (наприклад, 60)
    search_start: datetime # Початок діапазону (наприклад, понеділок 09:00)
    search_end: datetime   # Кінець діапазону (наприклад, п'ятниця 18:00)
    users: List[ParticipantItem]    # Список ID користувачів
    resources: List[ParticipantItem] # Список ID ресурсів

# Знайдений часовий слот
class SlotResponse(BaseModel):
    start_time: datetime
    end_time: datetime
    score: int

# Схема для створення нової зустрічі
class MeetingCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    project_id: Optional[int] = None
    participants: List[ParticipantItem] = []  # Використовуємо вже існуючу схему ParticipantItem
    resources: List[ParticipantItem] = []

# Схема для повернення створеної зустрічі
class MeetingResponse(BaseModel):
    id: int
    title: str
    organizer_id: int
    start_time: datetime
    end_time: datetime

    model_config = {
        "from_attributes": True
    }
