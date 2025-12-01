"""
Shop Item Service - Business logic for shop item operations
"""
from typing import List, Optional
from datetime import datetime
from beanie import PydanticObjectId

from ..models.shop_item import ShopItem, ShopItemCreate, ShopItemUpdate


async def create_shop_item(seller_id: str, item_data: ShopItemCreate) -> ShopItem:
    """
    Create a new shop item for a seller.
    
    Args:
        seller_id: The ID of the seller creating the item
        item_data: The item data to create
        
    Returns:
        The created ShopItem
    """
    shop_item = ShopItem(
        seller_id=seller_id,
        name=item_data.name,
        description=item_data.description,
        price=item_data.price,
    )
    await shop_item.insert()
    return shop_item


async def get_shop_item_by_id(item_id: str) -> Optional[ShopItem]:
    """
    Get a shop item by its ID.
    
    Args:
        item_id: The ID of the shop item
        
    Returns:
        The ShopItem if found, None otherwise
    """
    try:
        return await ShopItem.get(PydanticObjectId(item_id))
    except Exception:
        return None


async def get_shop_items_by_seller(seller_id: str, include_inactive: bool = False) -> List[ShopItem]:
    """
    Get all shop items for a specific seller.
    
    Args:
        seller_id: The ID of the seller
        include_inactive: Whether to include inactive items
        
    Returns:
        List of ShopItems belonging to the seller
    """
    if include_inactive:
        return await ShopItem.find(ShopItem.seller_id == seller_id).to_list()
    else:
        return await ShopItem.find(
            ShopItem.seller_id == seller_id,
            ShopItem.is_active == True
        ).to_list()


async def get_all_active_shop_items() -> List[ShopItem]:
    """
    Get all active shop items (for customers to browse).
    
    Returns:
        List of all active ShopItems
    """
    return await ShopItem.find(ShopItem.is_active == True).to_list()


async def get_all_shop_items() -> List[ShopItem]:
    """
    Get all shop items including inactive (for admin access).
    
    Returns:
        List of all ShopItems
    """
    return await ShopItem.find_all().to_list()


async def update_shop_item(item: ShopItem, update_data: ShopItemUpdate) -> ShopItem:
    """
    Update a shop item.
    
    Args:
        item: The existing ShopItem to update
        update_data: The update data
        
    Returns:
        The updated ShopItem
    """
    update_dict = update_data.model_dump(exclude_unset=True)
    
    if update_dict:
        update_dict["updated_at"] = datetime.utcnow()
        for field, value in update_dict.items():
            setattr(item, field, value)
        await item.save()
    
    return item


async def delete_shop_item(item: ShopItem) -> bool:
    """
    Delete a shop item.
    
    Args:
        item: The ShopItem to delete
        
    Returns:
        True if deleted successfully
    """
    await item.delete()
    return True


async def get_shop_items_by_ids(item_ids: List[str]) -> List[ShopItem]:
    """
    Get multiple shop items by their IDs.
    
    Args:
        item_ids: List of item IDs to retrieve
        
    Returns:
        List of ShopItems found
    """
    items = []
    for item_id in item_ids:
        item = await get_shop_item_by_id(item_id)
        if item:
            items.append(item)
    return items


async def validate_items_belong_to_seller(item_ids: List[str], seller_id: str) -> tuple[bool, List[ShopItem]]:
    """
    Validate that all items belong to the specified seller and are active.
    
    Args:
        item_ids: List of item IDs to validate
        seller_id: The seller ID to check against
        
    Returns:
        Tuple of (is_valid, list of items)
    """
    items = await get_shop_items_by_ids(item_ids)
    
    if len(items) != len(item_ids):
        return False, []
    
    for item in items:
        if item.seller_id != seller_id or not item.is_active:
            return False, []
    
    return True, items
