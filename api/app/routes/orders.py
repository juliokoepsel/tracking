"""
Order Routes - Order management operations
Customer creates orders, Seller confirms to create blockchain delivery
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from datetime import datetime
import logging

from app.models.order import Order, OrderCreate, OrderConfirm, OrderResponse, OrderListResponse
from app.models.user import User
from app.models.enums import UserRole, DeliveryStatus
from app.services.auth import get_current_user, require_roles
from app.services import order_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/orders",
    tags=["orders"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized"},
    },
)


def order_to_response(order: Order) -> OrderResponse:
    """Convert Order document to OrderResponse schema"""
    return OrderResponse(
        id=str(order.id),
        seller_id=order.seller_id,
        customer_id=order.customer_id,
        items=order.items,
        total_amount=order.total_amount,
        delivery_id=order.delivery_id,
        status=order.status,
        created_at=order.created_at,
        updated_at=order.updated_at
    )


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new order",
    description="Create a new order. Customer only."
)
async def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(require_roles(UserRole.CUSTOMER))
):
    """
    Create a new order:
    
    - **seller_id**: ID of the seller
    - **items**: List of OrderItems with item_id, quantity, and price_at_purchase
    
    Order starts in PENDING_CONFIRMATION status until seller confirms.
    """
    try:
        order = await order_service.create_order(
            customer_id=str(current_user.id),
            order_data=order_data
        )
        
        logger.info(f"Order created by customer '{current_user.username}' for seller '{order_data.seller_id}'")
        return order_to_response(order)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/{order_id}/confirm",
    response_model=OrderResponse,
    summary="Confirm an order",
    description="Confirm an order and create delivery on blockchain. Seller only."
)
async def confirm_order(
    order_id: str,
    confirm_data: OrderConfirm,
    current_user: User = Depends(require_roles(UserRole.SELLER))
):
    """
    Confirm an order and create a delivery on the blockchain:
    
    - **package_weight**: Weight in kg
    - **package_length/width/height**: Dimensions in cm
    
    Requires seller to have an address configured.
    """
    # Validate seller has address
    if not current_user.address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seller must have an address configured to confirm orders"
        )
    
    order = await order_service.get_order_by_id(order_id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Validate ownership
    if order.seller_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only confirm your own orders"
        )
    
    try:
        updated_order, _ = await order_service.confirm_order(
            order=order,
            confirm_data=confirm_data,
            seller_id=str(current_user.id),
            seller_role=current_user.role.value,
            location_city=current_user.address.city,
            location_state=current_user.address.state,
            location_country=current_user.address.country
        )
        
        logger.info(f"Order '{order_id}' confirmed by seller '{current_user.username}', delivery_id: {updated_order.delivery_id}")
        return order_to_response(updated_order)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "",
    response_model=OrderListResponse,
    summary="List orders",
    description="List orders based on user role."
)
async def list_orders(
    order_status: DeliveryStatus = None,
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.SELLER))
):
    """
    List orders:
    
    - **Sellers**: See orders where they are the seller
    - **Customers**: See their own orders
    
    Optional filter:
    - **order_status**: Filter by delivery status
    """
    if current_user.role == UserRole.SELLER:
        orders = await order_service.get_orders_by_seller(str(current_user.id))
    else:  # CUSTOMER
        orders = await order_service.get_orders_by_customer(str(current_user.id))
    
    # Apply status filter
    if order_status:
        orders = [o for o in orders if o.status == order_status]
    
    return OrderListResponse(
        success=True,
        message="Orders retrieved successfully",
        count=len(orders),
        data=[order_to_response(o) for o in orders]
    )


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Get order details",
    description="Get details of a specific order."
)
async def get_order(
    order_id: str,
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.SELLER))
):
    """
    Get detailed information about an order.
    
    Access is role-based:
    - **Sellers**: Can view orders where they are the seller
    - **Customers**: Can view their own orders
    """
    order = await order_service.get_order_by_id(order_id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Validate access
    if current_user.role == UserRole.SELLER:
        if order.seller_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view orders where you are the seller"
            )
    elif current_user.role == UserRole.CUSTOMER:
        if order.customer_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own orders"
            )
    
    return order_to_response(order)


@router.put(
    "/{order_id}/cancel",
    response_model=OrderResponse,
    summary="Cancel an order",
    description="Cancel an order. Customer only, before seller confirmation."
)
async def cancel_order(
    order_id: str,
    current_user: User = Depends(require_roles(UserRole.CUSTOMER))
):
    """
    Cancel an order.
    
    Only allowed when the order is in PENDING_CONFIRMATION status
    (before seller confirms).
    """
    order = await order_service.get_order_by_id(order_id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    try:
        cancelled_order = await order_service.cancel_order(
            order=order,
            customer_id=str(current_user.id)
        )
        
        logger.info(f"Order '{order_id}' cancelled by customer '{current_user.username}'")
        return order_to_response(cancelled_order)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
