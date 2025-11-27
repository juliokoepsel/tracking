"""
Order Routes - Order management operations
Links off-chain orders to blockchain deliveries
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional
from datetime import datetime
import logging
import uuid

from app.models.order import Order, OrderCreate, OrderResponse, OrderListResponse
from app.models.user import User
from app.models.enums import UserRole, DeliveryStatus
from app.services.auth import get_current_user, require_roles
from app.services.fabric_client import FabricClient

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/orders",
    tags=["orders"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized"},
    },
)

# Initialize Fabric client
fabric_client = FabricClient()


def order_to_response(order: Order) -> OrderResponse:
    """Convert Order document to OrderResponse schema"""
    return OrderResponse(
        id=str(order.id),
        tracking_id=order.tracking_id,
        seller_id=order.seller_id,
        customer_id=order.customer_id,
        logistics_company_id=order.logistics_company_id,
        items=order.items,
        status=order.status,
        total_amount=order.total_amount,
        shipping_address=order.shipping_address,
        recipient_name=order.recipient_name,
        recipient_phone=order.recipient_phone,
        created_at=order.created_at,
        updated_at=order.updated_at
    )


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new order",
    description="Create a new order. Sellers only."
)
async def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.ADMIN))
):
    """
    Create a new order with the following information:
    
    - **customer_id**: ID of the customer
    - **items**: List of order items (total is calculated automatically)
    - **shipping_address**: Delivery address
    - **recipient_name**: Name of the recipient
    - **package_weight/length/width/height**: Package dimensions
    - **package_description**: Description of package contents
    - **estimated_delivery_date**: Expected delivery date
    
    This will also create a corresponding delivery on the blockchain.
    """
    # Generate tracking ID
    tracking_id = f"TRK-{uuid.uuid4().hex[:8].upper()}"
    
    # Calculate total from items
    total_amount = sum(item.price * item.quantity for item in order_data.items)
    
    # Create order in MongoDB
    new_order = Order(
        tracking_id=tracking_id,
        seller_id=str(current_user.id),
        customer_id=order_data.customer_id,
        items=order_data.items,
        status=DeliveryStatus.PENDING_SHIPPING,
        total_amount=total_amount,
        shipping_address=order_data.shipping_address,
        recipient_name=order_data.recipient_name,
        recipient_phone=order_data.recipient_phone,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    # Create delivery on blockchain
    try:
        blockchain_result = fabric_client.create_delivery(
            tracking_id=tracking_id,
            sender_name=current_user.username,
            sender_address="",  # Seller address not tracked
            recipient_name=order_data.recipient_name,
            recipient_address=order_data.shipping_address,
            package_weight=order_data.package_weight,
            dimension_length=order_data.package_length,
            dimension_width=order_data.package_width,
            dimension_height=order_data.package_height,
            package_description=order_data.package_description,
            estimated_delivery_date=order_data.estimated_delivery_date,
            owner_id=str(current_user.id),
            owner_role=current_user.role.value
        )
        
        if not blockchain_result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create blockchain delivery: {blockchain_result.get('error')}"
            )
    except Exception as e:
        logger.error(f"Blockchain error creating delivery: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Blockchain error: {str(e)}"
        )
    
    # Save order to MongoDB
    await new_order.insert()
    logger.info(f"Order '{tracking_id}' created by seller '{current_user.username}'")
    
    return order_to_response(new_order)


@router.get(
    "",
    response_model=OrderListResponse,
    summary="List orders",
    description="List orders based on user role."
)
async def list_orders(
    order_status: Optional[DeliveryStatus] = None,
    current_user: User = Depends(get_current_user)
):
    """
    List orders:
    
    - **Admins**: See all orders
    - **Sellers**: See only their own orders
    - **Customers**: See orders addressed to them
    - **Delivery Personnel**: See orders in transit assigned to them
    
    Optional filter:
    - **order_status**: Filter by delivery status
    """
    query = {}
    
    # Role-based filtering
    if current_user.role == UserRole.ADMIN:
        pass  # Admins see all orders
    elif current_user.role == UserRole.SELLER:
        query["seller_id"] = str(current_user.id)
    elif current_user.role == UserRole.CUSTOMER:
        query["customer_id"] = str(current_user.id)
    elif current_user.role == UserRole.DELIVERY_PERSON:
        # Delivery personnel see in-transit orders
        # In a full implementation, we'd track assigned delivery person
        query["status"] = {"$in": [
            DeliveryStatus.IN_TRANSIT,
            DeliveryStatus.PENDING_PICKUP,
            DeliveryStatus.PENDING_TRANSIT_HANDOFF,
            DeliveryStatus.PENDING_DELIVERY_CONFIRMATION
        ]}
    
    # Status filter
    if order_status:
        query["status"] = order_status
    
    orders = await Order.find(query).to_list()
    
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
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information about an order.
    
    Access is role-based:
    - **Admins**: Can view any order
    - **Sellers**: Can view their own orders
    - **Customers**: Can view their own orders
    - **Delivery Personnel**: Can view orders they're handling
    """
    order = await Order.get(order_id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{order_id}' not found"
        )
    
    # Check access
    if current_user.role == UserRole.ADMIN:
        pass  # Admins can view all
    elif current_user.role == UserRole.SELLER:
        if order.seller_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own orders"
            )
    elif current_user.role == UserRole.CUSTOMER:
        if order.customer_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own orders"
            )
    elif current_user.role == UserRole.DELIVERY_PERSON:
        # Check if order is in a state accessible to delivery personnel
        allowed_statuses = [
            DeliveryStatus.IN_TRANSIT,
            DeliveryStatus.PENDING_PICKUP,
            DeliveryStatus.PENDING_TRANSIT_HANDOFF,
            DeliveryStatus.PENDING_DELIVERY_CONFIRMATION
        ]
        if order.status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view orders in delivery states"
            )
    
    return order_to_response(order)


