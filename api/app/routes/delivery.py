"""
Delivery Routes - Blockchain delivery operations
Handles delivery tracking, location updates, and custody handoffs
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
import logging

from app.models.user import User
from app.models.enums import UserRole
from app.services.auth import require_roles
from app.services import delivery_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/deliveries",
    tags=["deliveries"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized"},
        404: {"description": "Not found"},
    },
)


# ======================
# Request/Response DTOs
# ======================

class LocationUpdate(BaseModel):
    """Request to update delivery location"""
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    country: str = Field(..., min_length=1, max_length=100)
    
    class Config:
        json_schema_extra = {
            "example": {
                "city": "Chicago",
                "state": "IL",
                "country": "USA"
            }
        }


class HandoffInitiate(BaseModel):
    """Request to initiate a custody handoff"""
    to_user_id: str = Field(..., description="ID of the recipient")
    to_role: str = Field(..., description="Role of the recipient (DELIVERY_PERSON or CUSTOMER)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "to_user_id": "507f1f77bcf86cd799439011",
                "to_role": "DELIVERY_PERSON"
            }
        }


class HandoffDispute(BaseModel):
    """Request to dispute a handoff"""
    reason: str = Field(..., min_length=1, max_length=500)
    
    class Config:
        json_schema_extra = {
            "example": {
                "reason": "Package appears damaged"
            }
        }


class HandoffConfirm(BaseModel):
    """Request to confirm a handoff (for delivery person)"""
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    country: str = Field(..., min_length=1, max_length=100)
    package_weight: float = Field(..., gt=0, description="Package weight in kg")
    package_length: float = Field(..., gt=0, description="Package length in cm")
    package_width: float = Field(..., gt=0, description="Package width in cm")
    package_height: float = Field(..., gt=0, description="Package height in cm")
    
    class Config:
        json_schema_extra = {
            "example": {
                "city": "Chicago",
                "state": "IL",
                "country": "USA",
                "package_weight": 2.5,
                "package_length": 40.0,
                "package_width": 30.0,
                "package_height": 10.0
            }
        }


class DeliveryResponse(BaseModel):
    """Response for delivery operations"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Delivery retrieved successfully",
                "data": {
                    "deliveryId": "DEL-20251009-ABC12345",
                    "orderId": "507f1f77bcf86cd799439013",
                    "packageWeight": 2.5,
                    "packageDimensions": {"length": 40.0, "width": 30.0, "height": 10.0},
                    "deliveryStatus": "IN_TRANSIT",
                    "lastLocation": {"city": "Chicago", "state": "IL", "country": "USA"},
                    "currentCustodianId": "507f1f77bcf86cd799439011",
                    "currentCustodianRole": "DELIVERY_PERSON",
                    "updatedAt": "2025-10-09T14:30:00Z"
                }
            }
        }


class DeliveryListResponse(BaseModel):
    """Response for list of deliveries"""
    success: bool
    message: str
    count: int
    data: List[Dict[str, Any]]
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Deliveries retrieved successfully",
                "count": 1,
                "data": [
                    {
                        "deliveryId": "DEL-20251009-ABC12345",
                        "orderId": "507f1f77bcf86cd799439013",
                        "deliveryStatus": "IN_TRANSIT",
                        "currentCustodianId": "507f1f77bcf86cd799439011"
                    }
                ]
            }
        }


class DeliveryHistoryResponse(BaseModel):
    """Response for delivery history"""
    success: bool
    message: str
    count: int
    data: List[Dict[str, Any]]
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Delivery history retrieved successfully",
                "count": 3,
                "data": [
                    {
                        "txId": "abc123...",
                        "timestamp": "2025-10-09T10:00:00Z",
                        "delivery": {
                            "deliveryId": "DEL-20251009-ABC12345",
                            "deliveryStatus": "PENDING_PICKUP"
                        }
                    }
                ]
            }
        }


# ======================
# Delivery Routes
# ======================

@router.get(
    "/{delivery_id}",
    response_model=DeliveryResponse,
    summary="Get delivery by ID",
    description="Retrieve a specific delivery by its ID from the blockchain."
)
async def get_delivery(
    delivery_id: str,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.CUSTOMER, UserRole.DELIVERY_PERSON, UserRole.ADMIN))
):
    """
    Retrieve a delivery by its ID.
    
    Available to SELLER, CUSTOMER, DELIVERY_PERSON (if involved), and ADMIN.
    """
    result = await delivery_service.get_delivery(
        delivery_id=delivery_id,
        caller_id=str(current_user.id),
        caller_role=current_user.role.value
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result.get("error", f"Delivery {delivery_id} not found")
        )
    
    return DeliveryResponse(
        success=True,
        message="Delivery retrieved successfully",
        data=result.get("data")
    )


