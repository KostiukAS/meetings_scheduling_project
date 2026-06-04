from pydantic import BaseModel, field_serializer
from datetime import datetime, timezone
from typing import List, Optional

# Схема для передачі учасника або ресурсу з його вагою
class ParticipantItem(BaseModel):
    id: int
    weight: int

class ParticipantDetail(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: str
    status: str
    weight: int
    
    model_config = {
        "from_attributes": True
    }

class ResourceDetail(BaseModel):
    id: int
    name: str
    weight: int
    
    model_config = {
        "from_attributes": True
    }

# Запит на пошук часу
class FindSlotsRequest(BaseModel):
    duration_minutes: int  # Тривалість у хвилинах (наприклад, 60)
    search_start: datetime # Початок діапазону (наприклад, понеділок 09:00)
    search_end: datetime   # Кінець діапазону (наприклад, п'ятниця 18:00)
    users: List[ParticipantItem]    # Список ID користувачів
    resources: List[ParticipantItem] # Список ID ресурсів

# Знайдений часовий слот
class SlotBase(BaseModel):
    start_time: datetime
    end_time: datetime
    score: int

    @field_serializer("start_time", "end_time")
    def serialize_slot_dt(self, dt: datetime):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

class SlotSubResponse(SlotBase):
    pass

class SlotResponse(SlotBase):
    subslots: List[SlotSubResponse] = []

class MeetingBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    frequency: Optional[str] = None

# Схема для створення нової зустрічі
class MeetingCreate(MeetingBase):
    project_id: Optional[int] = None
    participants: List[ParticipantItem] = []
    resources: List[ParticipantItem] = []

# Схема для повернення створеної зустрічі
class MeetingResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    organizer_id: int
    start_time: datetime
    end_time: datetime
    period_stop_time: Optional[datetime] = None
    frequency: Optional[str] = None
    project_id: Optional[int] = None
    participants: List[ParticipantDetail] = []
    resources: List[ResourceDetail] = []

    model_config = {
        "from_attributes": True
    }

    @field_serializer("start_time", "end_time", "period_stop_time")
    def serialize_meeting_dt(self, dt: Optional[datetime]):
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    
class ParticipantStatusUpdate(BaseModel):
    status: str # "Accepted", "Rejected", або "Pending"

class AddParticipantRequest(BaseModel):
    user_id: int
    weight: int

class AddResourceRequest(BaseModel):
    resource_id: int
    weight: int

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    frequency: Optional[str] = None

class StopRecurringRequest(BaseModel):
    stop_time: datetime

class ValidateSlotRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    meeting_id: Optional[int] = None
    soft_validation: Optional[bool] = False
    users: List[ParticipantItem] = []
    resources: List[ParticipantItem] = []

class ValidateSlotResponse(BaseModel):
    is_valid: bool
    score: int
    conflicts: List[str]
