from pydantic import BaseModel
from datetime import datetime
from typing import List

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
