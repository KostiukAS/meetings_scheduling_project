from sqlalchemy.orm import Session
from app.models.resource import Resource
from app.schemas.resource import ResourceCreate, ResourceUpdate

def get_resources(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Resource).offset(skip).limit(limit).all()

def get_resource(db: Session, resource_id: int):
    return db.query(Resource).filter(Resource.id == resource_id).first()

def create_resource(db: Session, resource: ResourceCreate):
    db_resource = Resource(
        name=resource.name,
        type=resource.type,
        capacity=resource.capacity
    )
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    return db_resource

def update_resource(db: Session, db_resource: Resource, resource_update: ResourceUpdate):
    update_data = resource_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_resource, key, value)
    
    db.commit()
    db.refresh(db_resource)
    return db_resource

def delete_resource(db: Session, db_resource: Resource):
    db.delete(db_resource)
    db.commit()
    return db_resource