@router.get(
    "/tracking/{tracking_id}",
    response_model=OrderResponse,
    summary="Get order by tracking ID",
    description="Get order details by tracking ID."
)
async def get_order_by_tracking(
    tracking_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get order by tracking ID.
    
    Useful for looking up orders using the blockchain tracking ID.
    """
    order = await Order.find_one(Order.tracking_id == tracking_id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with tracking ID '{tracking_id}' not found"
        )
    
    # Check access (same logic as get_order)
    if current_user.role == UserRole.ADMIN:
        pass
    elif current_user.role == UserRole.SELLER:
        if order.seller_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own orders"
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
    description="Cancel an order. Only allowed before pickup."
)
async def cancel_order(
    order_id: str,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.ADMIN))
):
    """
    Cancel an order.
    
    Only allowed when the order is in PENDING_SHIPPING status.
    """
    order = await Order.get(order_id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{order_id}' not found"
        )
    
    # Check ownership for sellers
    if current_user.role == UserRole.SELLER:
        if order.seller_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only cancel your own orders"
            )
    
    # Check if cancellation is allowed
    if order.status != DeliveryStatus.PENDING_SHIPPING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order can only be cancelled before pickup"
        )
    
    # Update blockchain status
    try:
        blockchain_result = fabric_client.update_delivery_status(
            tracking_id=order.tracking_id,
            new_status=DeliveryStatus.CANCELLED.value,
            owner_id=str(current_user.id),
            owner_role=current_user.role.value
        )
        
        if not blockchain_result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update blockchain: {blockchain_result.get('error')}"
            )
    except Exception as e:
        logger.error(f"Blockchain error cancelling order: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Blockchain error: {str(e)}"
        )
    
    # Update MongoDB
    order.status = DeliveryStatus.CANCELLED
    order.updated_at = datetime.utcnow()
    await order.save()
    
    logger.info(f"Order '{order.tracking_id}' cancelled by '{current_user.username}'")
    
    return order_to_response(order)


@router.put(
    "/{order_id}/notes",
    response_model=OrderResponse,
    summary="Update order notes",
    description="Update the notes on an order."
)
async def update_order_notes(
    order_id: str,
    notes: str,
    current_user: User = Depends(require_roles(UserRole.SELLER, UserRole.ADMIN))
):
    """
    Update order notes.
    
    Useful for adding internal notes about the order.
    """
    order = await Order.get(order_id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{order_id}' not found"
        )
    
    # Check ownership for sellers
    if current_user.role == UserRole.SELLER:
        if order.seller_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own orders"
            )
    
    order.notes = notes
    order.updated_at = datetime.utcnow()
    await order.save()
    
    logger.info(f"Order '{order.tracking_id}' notes updated by '{current_user.username}'")
    
    return order_to_response(order)
