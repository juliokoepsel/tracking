"""
Order Model - Beanie ODM Document for MongoDB
Stores order data (off-chain), linked to blockchain delivery via delivery_id
"""
from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING
from typing import Optional, List
from datetime import datetime

from .enums import DeliveryStatus


class OrderItem(BaseModel):
    """
    Individual item in an order.
    Links to a ShopItem by ID and includes quantity ordered.
    """
    item_id: str = Field(..., description="ID of the ShopItem")
    quantity: int = Field(..., gt=0)
    price_at_purchase: int = Field(..., gt=0, description="Price in cents at time of purchase")

    class Config:
        json_schema_extra = {
            "example": {
                "item_id": "507f1f77bcf86cd799439014",
                "quantity": 1,
                "price_at_purchase": 99999
            }
        }


class Order(Document):
    """
    Order document stored in MongoDB (off-chain).
    
    Contains business data that doesn't need blockchain immutability.
    Links to blockchain via delivery_id for delivery tracking.
    
    Flow:
    1. Customer creates order (status: PENDING_CONFIRMATION)
    2. Seller confirms order -> Creates delivery on blockchain
    3. Delivery status synced from blockchain events
    """
    seller_id: str = Field(..., description="User ID of the seller")
    customer_id: str = Field(..., description="User ID of the customer")
    items: List[OrderItem] = Field(..., min_length=1)
    total_amount: int = Field(..., ge=0, description="Total in cents")
    delivery_id: Optional[str] = Field(None, description="Links to blockchain delivery record after confirmation")
    status: DeliveryStatus = DeliveryStatus.PENDING_CONFIRMATION
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "orders"
        indexes = [
            IndexModel([("seller_id", ASCENDING)]),
            IndexModel([("customer_id", ASCENDING)]),
            IndexModel([("delivery_id", ASCENDING)], sparse=True),
            IndexModel([("status", ASCENDING)]),
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "seller_id": "507f1f77bcf86cd799439011",
                "customer_id": "507f1f77bcf86cd799439012",
                "items": [
                    {"item_id": "507f1f77bcf86cd799439014", "quantity": 1, "price_at_purchase": 99999}
                ],
                "total_amount": 99999,
                "delivery_id": None,
                "status": "PENDING_CONFIRMATION"
            }
        }


class OrderCreate(BaseModel):
    """
    Schema for creating a new order.
    Customer provides seller, items, and quantities.
    """
    seller_id: str = Field(..., description="User ID of the seller")
    items: List[OrderItem] = Field(..., min_length=1)

    class Config:
        json_schema_extra = {
            "example": {
                "seller_id": "507f1f77bcf86cd799439011",
                "items": [
                    {"item_id": "507f1f77bcf86cd799439014", "quantity": 1, "price_at_purchase": 99999}
                ]
            }
        }


class OrderConfirm(BaseModel):
    """
    Schema for seller to confirm an order and create delivery on blockchain.
    Package details are provided at confirmation time.
    """
    package_weight: float = Field(..., gt=0, description="Weight in kg")
    package_length: float = Field(..., gt=0, description="Length in cm")
    package_width: float = Field(..., gt=0, description="Width in cm")
    package_height: float = Field(..., gt=0, description="Height in cm")

    class Config:
        json_schema_extra = {
            "example": {
                "package_weight": 2.5,
                "package_length": 40.0,
                "package_width": 30.0,
                "package_height": 10.0
            }
        }


class OrderResponse(BaseModel):
    """Schema for order response"""
    id: str
    seller_id: str
    customer_id: str
    items: List[OrderItem]
    total_amount: int
    delivery_id: Optional[str]
    status: DeliveryStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439013",
                "seller_id": "507f1f77bcf86cd799439011",
                "customer_id": "507f1f77bcf86cd799439012",
                "items": [
                    {"item_id": "507f1f77bcf86cd799439014", "quantity": 1, "price_at_purchase": 99999}
                ],
                "total_amount": 99999,
                "delivery_id": "DEL-20251009-001",
                "status": "PENDING_PICKUP",
                "created_at": "2025-10-09T12:00:00Z",
                "updated_at": "2025-10-09T12:00:00Z"
            }
        }


class OrderListResponse(BaseModel):
    """Response model for list of orders"""
    success: bool
    message: str
    count: int
    data: List[OrderResponse]

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Orders retrieved successfully",
                "count": 1,
                "data": [
                    {
                        "id": "507f1f77bcf86cd799439013",
                        "seller_id": "507f1f77bcf86cd799439011",
                        "customer_id": "507f1f77bcf86cd799439012",
                        "items": [
                            {"item_id": "507f1f77bcf86cd799439014", "quantity": 1, "price_at_purchase": 99999}
                        ],
                        "total_amount": 99999,
                        "delivery_id": None,
                        "status": "PENDING_CONFIRMATION",
                        "created_at": "2025-10-09T12:00:00Z",
                        "updated_at": "2025-10-09T12:00:00Z"
                    }
                ]
            }
        }
