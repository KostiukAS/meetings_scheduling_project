from typing import TYPE_CHECKING, List, Optional
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base

if TYPE_CHECKING:
    from app.models.resource import MeetingResource
    from app.models.user import User

class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), primary_key=True)
    
    weight: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50), default="Pending")

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="participants")
    user: Mapped["User"] = relationship("User")

    @property
    def id(self) -> int:
        return self.user_id

    @property
    def email(self) -> str:
        return self.user.email if self.user else ""

    @property
    def full_name(self) -> Optional[str]:
        return self.user.full_name if self.user else None

class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=True)
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    frequency: Mapped[str] = mapped_column(String(50), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime)
    end_time: Mapped[datetime] = mapped_column(DateTime)
    period_stop_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    participants: Mapped[List["MeetingParticipant"]] = relationship(
        "MeetingParticipant", 
        back_populates="meeting",
        cascade="all, delete-orphan"
    )
    resources: Mapped[List["MeetingResource"]] = relationship(
        "MeetingResource", 
        back_populates="meeting",
        cascade="all, delete-orphan"
    )
