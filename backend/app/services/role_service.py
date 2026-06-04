from sqlalchemy.orm import Session
from app.models.user import Role
from app.schemas.role import RoleCreate, RoleUpdate

def get_roles(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Role).offset(skip).limit(limit).all()

def create_role(db: Session, role: RoleCreate):
    db_role = Role(name=role.name, permissions=role.permissions)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

def update_role(db: Session, db_role: Role, role_update: RoleUpdate):
    update_data = role_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_role, key, value)
    db.commit()
    db.refresh(db_role)
    return db_role

def delete_role(db: Session, db_role: Role):
    db.delete(db_role)
    db.commit()
    return db_role
