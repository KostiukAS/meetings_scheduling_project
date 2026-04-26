from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base

class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), primary_key=True)
    
    weight: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50), default="Pending")

class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    
    title: Mapped[str] = mapped_column(String(200))
    frequency: Mapped[str] = mapped_column(String(50), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime)
    end_time: Mapped[datetime] = mapped_column(DateTime)
    