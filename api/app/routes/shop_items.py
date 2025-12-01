"""
Shop Item Routes - CRUD operations for shop items
Sellers manage their own items, customers can browse all active items
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
import logging

from app.models.user import User
from app.models.shop_item import ShopItem, ShopItemCreate, ShopItemUpdate, ShopItemResponse
from app.models.enums import UserRole
from app.services.auth import require_roles
from app.services import shop_item_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/shop-items",
    tags=["shop-items"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized"},
    },
)


def item_to_response(item: ShopItem) -> ShopItemResponse:
    """Convert ShopItem document to ShopItemResponse schema"""
    return ShopItemResponse(
        id=str(item.id),
        seller_id=item.seller_id,
        name=item.name,
        description=item.description,
        price=item.price,
        is_active=item.is_active,
        created_at=item.created_at,
        updated_at=item.updated_at
    )


@router.post(
    "",
    response_model=ShopItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new shop item",
    description="Create a new shop item. Seller only."
)
async def create_shop_item(
    item_data: ShopItemCreate,
    current_user: User = Depends(require_roles(UserRole.SELLER))
):
    """
    Create a new shop item:
    
    - **name**: Item name (1-200 characters)
    - **description**: Item description (1-2000 characters)
    - **price**: Price in cents (e.g., 1999 = $19.99)
    """
    item = await shop_item_service.create_shop_item(
        seller_id=str(current_user.id),
        item_data=item_data
    )
    
    logger.info(f"Shop item created: {item.name} by seller {current_user.username}")
    return item_to_response(item)


@router.get(
    "",
    response_model=List[ShopItemResponse],
    summary="List all active shop items",
    description="Get all active shop items. Accessible by customers, sellers, and admins."
)
async def list_shop_items(
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN))
):
    """
    Get all active shop items for browsing.
    Admins see all items (including inactive) for read-only access.
    """
    if current_user.role == UserRole.ADMIN:
        # Admin sees all items including inactive
        items = await shop_item_service.get_all_shop_items()
    else:
        items = await shop_item_service.get_all_active_shop_items()
    return [item_to_response(item) for item in items]


@router.get(
    "/my-items",
    response_model=List[ShopItemResponse],
    summary="List seller's own shop items",
    description="Get all shop items belonging to the current seller. Seller only."
)
async def list_my_shop_items(
    include_inactive: bool = False,
    current_user: User = Depends(require_roles(UserRole.SELLER))
):
    """
    Get all shop items for the current seller.
    
    - **include_inactive**: Include inactive items (default: false)
    """
    items = await shop_item_service.get_shop_items_by_seller(
        seller_id=str(current_user.id),
        include_inactive=include_inactive
    )
    return [item_to_response(item) for item in items]


@router.get(
    "/{item_id}",
    response_model=ShopItemResponse,
    summary="Get a shop item by ID",
    description="Get details of a specific shop item. Accessible by customers, sellers, and admins."
)
async def get_shop_item(
    item_id: str,
    current_user: User = Depends(require_roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN))
):
    """
    Get a specific shop item by ID.
    Admins can view any item including inactive ones.
    """
    item = await shop_item_service.get_shop_item_by_id(item_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop item not found"
        )
    
    # Admin can see any item
    if current_user.role == UserRole.ADMIN:
        return item_to_response(item)
    
    # Non-sellers can only see active items
    if current_user.role != UserRole.SELLER and not item.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop item not found"
        )
    
    # Sellers can only see their own inactive items
    if current_user.role == UserRole.SELLER and not item.is_active:
        if item.seller_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shop item not found"
            )
    
    return item_to_response(item)


@router.put(
    "/{item_id}",
    response_model=ShopItemResponse,
    summary="Update a shop item",
    description="Update an existing shop item. Seller only, own items only."
)
async def update_shop_item(
    item_id: str,
    update_data: ShopItemUpdate,
    current_user: User = Depends(require_roles(UserRole.SELLER))
):
    """
    Update a shop item. Sellers can only update their own items.
    """
    item = await shop_item_service.get_shop_item_by_id(item_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop item not found"
        )
    
    # Validate ownership
    if item.seller_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own shop items"
        )
    
    updated_item = await shop_item_service.update_shop_item(item, update_data)
    
    logger.info(f"Shop item updated: {updated_item.name} by seller {current_user.username}")
    return item_to_response(updated_item)


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a shop item",
    description="Delete a shop item. Seller only, own items only."
)
async def delete_shop_item(
    item_id: str,
    current_user: User = Depends(require_roles(UserRole.SELLER))
):
    """
    Delete a shop item. Sellers can only delete their own items.
    """
    item = await shop_item_service.get_shop_item_by_id(item_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop item not found"
        )
    
    # Validate ownership
    if item.seller_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own shop items"
        )
    
    await shop_item_service.delete_shop_item(item)
    
    logger.info(f"Shop item deleted: {item.name} by seller {current_user.username}")
    return None
