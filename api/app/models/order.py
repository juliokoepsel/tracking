"""
Order Model - Beanie ODM Document for MongoDB
Stores order metadata (off-chain), linked to blockchain tracking via tracking_id
"""
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING
from typing import Optional, List
from datetime import datetime

from .enums import DeliveryStatus


class OrderItem(BaseModel):
    """Individual item in an order"""
    name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(..., gt=0)
    price: float = Field(..., ge=0)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Laptop",
                "quantity": 1,
                "price": 999.99
            }
        }


class Order(Document):
    """
    Order document stored in MongoDB (off-chain).
    
    Contains PII and business data that doesn't need blockchain immutability.
    Links to blockchain via tracking_id for delivery tracking.
    """
    tracking_id: str = Field(..., description="Links to blockchain delivery record")
    seller_id: str = Field(..., description="User ID of the seller")
    customer_id: str = Field(..., description="User ID of the customer")
    logistics_company_id: Optional[str] = None
    items: List[OrderItem]
    total_amount: float = Field(..., ge=0)
    status: DeliveryStatus = DeliveryStatus.PENDING_SHIPPING
    
    # Shipping details (PII - kept off-chain)
    shipping_address: str = Field(..., min_length=1, max_length=500)
    recipient_name: str = Field(..., min_length=1, max_length=100)
    recipient_phone: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "orders"
        indexes = [
            IndexModel([("tracking_id", ASCENDING)], unique=True),
            IndexModel([("seller_id", ASCENDING)]),
            IndexModel([("customer_id", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "tracking_id": "TRK-20251009-001",
                "seller_id": "507f1f77bcf86cd799439011",
                "customer_id": "507f1f77bcf86cd799439012",
                "items": [
                    {"name": "Laptop", "quantity": 1, "price": 999.99}
                ],
                "total_amount": 999.99,
                "status": "PENDING_SHIPPING",
                "shipping_address": "123 Main St, New York, NY 10001",
                "recipient_name": "John Doe"
            }
        }


class OrderCreate(BaseModel):
    """Schema for creating a new order"""
    customer_id: str
    items: List[OrderItem]
    shipping_address: str = Field(..., min_length=1, max_length=500)
    recipient_name: str = Field(..., min_length=1, max_length=100)
    recipient_phone: Optional[str] = None
    
    # Package details for blockchain
    package_weight: float = Field(..., gt=0, description="Weight in kg")
    package_length: float = Field(..., gt=0, description="Length in cm")
    package_width: float = Field(..., gt=0, description="Width in cm")
    package_height: float = Field(..., gt=0, description="Height in cm")
    package_description: str = Field(..., min_length=1, max_length=500)
    estimated_delivery_date: str = Field(..., description="ISO 8601 datetime string")

    class Config:
        json_schema_extra = {
            "example": {
                "customer_id": "507f1f77bcf86cd799439012",
                "items": [
                    {"name": "Laptop", "quantity": 1, "price": 999.99}
                ],
                "shipping_address": "123 Main St, New York, NY 10001",
                "recipient_name": "John Doe",
                "package_weight": 2.5,
                "package_length": 40.0,
                "package_width": 30.0,
                "package_height": 10.0,
                "package_description": "Electronics - Laptop",
                "estimated_delivery_date": "2025-10-15T10:00:00Z"
            }
        }


class OrderResponse(BaseModel):
    """Schema for order response"""
    id: str
    tracking_id: str
    seller_id: str
    customer_id: str
    logistics_company_id: Optional[str]
    items: List[OrderItem]
    total_amount: float
    status: DeliveryStatus
    shipping_address: str
    recipient_name: str
    recipient_phone: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439013",
                "tracking_id": "TRK-20251009-001",
                "seller_id": "507f1f77bcf86cd799439011",
                "customer_id": "507f1f77bcf86cd799439012",
                "logistics_company_id": None,
                "items": [
                    {"name": "Laptop", "quantity": 1, "price": 999.99}
                ],
                "total_amount": 999.99,
                "status": "PENDING_SHIPPING",
                "shipping_address": "123 Main St, New York, NY 10001",
                "recipient_name": "John Doe",
                "recipient_phone": None,
                "created_at": "2025-10-09T12:00:00Z",
                "updated_at": "2025-10-09T12:00:00Z"
            }
        }


class OrderListResponse(BaseModel):
    """Response model for list of orders"""
    success: bool
    message: str
    count: int
    data: list[OrderResponse]
