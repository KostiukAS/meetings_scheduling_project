from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.meeting import (FindSlotsRequest, SlotResponse, MeetingCreate, MeetingResponse, 
                                 ParticipantStatusUpdate, AddParticipantRequest, AddResourceRequest,
                                 MeetingUpdate, ParticipantItem, ValidateSlotRequest, ValidateSlotResponse,
                                 StopRecurringRequest)
from app.models.meeting import Meeting, MeetingParticipant
from app.models.resource import MeetingResource, Resource
from app.services import meet_service

router = APIRouter(
    prefix="/meetings",
    tags=["Meetings"]
)


def _ensure_positive_time_range(start_time, end_time):
    if start_time >= end_time:
        raise HTTPException(
            status_code=400,
            detail="Час початку зустрічі має бути раніше за час кінця."
        )


def _ensure_slot_is_bookable(
    db: Session,
    *,
    start_time,
    end_time,
    users: list[ParticipantItem],
    resources: list[ParticipantItem],
    meeting_id: int | None = None,
):
    validation = meet_service.validate_meeting_slot(
        db,
        ValidateSlotRequest(
            start_time=start_time,
            end_time=end_time,
            meeting_id=meeting_id,
            soft_validation=True,
            users=users,
            resources=resources,
        )
    )
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail="Обраний слот має критичний конфлікт і недоступний для бронювання."
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
    if request.duration_minutes <= 0:
        raise HTTPException(
            status_code=400,
            detail="Тривалість зустрічі має бути більшою за 0 хвилин."
        )

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
    participants_for_validation = {participant.id: participant for participant in meeting_in.participants}
    participants_for_validation[current_user.id] = ParticipantItem(id=current_user.id, weight=1_000_000)

    _ensure_positive_time_range(meeting_in.start_time, meeting_in.end_time)
    _ensure_slot_is_bookable(
        db,
        start_time=meeting_in.start_time,
        end_time=meeting_in.end_time,
        users=list(participants_for_validation.values()),
        resources=meeting_in.resources,
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
    _ensure_positive_time_range(request.start_time, request.end_time)
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

    participant_items = [ParticipantItem(id=mp.user_id, weight=mp.weight) for mp in meeting.participants]
    participant_items.append(ParticipantItem(id=participant.user_id, weight=participant.weight))
    resource_items = [ParticipantItem(id=mr.resource_id, weight=mr.weight) for mr in meeting.resources]

    _ensure_slot_is_bookable(
        db,
        start_time=meeting.start_time,
        end_time=meeting.end_time,
        users=participant_items,
        resources=resource_items,
        meeting_id=meeting.id,
    )

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
    if "start_time" in update_data and update_data["start_time"]:
        update_data["start_time"] = meet_service.request_dt_to_utc(update_data["start_time"])
    if "end_time" in update_data and update_data["end_time"]:
        update_data["end_time"] = meet_service.request_dt_to_utc(update_data["end_time"])

    next_start_time = update_data.get("start_time", meeting.start_time)
    next_end_time = update_data.get("end_time", meeting.end_time)
    _ensure_positive_time_range(next_start_time, next_end_time)

    participant_items = [ParticipantItem(id=mp.user_id, weight=mp.weight) for mp in meeting.participants]
    resource_items = [ParticipantItem(id=mr.resource_id, weight=mr.weight) for mr in meeting.resources]
    _ensure_slot_is_bookable(
        db,
        start_time=next_start_time,
        end_time=next_end_time,
        users=participant_items,
        resources=resource_items,
        meeting_id=meeting.id,
    )

    for key, value in update_data.items():
        setattr(meeting, key, value)
        
    db.commit()
    db.refresh(meeting)
    return meeting

@router.patch("/{meeting_id}/stop", response_model=MeetingResponse)
def stop_recurring_meeting(
    meeting_id: int,
    stop_request: StopRecurringRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Зупинити повторювану зустріч з обраного часу (виключно)."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Зустріч не знайдено")

    if meeting.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Тільки організатор може зупиняти повторення")

    if not meeting.frequency or meeting.frequency == "once":
        raise HTTPException(status_code=400, detail="Зустріч не є періодичною")

    if meeting.period_stop_time is not None:
        raise HTTPException(status_code=400, detail="Повторення вже зупинено")

    stop_time_utc = meet_service.request_dt_to_utc(stop_request.stop_time)

    if stop_time_utc < meeting.start_time:
        raise HTTPException(status_code=400, detail="Час зупинки не може бути раніше старту")

    meeting.period_stop_time = stop_time_utc
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

@router.post("/{meeting_id}/resources", status_code=status.HTTP_201_CREATED)
def add_resource_to_meeting(
    meeting_id: int,
    resource: AddResourceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Додати новий ресурс до існуючої зустрічі"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Зустріч не знайдено")

    if meeting.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Тільки організатор може додавати ресурси")

    existing = db.query(MeetingResource).filter(
        MeetingResource.meeting_id == meeting_id,
        MeetingResource.resource_id == resource.resource_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ресурс вже додано")

    db_resource = db.query(Resource).filter(Resource.id == resource.resource_id).first()
    if not db_resource:
        raise HTTPException(status_code=404, detail="Ресурс не знайдено")

    participant_items = [ParticipantItem(id=mp.user_id, weight=mp.weight) for mp in meeting.participants]
    resource_items = [ParticipantItem(id=mr.resource_id, weight=mr.weight) for mr in meeting.resources]
    resource_items.append(ParticipantItem(id=resource.resource_id, weight=resource.weight))

    _ensure_slot_is_bookable(
        db,
        start_time=meeting.start_time,
        end_time=meeting.end_time,
        users=participant_items,
        resources=resource_items,
        meeting_id=meeting.id,
    )

    new_resource = MeetingResource(
        meeting_id=meeting_id,
        resource_id=resource.resource_id,
        weight=resource.weight
    )
    db.add(new_resource)
    db.commit()
    return {"message": "Ресурс успішно додано"}

@router.delete("/{meeting_id}/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_resource_from_meeting(
    meeting_id: int,
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Видалення ресурсу із зустрічі."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Зустріч не знайдено")

    if meeting.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Тільки організатор може видаляти ресурси")

    resource_link = db.query(MeetingResource).filter(
        MeetingResource.meeting_id == meeting_id,
        MeetingResource.resource_id == resource_id
    ).first()

    if not resource_link:
        raise HTTPException(status_code=404, detail="Ресурс не знайдено у цій зустрічі")

    db.delete(resource_link)
    db.commit()
    return {"detail": "Ресурс успішно видалено"}
