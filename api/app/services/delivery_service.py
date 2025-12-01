"""
Delivery Service - Business logic for delivery operations
Handles blockchain interactions for delivery tracking
"""
from typing import Dict, Any

from ..services.fabric_client import fabric_client


async def get_delivery(delivery_id: str, caller_role: str) -> Dict[str, Any]:
    """
    Get a delivery from the blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        caller_role: The role of the caller
        
    Returns:
        Dictionary with delivery data or error
    """
    return fabric_client.read_delivery(delivery_id, caller_role)


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
    return fabric_client.cancel_delivery(
        delivery_id=delivery_id,
        caller_id=caller_id,
        caller_role=caller_role
    )


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
    return fabric_client.initiate_handoff(
        delivery_id=delivery_id,
        to_user_id=to_user_id,
        to_role=to_role,
        caller_id=caller_id,
        caller_role=caller_role
    )


async def confirm_handoff(
    delivery_id: str,
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Confirm a pending handoff on blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        caller_id: The ID of the caller (recipient)
        caller_role: The role of the caller
        
    Returns:
        Dictionary with result
    """
    return fabric_client.confirm_handoff(
        delivery_id=delivery_id,
        caller_id=caller_id,
        caller_role=caller_role
    )


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
    return fabric_client.dispute_handoff(
        delivery_id=delivery_id,
        reason=reason,
        caller_id=caller_id,
        caller_role=caller_role
    )


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
    return fabric_client.cancel_handoff(
        delivery_id=delivery_id,
        caller_id=caller_id,
        caller_role=caller_role
    )


async def get_my_deliveries(
    caller_id: str,
    caller_role: str
) -> Dict[str, Any]:
    """
    Get all deliveries where caller is current custodian.
    
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
    caller_role: str
) -> Dict[str, Any]:
    """
    Get the complete history of a delivery from blockchain.
    
    Args:
        delivery_id: The ID of the delivery
        caller_role: The role of the caller
        
    Returns:
        Dictionary with history data
    """
    return fabric_client.get_delivery_history(
        delivery_id=delivery_id,
        caller_role=caller_role
    )
