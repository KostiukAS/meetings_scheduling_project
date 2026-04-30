from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.schemas.resource import ResourceCreate, ResourceResponse, ResourceUpdate
from app.services import resource_service
from app.api.dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/resources",
    tags=["Resources"]
)

@router.get("/", response_model=List[ResourceResponse])
def read_resources(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отримати список усіх ресурсів (кімнат та обладнання)."""
    return resource_service.get_resources(db, skip=skip, limit=limit)

@router.post("/", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
def create_resource(
    resource: ResourceCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Створити новий ресурс."""
    return resource_service.create_resource(db=db, resource=resource)

@router.get("/{resource_id}", response_model=ResourceResponse)
def read_resource(
    resource_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отримати конкретний ресурс за його ID."""
    db_resource = resource_service.get_resource(db, resource_id=resource_id)
    if db_resource is None:
        raise HTTPException(status_code=404, detail="Ресурс не знайдено")
    return db_resource

@router.put("/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: int, 
    resource_update: ResourceUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Оновити дані ресурсу."""
    db_resource = resource_service.get_resource(db, resource_id=resource_id)
    if db_resource is None:
        raise HTTPException(status_code=404, detail="Ресурс не знайдено")
    return resource_service.update_resource(db, db_resource, resource_update)

@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(
    resource_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Видалити ресурс."""
    db_resource = resource_service.get_resource(db, resource_id=resource_id)
    if db_resource is None:
        raise HTTPException(status_code=404, detail="Ресурс не знайдено")
    resource_service.delete_resource(db, db_resource)