@router.get(
    "",
    response_model=DeliveryListResponse,
    summary="Get my deliveries",
    description="Get deliveries where current user is the custodian."
)
async def get_my_deliveries(
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.DELIVERY_PERSON, UserRole.ADMIN))
):
    """
    Get all deliveries where the current user is the custodian.
    
    Available to SELLER, DELIVERY_PERSON, and ADMIN.
    """
    result = await delivery_service.get_my_deliveries(
        caller_id=str(current_user.id),
        caller_role=current_user.role.value
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Failed to retrieve deliveries")
        )
    
    deliveries = result.get("data", [])
    
    return DeliveryListResponse(
        success=True,
        message="Deliveries retrieved successfully",
        count=len(deliveries) if deliveries else 0,
        data=deliveries or []
    )


@router.get(
    "/status/{status}",
    response_model=DeliveryListResponse,
    summary="Get deliveries by status",
    description="Get deliveries with a specific status where current user is involved."
)
async def get_deliveries_by_status(
    status: str,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.DELIVERY_PERSON, UserRole.CUSTOMER, UserRole.ADMIN))
):
    """
    Get deliveries filtered by status where the current user is involved.
    Admin can see all deliveries with the specified status.
    """
    result = await delivery_service.get_deliveries_by_status(
        status=status,
        caller_id=str(current_user.id),
        caller_role=current_user.role.value
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Failed to retrieve deliveries")
        )
    
    deliveries = result.get("data", [])
    
    return DeliveryListResponse(
        success=True,
        message=f"Deliveries with status {status} retrieved successfully",
        count=len(deliveries) if deliveries else 0,
        data=deliveries or []
    )


@router.put(
    "/{delivery_id}/location",
    response_model=DeliveryResponse,
    summary="Update delivery location",
    description="Update the last known location of a delivery. Delivery person only."
)
async def update_location(
    delivery_id: str,
    location: LocationUpdate,
    current_user: User = Depends(require_roles(UserRole.DELIVERY_PERSON))
):
    """
    Update the location of a delivery.
    
    Only the current DELIVERY_PERSON custodian can update location.
    Delivery must be IN_TRANSIT.
    """
    result = await delivery_service.update_location(
        delivery_id=delivery_id,
        city=location.city,
        state=location.state,
        country=location.country,
        caller_id=str(current_user.id),
        caller_role=current_user.role.value
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to update location")
        )
    
    logger.info(f"Delivery {delivery_id} location updated by {current_user.username}")
    
    return DeliveryResponse(
        success=True,
        message="Location updated successfully",
        data=None
    )


@router.put(
    "/{delivery_id}/cancel",
    response_model=DeliveryResponse,
    summary="Cancel a delivery",
    description="Cancel a delivery. Customer only, before pickup."
)
async def cancel_delivery(
    delivery_id: str,
    current_user: User = Depends(require_roles(UserRole.CUSTOMER))
):
    """
    Cancel a delivery.
    
    Only the CUSTOMER who ordered the delivery can cancel it,
    and only before it has been picked up.
    """
    result = await delivery_service.cancel_delivery(
        delivery_id=delivery_id,
        caller_id=str(current_user.id),
        caller_role=current_user.role.value
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to cancel delivery")
        )
    
    logger.info(f"Delivery {delivery_id} cancelled by {current_user.username}")
    
    return DeliveryResponse(
        success=True,
        message="Delivery cancelled successfully",
        data=None
    )


@router.get(
    "/{delivery_id}/history",
    response_model=DeliveryHistoryResponse,
    summary="Get delivery history",
    description="Get the complete history of a delivery from blockchain. Only seller, customer, or admin."
)
async def get_delivery_history(
    delivery_id: str,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.CUSTOMER, UserRole.ADMIN))
):
    """
    Get the complete history of a delivery.
    
    Uses blockchain's GetHistoryForKey to retrieve all state changes.
    Available to involved users and ADMIN.
    """
    result = await delivery_service.get_delivery_history(
        delivery_id=delivery_id,
        caller_id=str(current_user.id),
        caller_role=current_user.role.value
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result.get("error", "Failed to retrieve history")
        )
    
    history_data = result.get("data", [])
    return DeliveryHistoryResponse(
        success=True,
        message="Delivery history retrieved successfully",
        count=len(history_data),
        data=history_data
    )


# ======================
# Handoff Routes
# ======================

@router.post(
    "/{delivery_id}/handoff/initiate",
    response_model=DeliveryResponse,
    summary="Initiate a custody handoff",
    description="Start a custody transfer to another user. Seller or Delivery person."
)
async def initiate_handoff(
    delivery_id: str,
    handoff: HandoffInitiate,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.DELIVERY_PERSON))
):
    """
    Initiate a custody handoff.
    
    The current custodian can initiate a handoff to:
    - DELIVERY_PERSON (for pickup or transit handoff)
    - CUSTOMER (for final delivery)
    """
    # Validate to_role
    valid_roles = ["DELIVERY_PERSON", "CUSTOMER"]
    if handoff.to_role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target role. Must be one of: {valid_roles}"
        )
    
    result = await delivery_service.initiate_handoff(
        delivery_id=delivery_id,
        to_user_id=handoff.to_user_id,
        to_role=handoff.to_role,
        caller_id=str(current_user.id),
        caller_role=current_user.role.value
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to initiate handoff")
        )
    
    logger.info(f"Handoff initiated for {delivery_id} by {current_user.username} to {handoff.to_user_id}")
    
    return DeliveryResponse(
        success=True,
        message="Handoff initiated successfully",
        data=None
    )


