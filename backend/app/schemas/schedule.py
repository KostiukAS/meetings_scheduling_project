from pydantic import BaseModel
from datetime import time
from typing import Optional

class ScheduleBase(BaseModel):
    day_of_week: int  
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_day_off: bool = False

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleResponse(ScheduleBase):
    id: int
    user_id: int

    model_config = {
        "from_attributes": True
    }
