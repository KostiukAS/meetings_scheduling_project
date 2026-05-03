from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.meeting import FindSlotsRequest, SlotResponse, MeetingCreate, MeetingResponse
from app.services import meet_service

router = APIRouter(
    prefix="/meetings",
    tags=["Meetings"]
)

@router.post("/find-slots", response_model=List[SlotResponse])
def find_slots(
    request: FindSlotsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Приймає параметри нової зустрічі, запускає алгоритм ковзного вікна 
    і повертає ТОП-5 найкращих часових слотів.
    """
    if request.duration_minutes % 15 != 0:
        raise HTTPException(
            status_code=400, 
            detail="Тривалість зустрічі має бути кратною 15 хвилинам."
        )
        
    if request.search_start >= request.search_end:
        raise HTTPException(
            status_code=400, 
            detail="Час початку пошуку має бути раніше за час кінця."
        )

    slots = meet_service.find_available_slots(db, request)
    
    if not slots:
        raise HTTPException(
            status_code=404, 
            detail="Не знайдено жодного вільного слоту у вказаному діапазоні."
        )
        
    return slots

@router.post("/", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_new_meeting(
    meeting_in: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Створює нову зустріч.
    """
    # Перевірка базової логіки: час кінця має бути після часу початку
    if meeting_in.start_time >= meeting_in.end_time:
        raise HTTPException(
            status_code=400, 
            detail="Час початку зустрічі має бути раніше за час кінця."
        )
        
    return meet_service.create_meeting(db, meeting_data=meeting_in, current_user_id=current_user.id)

@router.get("/", response_model=List[MeetingResponse])
def get_my_meetings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Отримує список усіх зустрічей поточного авторизованого користувача.
    """
    return meet_service.get_user_meetings(db, user_id=current_user.id)
