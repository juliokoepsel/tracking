"""
User Model - Beanie ODM Document for MongoDB
Handles user authentication and role management
"""
from beanie import Document
from pydantic import BaseModel, EmailStr, Field
from pymongo import IndexModel, ASCENDING
from typing import Optional
from datetime import datetime

from .enums import UserRole


class User(Document):
    """
    User document stored in MongoDB.
    
    Users are identified by username and have roles that determine
    their access to different parts of the system.
    """
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    hashed_password: str
    role: UserRole
    full_name: str = Field(..., min_length=1, max_length=100)
    organization_id: Optional[str] = None  # For delivery people: logistics company ID
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "users"
        indexes = [
            IndexModel([("username", ASCENDING)], unique=True),
            IndexModel([("email", ASCENDING)], unique=True),
            IndexModel([("role", ASCENDING)]),
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "username": "johndoe",
                "email": "john@example.com",
                "role": "CUSTOMER",
                "full_name": "John Doe",
                "is_active": True
            }
        }


class UserCreate(BaseModel):
    """Schema for creating a new user"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    role: UserRole
    full_name: str = Field(..., min_length=1, max_length=100)
    organization_id: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "username": "johndoe",
                "email": "john@example.com",
                "password": "securepassword123",
                "role": "CUSTOMER",
                "full_name": "John Doe"
            }
        }


class UserUpdate(BaseModel):
    """Schema for updating a user"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    organization_id: Optional[str] = None
    is_active: Optional[bool] = None

    class Config:
        json_schema_extra = {
            "example": {
                "email": "newemail@example.com",
                "full_name": "John Updated Doe",
                "is_active": True
            }
        }


class UserResponse(BaseModel):
    """Schema for user response (excludes password)"""
    id: str
    username: str
    email: EmailStr
    role: UserRole
    full_name: str
    organization_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "username": "johndoe",
                "email": "john@example.com",
                "role": "CUSTOMER",
                "full_name": "John Doe",
                "organization_id": None,
                "is_active": True,
                "created_at": "2025-10-09T12:00:00Z",
                "updated_at": "2025-10-09T12:00:00Z"
            }
        }


class UserListResponse(BaseModel):
    """Response model for list of users"""
    success: bool
    message: str
    count: int
    data: list[UserResponse]
