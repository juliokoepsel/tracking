"""
ShopItem Model - Beanie ODM Document for MongoDB
Stores seller's product catalog
"""
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING
from typing import Optional
from datetime import datetime


class ShopItem(Document):
    """
    Shop item document stored in MongoDB.
    
    Represents a product that a seller offers for sale.
    Price is stored in cents to avoid floating point issues.
    """
    seller_id: str = Field(..., description="User ID of the seller who owns this item")
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    price: int = Field(..., gt=0, description="Price in cents (e.g., 1999 = $19.99)")
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "shop_items"
        indexes = [
            IndexModel([("seller_id", ASCENDING)]),
            IndexModel([("is_active", ASCENDING)]),
            IndexModel([("name", ASCENDING)]),
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "seller_id": "507f1f77bcf86cd799439011",
                "name": "Laptop Computer",
                "description": "High-performance laptop with 16GB RAM and 512GB SSD",
                "price": 99999,
                "is_active": True
            }
        }


class ShopItemCreate(BaseModel):
    """Schema for creating a new shop item"""
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    price: int = Field(..., gt=0, description="Price in cents (e.g., 1999 = $19.99)")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Laptop Computer",
                "description": "High-performance laptop with 16GB RAM and 512GB SSD",
                "price": 99999
            }
        }


class ShopItemUpdate(BaseModel):
    """Schema for updating a shop item"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1, max_length=2000)
    price: Optional[int] = Field(None, gt=0, description="Price in cents")
    is_active: Optional[bool] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated Laptop Computer",
                "description": "Updated description with new features",
                "price": 89999,
                "is_active": True
            }
        }


class ShopItemResponse(BaseModel):
    """Schema for shop item response"""
    id: str
    seller_id: str
    name: str
    description: str
    price: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439013",
                "seller_id": "507f1f77bcf86cd799439011",
                "name": "Laptop Computer",
                "description": "High-performance laptop with 16GB RAM and 512GB SSD",
                "price": 99999,
                "is_active": True,
                "created_at": "2025-10-09T12:00:00Z",
                "updated_at": "2025-10-09T12:00:00Z"
            }
        }