@router.post(
    "/{delivery_id}/handoff/confirm",
    response_model=DeliveryResponse,
    summary="Confirm a custody handoff",
    description="Accept a pending custody transfer. Delivery person must provide location and package info. Customer uses their address automatically."
)
async def confirm_handoff(
    delivery_id: str,
    confirm_data: Optional[HandoffConfirm] = None,
    current_user: User = Depends(require_roles(UserRole.DELIVERY_PERSON, UserRole.CUSTOMER))
):
    """
    Confirm a pending custody handoff.
    
    - DELIVERY_PERSON: Must provide location and package dimensions in request body
    - CUSTOMER: Uses their profile address and keeps current package dimensions
    """
    # For DELIVERY_PERSON, confirm_data is required
    if current_user.role == UserRole.DELIVERY_PERSON:
        if not confirm_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery person must provide location and package information"
            )
        city = confirm_data.city
        state = confirm_data.state
        country = confirm_data.country
        package_weight = confirm_data.package_weight
        package_length = confirm_data.package_length
        package_width = confirm_data.package_width
        package_height = confirm_data.package_height
    else:
        # CUSTOMER - use their address from profile
        if not current_user.address:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer must have an address configured to confirm delivery"
            )
        city = current_user.address.city
        state = current_user.address.state
        country = current_user.address.country
        
        # Get current package dimensions from the delivery
        delivery_result = await delivery_service.get_delivery(
            delivery_id=delivery_id,
            caller_id=str(current_user.id),
            caller_role=current_user.role.value
        )
        if not delivery_result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=delivery_result.get("error", "Delivery not found")
            )
        delivery_data = delivery_result.get("data", {})
        package_weight = delivery_data.get("packageWeight", 0)
        dimensions = delivery_data.get("packageDimensions", {})
        package_length = dimensions.get("length", 0)
        package_width = dimensions.get("width", 0)
        package_height = dimensions.get("height", 0)
    
    result = await delivery_service.confirm_handoff(
        delivery_id=delivery_id,
        city=city,
        state=state,
        country=country,
        package_weight=package_weight,
        dimension_length=package_length,
        dimension_width=package_width,
        dimension_height=package_height,
        caller_id=str(current_user.id),
        caller_role=current_user.role.value
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to confirm handoff")
        )
    
    logger.info(f"Handoff confirmed for {delivery_id} by {current_user.username}")
    
    return DeliveryResponse(
        success=True,
        message="Handoff confirmed successfully",
        data=None
    )


@router.post(
    "/{delivery_id}/handoff/dispute",
    response_model=DeliveryResponse,
    summary="Dispute a custody handoff",
    description="Reject a pending custody transfer with reason. Delivery person or Customer."
)
async def dispute_handoff(
    delivery_id: str,
    dispute: HandoffDispute,
    current_user: User = Depends(require_roles(UserRole.DELIVERY_PERSON, UserRole.CUSTOMER))
):
    """
    Dispute a pending custody handoff.
    
    The intended recipient can dispute if package is damaged, missing, etc.
    """
    result = await delivery_service.dispute_handoff(
        delivery_id=delivery_id,
        reason=dispute.reason,
        caller_id=str(current_user.id),
        caller_role=current_user.role.value
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to dispute handoff")
        )
    
    logger.info(f"Handoff disputed for {delivery_id} by {current_user.username}: {dispute.reason}")
    
    return DeliveryResponse(
        success=True,
        message="Handoff disputed successfully",
        data=None
    )


@router.post(
    "/{delivery_id}/handoff/cancel",
    response_model=DeliveryResponse,
    summary="Cancel a pending handoff",
    description="Cancel a pending custody transfer. Only the initiator can cancel."
)
async def cancel_handoff(
    delivery_id: str,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.DELIVERY_PERSON))
):
    """
    Cancel a pending custody handoff.
    
    Only the user who initiated the handoff can cancel it.
    """
    result = await delivery_service.cancel_handoff(
        delivery_id=delivery_id,
        caller_id=str(current_user.id),
        caller_role=current_user.role.value
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to cancel handoff")
        )
    
    logger.info(f"Handoff cancelled for {delivery_id} by {current_user.username}")
    
    return DeliveryResponse(
        success=True,
        message="Handoff cancelled successfully",
        data=None
    )
