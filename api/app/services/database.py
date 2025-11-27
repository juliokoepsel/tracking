"""
Database Service - MongoDB/Beanie initialization
Handles database connection and document model registration
"""
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import os
import logging

from app.models.user import User
from app.models.order import Order

logger = logging.getLogger(__name__)

# Global client reference
_client: AsyncIOMotorClient = None


async def init_db():
    """
    Initialize MongoDB connection and Beanie ODM.
    
    Should be called during application startup.
    """
    global _client
    
    mongo_host = os.getenv("MONGO_HOST", "mongodb")
    mongo_port = os.getenv("MONGO_PORT", "27017")
    mongo_user = os.getenv("MONGO_USER", "admin")
    mongo_password = os.getenv("MONGO_PASSWORD", "adminpassword")
    mongo_db = os.getenv("MONGO_DB", "delivery_tracking")
    
    connection_string = (
        f"mongodb://{mongo_user}:{mongo_password}@{mongo_host}:{mongo_port}"
        f"/?authSource=admin"
    )
    
    logger.info(f"Connecting to MongoDB at {mongo_host}:{mongo_port}")
    
    _client = AsyncIOMotorClient(connection_string)

    await init_beanie(
        database=_client[mongo_db],
        document_models=[User, Order]
    )
    
    logger.info(f"MongoDB connected successfully to database: {mongo_db}")


async def close_db():
    """
    Close MongoDB connection.
    
    Should be called during application shutdown.
    """
    global _client
    
    if _client:
        _client.close()
        logger.info("MongoDB connection closed")


async def get_database():
    """
    Get the database instance.
    
    Returns:
        The MongoDB database instance
    """
    global _client
    mongo_db = os.getenv("MONGO_DB", "delivery_tracking")
    return _client[mongo_db]
