from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from enum import Enum


class DeliveryStatus(str, Enum):
    """Enum for delivery status"""
    PENDING = "PENDING"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    CANCELED = "CANCELED"


class PackageDimensions(BaseModel):
    """Model for package dimensions"""
    length: float = Field(..., gt=0, description="Length in cm")
    width: float = Field(..., gt=0, description="Width in cm")
    height: float = Field(..., gt=0, description="Height in cm")

    class Config:
        json_schema_extra = {
            "example": {
                "length": 30.0,
                "width": 20.0,
                "height": 15.0
            }
        }


class DeliveryBase(BaseModel):
    """Base model for delivery package"""
    senderName: str = Field(..., min_length=1, max_length=100)
    senderAddress: str = Field(..., min_length=1, max_length=500)
    recipientName: str = Field(..., min_length=1, max_length=100)
    recipientAddress: str = Field(..., min_length=1, max_length=500)
    packageWeight: float = Field(..., gt=0, description="Weight in kg")
    packageDimensions: PackageDimensions
    packageDescription: str = Field(..., min_length=1, max_length=500)
    estimatedDeliveryDate: str = Field(..., description="ISO 8601 datetime string")

    @field_validator('estimatedDeliveryDate')
    def validate_date(cls, v):
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError('Invalid datetime format. Use ISO 8601 format.')


class DeliveryCreate(DeliveryBase):
    """Model for creating a new delivery"""
    deliveryId: str = Field(..., min_length=1, max_length=50, pattern="^[A-Z0-9]+$")

    class Config:
        json_schema_extra = {
            "example": {
                "deliveryId": "DEL001",
                "senderName": "John Doe",
                "senderAddress": "123 Main St, New York, NY 10001",
                "recipientName": "Jane Smith",
                "recipientAddress": "456 Oak Ave, Los Angeles, CA 90001",
                "packageWeight": 2.5,
                "packageDimensions": {
                    "length": 30.0,
                    "width": 20.0,
                    "height": 15.0
                },
                "packageDescription": "Electronics - Laptop",
                "estimatedDeliveryDate": "2025-10-15T10:00:00Z"
            }
        }


class DeliveryUpdate(BaseModel):
    """Model for updating a delivery"""
    recipientAddress: Optional[str] = Field(None, min_length=1, max_length=500)
    deliveryStatus: Optional[DeliveryStatus] = None

    class Config:
        json_schema_extra = {
            "example": {
                "recipientAddress": "789 New St, Los Angeles, CA 90002",
                "deliveryStatus": "IN_TRANSIT"
            }
        }


class Delivery(DeliveryBase):
    """Complete delivery model with all fields"""
    deliveryId: str
    deliveryStatus: DeliveryStatus
    createdAt: str
    updatedAt: str

    class Config:
        json_schema_extra = {
            "example": {
                "deliveryId": "DEL001",
                "senderName": "John Doe",
                "senderAddress": "123 Main St, New York, NY 10001",
                "recipientName": "Jane Smith",
                "recipientAddress": "456 Oak Ave, Los Angeles, CA 90001",
                "packageWeight": 2.5,
                "packageDimensions": {
                    "length": 30.0,
                    "width": 20.0,
                    "height": 15.0
                },
                "packageDescription": "Electronics - Laptop",
                "deliveryStatus": "PENDING",
                "createdAt": "2025-10-09T12:00:00Z",
                "updatedAt": "2025-10-09T12:00:00Z",
                "estimatedDeliveryDate": "2025-10-15T10:00:00Z"
            }
        }


class DeliveryResponse(BaseModel):
    """Response model for delivery operations"""
    success: bool
    message: str
    data: Optional[Delivery] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Delivery created successfully",
                "data": {
                    "deliveryId": "DEL001",
                    "senderName": "John Doe",
                    "senderAddress": "123 Main St, New York, NY 10001",
                    "recipientName": "Jane Smith",
                    "recipientAddress": "456 Oak Ave, Los Angeles, CA 90001",
                    "packageWeight": 2.5,
                    "packageDimensions": {
                        "length": 30.0,
                        "width": 20.0,
                        "height": 15.0
                    },
                    "packageDescription": "Electronics - Laptop",
                    "deliveryStatus": "PENDING",
                    "createdAt": "2025-10-09T12:00:00Z",
                    "updatedAt": "2025-10-09T12:00:00Z",
                    "estimatedDeliveryDate": "2025-10-15T10:00:00Z"
                }
            }
        }


class DeliveryListResponse(BaseModel):
    """Response model for list of deliveries"""
    success: bool
    message: str
    count: int
    data: list[Delivery]

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Deliveries retrieved successfully",
                "count": 2,
                "data": [
                    {
                        "deliveryId": "DEL001",
                        "senderName": "John Doe",
                        "senderAddress": "123 Main St, New York, NY 10001",
                        "recipientName": "Jane Smith",
                        "recipientAddress": "456 Oak Ave, Los Angeles, CA 90001",
                        "packageWeight": 2.5,
                        "packageDimensions": {
                            "length": 30.0,
                            "width": 20.0,
                            "height": 15.0
                        },
                        "packageDescription": "Electronics - Laptop",
                        "deliveryStatus": "PENDING",
                        "createdAt": "2025-10-09T12:00:00Z",
                        "updatedAt": "2025-10-09T12:00:00Z",
                        "estimatedDeliveryDate": "2025-10-15T10:00:00Z"
                    }
                ]
            }
        }
