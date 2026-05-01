from typing import TYPE_CHECKING
from sqlalchemy import String, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base

if TYPE_CHECKING:
    from app.models.meeting import Meeting

class MeetingResource(Base):
    __tablename__ = "meeting_resources"

    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id"), primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), primary_key=True)
    
    weight: Mapped[int] = mapped_column(Integer)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="resources")

class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(50))
    capacity: Mapped[int] = mapped_column(Integer, nullable=True)
    