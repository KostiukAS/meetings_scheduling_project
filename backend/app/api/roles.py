from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.schemas.role import RoleCreate, RoleResponse, RoleUpdate
from app.services import role_service
from app.api.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/roles", tags=["Roles"])

@router.get("/", response_model=List[RoleResponse])
def read_roles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return role_service.get_roles(db, skip=skip, limit=limit)

@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(role: RoleCreate, db: Session = Depends(get_db)):
    return role_service.create_role(db, role)

@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.user import Role
    db_role = db.query(Role).filter(Role.id == role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Роль не знайдено")
    role_service.delete_role(db, db_role)
