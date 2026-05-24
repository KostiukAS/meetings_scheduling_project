from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.meeting import (FindSlotsRequest, SlotResponse, MeetingCreate, MeetingResponse, 
                                 ParticipantStatusUpdate, AddParticipantRequest, MeetingUpdate, 
                                 ValidateSlotRequest, ValidateSlotResponse)
from app.models.meeting import Meeting, MeetingParticipant
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

@router.post("/validate-slot", response_model=ValidateSlotResponse)
def validate_slot_endpoint(
    request: ValidateSlotRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Валідація конкретного вікна на наявність конфліктів."""
    from app.services.meet_service import validate_meeting_slot
    return validate_meeting_slot(db, request)

@router.post("/{meeting_id}/participants", status_code=status.HTTP_201_CREATED)
def add_participant_to_meeting(
    meeting_id: int,
    participant: AddParticipantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Додати нового учасника до існуючої зустрічі"""
    
    # 1. Перевіряємо чи існує зустріч
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Зустріч не знайдено")
        
    # 2. Перевіряємо права доступу
    if meeting.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Тільки організатор може додавати учасників")

    if participant.user_id == meeting.organizer_id:
        raise HTTPException(status_code=400, detail="Організатор вже є учасником")

    existing = db.query(MeetingParticipant).filter(
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.user_id == participant.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Користувач вже є учасником")

    # 3. Додаємо запис у таблицю зв'язку
    new_participant = MeetingParticipant(
        meeting_id=meeting_id,
        user_id=participant.user_id,
        weight=participant.weight,
        status="Waiting for response"
    )
    db.add(new_participant)
    db.commit()
    return {"message": "Учасника успішно додано"}

@router.patch("/{meeting_id}/participants/{user_id}/status")
def update_participant_status(
    meeting_id: int,
    user_id: int,
    status_update: ParticipantStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Оновити статус учасника."""
    
    # Перевірка: тільки сам користувач може змінити свій статус RSVP
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Ви можете змінити лише свій статус")

    participant = db.query(MeetingParticipant).filter(
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.user_id == user_id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Учасника не знайдено на цій зустрічі")
        
    participant.status = status_update.status
    db.commit()
    return {"message": f"Статус успішно змінено на {status_update.status}"}

@router.patch("/{meeting_id}", response_model=MeetingResponse)
def update_meeting(
    meeting_id: int,
    meeting_update: MeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Оновлення зустрічі."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Зустріч не знайдено")

    is_organizer = meeting.organizer_id == current_user.id
    is_participant = db.query(MeetingParticipant).filter(
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.user_id == current_user.id
    ).first() is not None

    if not is_organizer and not is_participant:
        raise HTTPException(status_code=403, detail="Ви не маєте доступу до цієї зустрічі")

    if not is_organizer:
        if meeting_update.start_time or meeting_update.end_time or meeting_update.frequency:
            raise HTTPException(
                status_code=403, 
                detail="Тільки організатор може змінювати час або частоту зустрічі"
            )

    update_data = meeting_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(meeting, key, value)
        
    db.commit()
    db.refresh(meeting)
    return meeting

@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Видалення зустрічі."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Зустріч не знайдено")
        
    if meeting.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Тільки організатор може видалити зустріч")

    db.delete(meeting)
    db.commit()
    return {"detail": "Зустріч успішно видалена"}

@router.delete("/{meeting_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_participant_from_meeting(
    meeting_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Видалення учасника із зустрічі."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Зустріч не знайдено")

    if meeting.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Тільки організатор може видаляти учасників")

    if meeting.organizer_id == user_id:
        raise HTTPException(status_code=400, detail="Неможливо видалити організатора")

    participant = db.query(MeetingParticipant).filter(
        MeetingParticipant.meeting_id == meeting_id,
        MeetingParticipant.user_id == user_id
    ).first()

    if not participant:
        raise HTTPException(status_code=404, detail="Учасника не знайдено на цій зустрічі")

    db.delete(participant)
    db.commit()
    return {"detail": "Учасника успішно видалено"}
