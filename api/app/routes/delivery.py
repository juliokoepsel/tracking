"""
Delivery API Routes
Handles all CRUD operations for package deliveries
"""
from fastapi import APIRouter, HTTPException, status, Depends
import logging

from app.models.delivery import (
    DeliveryCreate,
    DeliveryUpdate,
    DeliveryResponse,
    DeliveryListResponse,
    DeliveryStatus
)
from app.models.user import User
from app.models.enums import UserRole
from app.services.fabric_client import fabric_client
from app.services.auth import get_current_user, require_roles

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


@router.post(
    "",
    response_model=DeliveryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new delivery",
    description="Create a new package delivery record on the blockchain. Sellers and Admins only."
)
async def create_delivery(
    delivery: DeliveryCreate,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.ADMIN))
):
    """
    Create a new delivery with the following information:
    
    - **deliveryId**: Unique identifier (uppercase alphanumeric)
    - **senderName**: Name of the sender
    - **senderAddress**: Full address of the sender
    - **recipientName**: Name of the recipient
    - **recipientAddress**: Full address of the recipient
    - **packageWeight**: Weight in kilograms
    - **packageDimensions**: Length, width, and height in centimeters
    - **packageDescription**: Description of package contents
    - **estimatedDeliveryDate**: Expected delivery date (ISO 8601 format)
    """
    try:
        # Invoke chaincode with ownership
        result = fabric_client.create_delivery(
            tracking_id=delivery.deliveryId,
            sender_name=delivery.senderName,
            sender_address=delivery.senderAddress,
            recipient_name=delivery.recipientName,
            recipient_address=delivery.recipientAddress,
            package_weight=delivery.packageWeight,
            dimension_length=delivery.packageDimensions.length,
            dimension_width=delivery.packageDimensions.width,
            dimension_height=delivery.packageDimensions.height,
            package_description=delivery.packageDescription,
            estimated_delivery_date=delivery.estimatedDeliveryDate,
            owner_id=str(current_user.id),
            owner_role=current_user.role.value
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to create delivery")
            )
        
        # Retrieve the created delivery
        created_delivery = fabric_client.read_delivery(delivery.deliveryId)
        
        if not created_delivery.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Delivery created but failed to retrieve"
            )
        
        return DeliveryResponse(
            success=True,
            message="Delivery created successfully",
            data=created_delivery.get("data")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating delivery: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/{delivery_id}",
    response_model=DeliveryResponse,
    summary="Get delivery by ID",
    description="Retrieve a specific delivery by its ID from the blockchain. Requires authentication."
)
async def get_delivery(
    delivery_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve a delivery by its ID.
    
    - **delivery_id**: The unique identifier of the delivery
    """
    try:
        result = fabric_client.read_delivery(delivery_id)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Delivery {delivery_id} not found"
            )
        
        return DeliveryResponse(
            success=True,
            message="Delivery retrieved successfully",
            data=result.get("data")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving delivery: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "",
    response_model=DeliveryListResponse,
    summary="Get all deliveries",
    description="Retrieve all deliveries from the blockchain. Requires authentication."
)
async def get_all_deliveries(
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all deliveries stored on the blockchain.
    """
    try:
        result = fabric_client.query_all_deliveries()
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve deliveries"
            )
        
        deliveries = result.get("data", [])
        
        return DeliveryListResponse(
            success=True,
            message="Deliveries retrieved successfully",
            count=len(deliveries),
            data=deliveries
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving deliveries: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.put(
    "/{delivery_id}",
    response_model=DeliveryResponse,
    summary="Update delivery",
    description="Update delivery information on the blockchain. Sellers, Delivery Personnel, and Admins only."
)
async def update_delivery(
    delivery_id: str, 
    delivery_update: DeliveryUpdate,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.DELIVERY_PERSON, UserRole.ADMIN))
):
    """
    Update a delivery's information.
    
    - **delivery_id**: The unique identifier of the delivery
    - **recipientAddress**: New recipient address (optional)
    - **deliveryStatus**: New delivery status (optional)
    """
    try:
        # First check if delivery exists
        existing = fabric_client.read_delivery(delivery_id)
        if not existing.get("success"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Delivery {delivery_id} not found"
            )
        
        # Update delivery with ownership verification
        result = fabric_client.update_delivery_with_ownership(
            delivery_id,
            recipient_address=delivery_update.recipientAddress or "",
            delivery_status=delivery_update.deliveryStatus.value if delivery_update.deliveryStatus else "",
            caller_id=str(current_user.id),
            caller_role=current_user.role.value
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to update delivery")
            )
        
        # Retrieve updated delivery
        updated_delivery = fabric_client.read_delivery(delivery_id)
        
        return DeliveryResponse(
            success=True,
            message="Delivery updated successfully",
            data=updated_delivery.get("data")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating delivery: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.delete(
    "/{delivery_id}",
    response_model=DeliveryResponse,
    summary="Delete delivery",
    description="Mark a delivery as canceled on the blockchain. Sellers and Admins only."
)
async def delete_delivery(
    delivery_id: str,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.ADMIN))
):
    """
    Delete (cancel) a delivery. This performs a soft delete by marking 
    the delivery as CANCELED.
    
    - **delivery_id**: The unique identifier of the delivery
    """
    try:
        # Check if delivery exists
        existing = fabric_client.read_delivery(delivery_id)
        if not existing.get("success"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Delivery {delivery_id} not found"
            )
        
        # Delete (cancel) delivery with ownership verification
        result = fabric_client.delete_delivery_with_ownership(
            delivery_id,
            caller_id=str(current_user.id),
            caller_role=current_user.role.value
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to delete delivery")
            )
        
        # Retrieve canceled delivery
        canceled_delivery = fabric_client.read_delivery(delivery_id)
        
        return DeliveryResponse(
            success=True,
            message="Delivery canceled successfully",
            data=canceled_delivery.get("data")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting delivery: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/status/{delivery_status}",
    response_model=DeliveryListResponse,
    summary="Get deliveries by status",
    description="Retrieve all deliveries with a specific status. Requires authentication."
)
async def get_deliveries_by_status(
    delivery_status: DeliveryStatus,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all deliveries with a specific status.
    
    - **delivery_status**: The delivery status (PENDING, IN_TRANSIT, DELIVERED, CANCELED)
    """
    try:
        result = fabric_client.query_deliveries_by_status(delivery_status.value)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve deliveries"
            )
        
        deliveries = result.get("data", [])
        
        return DeliveryListResponse(
            success=True,
            message=f"Deliveries with status {delivery_status.value} retrieved successfully",
            count=len(deliveries),
            data=deliveries
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving deliveries by status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/{delivery_id}/history",
    summary="Get delivery history",
    description="Retrieve the complete history of a delivery from the blockchain. Requires authentication."
)
async def get_delivery_history(
    delivery_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve the complete transaction history of a delivery.
    
    - **delivery_id**: The unique identifier of the delivery
    """
    try:
        result = fabric_client.get_delivery_history(delivery_id)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"History for delivery {delivery_id} not found"
            )
        
        return {
            "success": True,
            "message": "Delivery history retrieved successfully",
            "data": result.get("data", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving delivery history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )
