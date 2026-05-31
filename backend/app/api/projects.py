from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate, ProjectMemberAdd
from app.schemas.user import UserResponse
from app.services import project_service
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.project import ProjectMember

router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)

@router.get("/", response_model=List[ProjectResponse])
def read_projects(
    skip: int = 0, limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return project_service.get_projects(db, skip=skip, limit=limit)

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return project_service.create_project(db, project)

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_project = project_service.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Проєкт не знайдено")
    project_service.delete_project(db, db_project)

@router.get("/{project_id}/members", response_model=List[UserResponse])
def read_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_project = project_service.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Проєкт не знайдено")
    return project_service.get_project_members(db, project_id)

@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
def add_project_member(
    project_id: int,
    member: ProjectMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_project = project_service.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Проєкт не знайдено")

    user = db.query(User).filter(User.id == member.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")

    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == member.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Користувач вже є учасником проєкту")

    project_service.add_project_member(db, project_id, member.user_id)
    return {"message": "Учасника додано до проєкту"}

@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_project = project_service.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Проєкт не знайдено")

    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Учасника не знайдено в цьому проєкті")

    project_service.remove_project_member(db, member)
