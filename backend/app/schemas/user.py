from pydantic import BaseModel, EmailStr

# Базова схема із загальними атрибутами
class UserBase(BaseModel):
    email: EmailStr
    full_name: str

# Схема для реєстрації (створення) користувача
class UserCreate(UserBase):
    password: str
    role_id: int

# Схема для логіну (екран входу)
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Схема для повернення даних клієнту
class UserResponse(UserBase):
    id: int
    role_id: int

    model_config = {
        "from_attributes": True
    }
