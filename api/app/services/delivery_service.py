"""
Delivery Service - Business logic for delivery operations
Handles blockchain interactions for delivery tracking
"""
import logging
from typing import Dict, Any

from ..services.fabric_client import fabric_client
from ..services import order_service
from ..models.enums import DeliveryStatus

logger = logging.getLogger(__name__)


async def _sync_order_status_from_delivery(delivery_id: str, caller_id: str, caller_role: str) -> None:
    """
    Sync order status in MongoDB by reading delivery from blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        caller_id: Caller ID to read delivery
        caller_role: Caller role to read delivery
    """
    try:
        # Read the delivery to get current status
        result = fabric_client.read_delivery(delivery_id, caller_id, caller_role)
        if result.get("success"):
            data = result.get("data", {})
            if isinstance(data, dict):
                new_status = data.get("deliveryStatus")
                if new_status:
                    status_enum = DeliveryStatus(new_status)
                    order = await order_service.update_order_status_by_delivery_id(delivery_id, status_enum)
                    if order:
                        logger.info(f"Order status synced for delivery {delivery_id}: {new_status}")
    except Exception as e:
        logger.warning(f"Failed to sync order status for delivery {delivery_id}: {e}")


async def get_delivery(delivery_id: str, caller_id: str, caller_role: str) -> Dict[str, Any]:
    """
    Get a delivery from the blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        caller_id: The ID of the caller
        caller_role: The role of the caller
        
    Returns:
        Dictionary with delivery data or error
    """
    return fabric_client.read_delivery(delivery_id, caller_id, caller_role)


async def update_location(
    delivery_id: str,
    city: str,
    state: str,
    country: str,
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Update delivery location on blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        city: New city
        state: New state
        country: New country
        caller_id: The ID of the caller
        caller_role: The role of the caller
        
    Returns:
        Dictionary with result
    """
    return fabric_client.update_location(
        delivery_id=delivery_id,
        city=city,
        state=state,
        country=country,
        caller_id=caller_id,
        caller_role=caller_role
    )


async def cancel_delivery(
    delivery_id: str,
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Cancel a delivery on blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        caller_id: The ID of the caller
        caller_role: The role of the caller
        
    Returns:
        Dictionary with result
    """
    result = fabric_client.cancel_delivery(
        delivery_id=delivery_id,
        caller_id=caller_id,
        caller_role=caller_role
    )
    
    # Sync order status if successful
    if result.get("success"):
        await _sync_order_status_from_delivery(delivery_id, caller_id, caller_role)
    
    return result


async def initiate_handoff(
    delivery_id: str,
    to_user_id: str,
    to_role: str,
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Initiate a custody handoff on blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        to_user_id: The ID of the recipient
        to_role: The role of the recipient
        caller_id: The ID of the caller (current custodian)
        caller_role: The role of the caller
        
    Returns:
        Dictionary with result
    """
    result = fabric_client.initiate_handoff(
        delivery_id=delivery_id,
        to_user_id=to_user_id,
        to_role=to_role,
        caller_id=caller_id,
        caller_role=caller_role
    )
    
    # Sync order status if successful
    if result.get("success"):
        await _sync_order_status_from_delivery(delivery_id, caller_id, caller_role)
    
    return result


async def confirm_handoff(
    delivery_id: str,
    city: str,
    state: str,
    country: str,
    package_weight: float,
    dimension_length: float,
    dimension_width: float,
    dimension_height: float,
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Confirm a pending handoff on blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        city: Location city
        state: Location state
        country: Location country
        package_weight: Package weight in kg
        dimension_length: Package length in cm
        dimension_width: Package width in cm
        dimension_height: Package height in cm
        caller_id: The ID of the caller (recipient)
        caller_role: The role of the caller
        
    Returns:
        Dictionary with result
    """
    result = fabric_client.confirm_handoff(
        delivery_id=delivery_id,
        city=city,
        state=state,
        country=country,
        package_weight=package_weight,
        dimension_length=dimension_length,
        dimension_width=dimension_width,
        dimension_height=dimension_height,
        caller_id=caller_id,
        caller_role=caller_role
    )
    
    # Sync order status if successful
    if result.get("success"):
        await _sync_order_status_from_delivery(delivery_id, caller_id, caller_role)
    
    return result


async def dispute_handoff(
    delivery_id: str,
    reason: str,
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Dispute a pending handoff on blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        reason: The reason for dispute
        caller_id: The ID of the caller (recipient)
        caller_role: The role of the caller
        
    Returns:
        Dictionary with result
    """
    result = fabric_client.dispute_handoff(
        delivery_id=delivery_id,
        reason=reason,
        caller_id=caller_id,
        caller_role=caller_role
    )
    
    # Sync order status if successful
    if result.get("success"):
        await _sync_order_status_from_delivery(delivery_id, caller_id, caller_role)
    
    return result


async def cancel_handoff(
    delivery_id: str,
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Cancel a pending handoff on blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        caller_id: The ID of the caller (initiator)
        caller_role: The role of the caller
        
    Returns:
        Dictionary with result
    """
    result = fabric_client.cancel_handoff(
        delivery_id=delivery_id,
        caller_id=caller_id,
        caller_role=caller_role
    )
    
    # Sync order status if successful
    if result.get("success"):
        await _sync_order_status_from_delivery(delivery_id, caller_id, caller_role)
    
    return result


async def get_my_deliveries(
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Get all deliveries where caller is involved.
    
    - Sellers/DeliveryPersons: deliveries where they are current custodian
    - Customers: deliveries for their orders
    - Admin: all deliveries
    
    Args:
        caller_id: The ID of the caller
        caller_role: The role of the caller
        
    Returns:
        Dictionary with deliveries data
    """
    return fabric_client.query_deliveries_by_custodian(
        custodian_id=caller_id,
        caller_id=caller_id,
        caller_role=caller_role
    )


async def get_deliveries_by_status(
    status: str,
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Get deliveries by status where caller is current custodian.
    
    Args:
        status: The status to filter by
        caller_id: The ID of the caller
        caller_role: The role of the caller
        
    Returns:
        Dictionary with deliveries data
    """
    return fabric_client.query_deliveries_by_status(
        status=status,
        caller_id=caller_id,
        caller_role=caller_role
    )


async def get_delivery_history(
    delivery_id: str,
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Get the complete history of a delivery from blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        caller_id: The ID of the caller
        caller_role: The role of the caller
        
    Returns:
        Dictionary with history data
    """
    return fabric_client.get_delivery_history(
        delivery_id=delivery_id,
        caller_id=caller_id,
        caller_role=caller_role
    )
