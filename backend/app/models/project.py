from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base

class ProjectMember(Base):
    __tablename__ = "project_members"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), primary_key=True)

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    