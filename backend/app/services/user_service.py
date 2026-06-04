from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password

def get_user_by_email(db: Session, email: str):
    """Шукає користувача в базі за його email."""
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate):
    """Створює нового користувача в базі даних із захешованим паролем."""
    hashed_password = get_password_hash(user.password)
    
    db_user = User(
        email=user.email,
        full_name=user.full_name,
        password_hash=hashed_password,
        role_id=user.role_id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, email: str, password: str):
    """Перевіряє, чи існує користувач і чи правильний у нього пароль."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

def get_all_users(db: Session, skip: int = 0, limit: int = 100):
    """Повертає список усіх користувачів системи."""
    return db.query(User).offset(skip).limit(limit).all()
