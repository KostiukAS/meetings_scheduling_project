from sqlalchemy.orm import Session
from app.models.user import Schedule
from app.schemas.schedule import ScheduleCreate

def get_user_schedules(db: Session, user_id: int):
    return db.query(Schedule).filter(Schedule.user_id == user_id).all()

def create_user_schedule(db: Session, user_id: int, schedule: ScheduleCreate):
    db_schedule = Schedule(
        user_id=user_id,
        day_of_week=schedule.day_of_week,
        start_time=schedule.start_time,
        end_time=schedule.end_time,
        is_day_off=schedule.is_day_off
    )
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

def delete_schedule(db: Session, schedule_id: int):
    db_schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if db_schedule:
        db.delete(db_schedule)
        db.commit()
    return db_schedule
