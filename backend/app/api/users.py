from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.schemas.user import UserResponse
from app.schemas.schedule import ScheduleCreate, ScheduleResponse
from app.services import user_service, schedule_service
from app.api.dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.get("/", response_model=List[UserResponse])
def read_all_users(
    skip: int = 0, limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отримати список усіх користувачів."""
    return user_service.get_all_users(db, skip=skip, limit=limit)

@router.get("/{user_id}/schedules", response_model=List[ScheduleResponse])
def read_user_schedules(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отримати робочий графік конкретного користувача по днях тижня."""
    return schedule_service.get_user_schedules(db, user_id=user_id)

@router.post("/{user_id}/schedules", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule_for_user(
    user_id: int,
    schedule: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Додати робочий день або вихідний до графіка користувача."""
    return schedule_service.create_user_schedule(db, user_id=user_id, schedule=schedule)

@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Видалити запис із графіка."""
    schedule_service.delete_schedule(db, schedule_id=schedule_id)
