from sqlalchemy.orm import Session
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate

def get_projects(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Project).offset(skip).limit(limit).all()

def get_project(db: Session, project_id: int):
    return db.query(Project).filter(Project.id == project_id).first()

def create_project(db: Session, project: ProjectCreate):
    db_project = Project(
        name=project.name,
        description=project.description
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def update_project(db: Session, db_project: Project, project_update: ProjectUpdate):
    update_data = project_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_project, key, value)
    db.commit()
    db.refresh(db_project)
    return db_project

def delete_project(db: Session, db_project: Project):
    db.delete(db_project)
    db.commit()
    return db_project

def get_project_members(db: Session, project_id: int):
    return (
        db.query(User)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )

def add_project_member(db: Session, project_id: int, user_id: int):
    new_member = ProjectMember(project_id=project_id, user_id=user_id)
    db.add(new_member)
    db.commit()
    return new_member

def remove_project_member(db: Session, member: ProjectMember):
    db.delete(member)
    db.commit()
