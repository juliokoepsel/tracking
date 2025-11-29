"""
Event Listener Service - Listens to blockchain events and syncs MongoDB
Syncs Order.status when Delivery status changes on blockchain
"""
import asyncio
import json
import subprocess
import logging
from typing import Optional, Callable, Any

from ..models.enums import DeliveryStatus
from ..services import order_service

logger = logging.getLogger(__name__)


class EventListener:
    """
    Listens to Hyperledger Fabric chaincode events and syncs MongoDB.
    
    Events handled:
    - DeliveryCreated: No action needed (order already has delivery_id)
    - DeliveryStatusChanged: Update Order.status in MongoDB
    """
    
    def __init__(self):
        self.running = False
        self._task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start the event listener background task"""
        if self.running:
            logger.warning("Event listener already running")
            return
            
        self.running = True
        self._task = asyncio.create_task(self._listen_loop())
        logger.info("Event listener started")
        
    async def stop(self):
        """Stop the event listener"""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Event listener stopped")
        
    async def _listen_loop(self):
        """
        Main event listening loop.
        
        Note: In a production environment, this would use the Fabric SDK
        to subscribe to block events. For this implementation, we use
        periodic polling as a fallback mechanism.
        """
        while self.running:
            try:
                # Poll for status changes every 5 seconds
                # In production, use Fabric SDK event subscription
                await asyncio.sleep(5)
                
                # This is a placeholder - in production you'd use:
                # fabric_sdk.subscribe_to_events(self._handle_event)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in event listener: {e}")
                await asyncio.sleep(5)
                
    async def handle_delivery_status_changed(
        self,
        delivery_id: str,
        order_id: str,
        old_status: str,
        new_status: str
    ):
        """
        Handle DeliveryStatusChanged event from blockchain.
        Updates the corresponding Order in MongoDB.
        
        Args:
            delivery_id: The blockchain delivery ID
            order_id: The MongoDB order ID
            old_status: Previous status
            new_status: New status
        """
        try:
            # Convert string to enum
            status_enum = DeliveryStatus(new_status)
            
            # Update order by delivery ID
            order = await order_service.update_order_status_by_delivery_id(
                delivery_id=delivery_id,
                new_status=status_enum
            )
            
            if order:
                logger.info(
                    f"Order {order.id} status synced: {old_status} -> {new_status} "
                    f"(delivery: {delivery_id})"
                )
            else:
                logger.warning(
                    f"No order found for delivery {delivery_id} when syncing status"
                )
                
        except ValueError as e:
            logger.error(f"Invalid status value: {new_status} - {e}")
        except Exception as e:
            logger.error(f"Error handling status change event: {e}")


class ManualEventSync:
    """
    Manual event synchronization for environments without real-time events.
    Can be called from an API endpoint or scheduled job.
    """
    
    @staticmethod
    async def sync_order_status(delivery_id: str, new_status: str) -> bool:
        """
        Manually sync an order's status from blockchain.
        
        Args:
            delivery_id: The blockchain delivery ID
            new_status: The new status to set
            
        Returns:
            True if sync succeeded, False otherwise
        """
        try:
            status_enum = DeliveryStatus(new_status)
            order = await order_service.update_order_status_by_delivery_id(
                delivery_id=delivery_id,
                new_status=status_enum
            )
            return order is not None
        except Exception as e:
            logger.error(f"Manual sync failed for {delivery_id}: {e}")
            return False
            
    @staticmethod
    async def sync_all_orders_from_blockchain():
        """
        Sync all orders by reading their delivery status from blockchain.
        Useful for recovery or initial sync.
        
        Note: This requires reading all deliveries from blockchain,
        which can be expensive. Use sparingly.
        """
        from ..models.order import Order
        from ..services.fabric_client import fabric_client
        
        # Get all orders with a delivery_id
        orders = await Order.find(Order.delivery_id != None).to_list()
        
        synced = 0
        failed = 0
        
        for order in orders:
            try:
                # Read delivery from blockchain
                # Note: Using SELLER role as a default since we're doing admin sync
                result = fabric_client.read_delivery(
                    order.delivery_id,
                    "SELLER"  # Admin sync uses SELLER role
                )
                
                if result.get("success"):
                    data = result.get("data", {})
                    blockchain_status = data.get("deliveryStatus")
                    
                    if blockchain_status and blockchain_status != order.status.value:
                        order.status = DeliveryStatus(blockchain_status)
                        await order.save()
                        synced += 1
                        logger.info(f"Synced order {order.id}: {blockchain_status}")
                else:
                    failed += 1
                    logger.warning(f"Failed to read delivery {order.delivery_id}")
                    
            except Exception as e:
                failed += 1
                logger.error(f"Error syncing order {order.id}: {e}")
                
        logger.info(f"Sync complete: {synced} synced, {failed} failed")
        return {"synced": synced, "failed": failed}


# Singleton instance
event_listener = EventListener()
manual_sync = ManualEventSync()
