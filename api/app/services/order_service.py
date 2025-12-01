"""
Order Service - Business logic for order operations
"""
from typing import List, Optional
from datetime import datetime
import uuid
from beanie import PydanticObjectId

from ..models.order import Order, OrderCreate, OrderConfirm
from ..models.enums import DeliveryStatus
from ..services.fabric_client import fabric_client
from ..services import shop_item_service


async def create_order(customer_id: str, order_data: OrderCreate) -> Order:
    """
    Create a new order.
    
    Args:
        customer_id: The ID of the customer creating the order
        order_data: The order data
        
    Returns:
        The created Order
        
    Raises:
        ValueError: If items don't belong to the specified seller or are inactive
    """
    # Validate all items belong to the seller and are active
    item_ids = [item.item_id for item in order_data.items]
    is_valid, items = await shop_item_service.validate_items_belong_to_seller(
        item_ids, order_data.seller_id
    )
    
    if not is_valid:
        raise ValueError("One or more items are invalid, inactive, or don't belong to the specified seller")
    
    # Calculate total amount
    total_amount = 0
    for order_item in order_data.items:
        # Find matching shop item to verify price
        matching_item = next((i for i in items if str(i.id) == order_item.item_id), None)
        if matching_item:
            # Use the price_at_purchase from the order item (frontend sends current price)
            total_amount += order_item.price_at_purchase * order_item.quantity
    
    order = Order(
        seller_id=order_data.seller_id,
        customer_id=customer_id,
        items=order_data.items,
        total_amount=total_amount,
        status=DeliveryStatus.PENDING_CONFIRMATION,
    )
    await order.insert()
    return order


async def get_order_by_id(order_id: str) -> Optional[Order]:
    """
    Get an order by its ID.
    
    Args:
        order_id: The ID of the order
        
    Returns:
        The Order if found, None otherwise
    """
    try:
        return await Order.get(PydanticObjectId(order_id))
    except Exception:
        return None


async def get_orders_by_customer(customer_id: str) -> List[Order]:
    """
    Get all orders for a customer.
    
    Args:
        customer_id: The ID of the customer
        
    Returns:
        List of Orders
    """
    return await Order.find(Order.customer_id == customer_id).to_list()


async def get_orders_by_seller(seller_id: str) -> List[Order]:
    """
    Get all orders for a seller.
    
    Args:
        seller_id: The ID of the seller
        
    Returns:
        List of Orders
    """
    return await Order.find(Order.seller_id == seller_id).to_list()


async def confirm_order(
    order: Order,
    confirm_data: OrderConfirm,
    seller_id: str,
    seller_role: str,
    location_city: str,
    location_state: str,
    location_country: str
) -> tuple[Order, dict]:
    """
    Confirm an order and create a delivery on the blockchain.
    
    Args:
        order: The order to confirm
        confirm_data: Package details
        seller_id: The ID of the seller confirming
        seller_role: The role of the seller (should be SELLER)
        location_city: Seller's city
        location_state: Seller's state
        location_country: Seller's country
        
    Returns:
        Tuple of (updated Order, blockchain result)
        
    Raises:
        ValueError: If order is not in PENDING_CONFIRMATION status
    """
    if order.status != DeliveryStatus.PENDING_CONFIRMATION:
        raise ValueError("Order is not pending confirmation")
    
    if order.seller_id != seller_id:
        raise ValueError("Only the seller can confirm this order")
    
    # Generate delivery ID
    delivery_id = f"DEL-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    
    # Create delivery on blockchain
    result = fabric_client.create_delivery(
        delivery_id=delivery_id,
        order_id=str(order.id),
        package_weight=confirm_data.package_weight,
        dimension_length=confirm_data.package_length,
        dimension_width=confirm_data.package_width,
        dimension_height=confirm_data.package_height,
        location_city=location_city,
        location_state=location_state,
        location_country=location_country,
        caller_id=seller_id,
        caller_role=seller_role
    )
    
    if not result.get("success"):
        raise ValueError(f"Failed to create delivery on blockchain: {result.get('error')}")
    
    # Update order with delivery ID and status
    order.delivery_id = delivery_id
    order.status = DeliveryStatus.PENDING_PICKUP
    order.updated_at = datetime.utcnow()
    await order.save()
    
    return order, result


async def cancel_order(order: Order, customer_id: str) -> Order:
    """
    Cancel an order.
    
    Args:
        order: The order to cancel
        customer_id: The ID of the customer cancelling
        
    Returns:
        The cancelled Order
        
    Raises:
        ValueError: If order cannot be cancelled
    """
    if order.customer_id != customer_id:
        raise ValueError("Only the customer can cancel this order")
    
    if order.status != DeliveryStatus.PENDING_CONFIRMATION:
        raise ValueError("Order can only be cancelled before seller confirmation")
    
    order.status = DeliveryStatus.CANCELLED
    order.updated_at = datetime.utcnow()
    await order.save()
    
    return order


async def update_order_status(order_id: str, new_status: DeliveryStatus) -> Optional[Order]:
    """
    Update order status (called by event listener when blockchain status changes).
    
    Args:
        order_id: The ID of the order
        new_status: The new status
        
    Returns:
        The updated Order if found
    """
    order = await get_order_by_id(order_id)
    if order:
        order.status = new_status
        order.updated_at = datetime.utcnow()
        await order.save()
    return order


async def update_order_status_by_delivery_id(delivery_id: str, new_status: DeliveryStatus) -> Optional[Order]:
    """
    Update order status by delivery ID (called by event listener).
    
    Args:
        delivery_id: The delivery ID on blockchain
        new_status: The new status
        
    Returns:
        The updated Order if found
    """
    order = await Order.find_one(Order.delivery_id == delivery_id)
    if order:
        order.status = new_status
        order.updated_at = datetime.utcnow()
        await order.save()
    return order
