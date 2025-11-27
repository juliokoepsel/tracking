"""
Chain of Custody API Routes
Handles custody transfer operations for package deliveries
"""
from fastapi import APIRouter, HTTPException, status, Depends
import logging

from app.models.user import User
from app.models.enums import UserRole
from app.services.fabric_client import fabric_client
from app.services.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/custody",
    tags=["custody"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized"},
        404: {"description": "Not found"},
    },
)


@router.post(
    "/{delivery_id}/initiate",
    summary="Initiate custody handoff",
    description="Start a custody transfer to another user. Current holder only."
)
async def initiate_handoff(
    delivery_id: str,
    to_user_id: str,
    to_role: UserRole,
    current_user: User = Depends(get_current_user)
):
    """
    Initiate a custody handoff for a delivery.
    
    Only the current holder can initiate a handoff.
    The receiving party must confirm to complete the transfer.
    
    - **delivery_id**: The delivery to transfer
    - **to_user_id**: The ID of the user receiving custody
    - **to_role**: The role of the receiving user
    """
    try:
        result = fabric_client.initiate_handoff(
            delivery_id=delivery_id,
            from_user_id=str(current_user.id),
            from_role=current_user.role.value,
            to_user_id=to_user_id,
            to_role=to_role.value
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to initiate handoff")
            )
        
        return {
            "success": True,
            "message": f"Handoff initiated to user {to_user_id}",
            "data": result.get("data")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating handoff: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/{delivery_id}/confirm",
    summary="Confirm custody handoff",
    description="Confirm receipt of a delivery. Intended recipient only."
)
async def confirm_handoff(
    delivery_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Confirm a pending custody handoff.
    
    Only the intended recipient can confirm the handoff.
    
    - **delivery_id**: The delivery being transferred
    """
    try:
        result = fabric_client.confirm_handoff(
            delivery_id=delivery_id,
            confirming_user_id=str(current_user.id)
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to confirm handoff")
            )
        
        return {
            "success": True,
            "message": "Handoff confirmed successfully",
            "data": result.get("data")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error confirming handoff: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/{delivery_id}/dispute",
    summary="Dispute custody handoff",
    description="Dispute a pending custody transfer. Parties involved only."
)
async def dispute_handoff(
    delivery_id: str,
    reason: str,
    current_user: User = Depends(get_current_user)
):
    """
    Dispute a pending custody handoff.
    
    Either party involved in the handoff can dispute it.
    
    - **delivery_id**: The delivery being disputed
    - **reason**: Reason for the dispute
    """
    try:
        result = fabric_client.dispute_handoff(
            delivery_id=delivery_id,
            disputing_user_id=str(current_user.id),
            reason=reason
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to dispute handoff")
            )
        
        return {
            "success": True,
            "message": "Handoff disputed",
            "data": result.get("data")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disputing handoff: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/{delivery_id}/cancel",
    summary="Cancel custody handoff",
    description="Cancel a pending custody transfer. Initiator only."
)
async def cancel_handoff(
    delivery_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Cancel a pending custody handoff.
    
    Only the initiator of the handoff can cancel it.
    
    - **delivery_id**: The delivery with pending handoff
    """
    try:
        result = fabric_client.cancel_handoff(
            delivery_id=delivery_id,
            cancelling_user_id=str(current_user.id)
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to cancel handoff")
            )
        
        return {
            "success": True,
            "message": "Handoff cancelled",
            "data": result.get("data")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling handoff: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )
