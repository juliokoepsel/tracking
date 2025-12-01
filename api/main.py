"""
FastAPI Application - Package Delivery Tracking System
Main entry point for the API service
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import logging
import os

from app.routes import delivery, users, orders, shop_items
from app.services.database import init_db, close_db
from app.services.fabric_client import fabric_client

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    logger.info("Starting Package Delivery Tracking API")
    logger.info(f"Channel: {os.getenv('CHANNEL_NAME', 'deliverychannel')}")
    logger.info(f"Chaincode: {os.getenv('CHAINCODE_NAME', 'delivery')}")
    
    # Initialize MongoDB connection
    await init_db()
    logger.info("MongoDB connection initialized")
    logger.info("API is ready to accept requests")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Package Delivery Tracking API")
    await close_db()
    logger.info("MongoDB connection closed")


# Create FastAPI application
app = FastAPI(
    title="Package Delivery Tracking System",
    description="""
    A blockchain-based package delivery tracking system using Hyperledger Fabric.
    
    ## Features
    
    * **Shop Items**: Sellers manage their product catalog
    * **Orders**: Customers create orders, sellers confirm
    * **Deliveries**: Track packages on blockchain
    * **Custody Handoffs**: Chain of custody with handoff confirmations
    * **Immutable Records**: All tracking data stored on Hyperledger Fabric
    
    ## Authentication
    
    This API uses HTTP Basic Authentication. Include your username and password
    in the request headers.
    
    ## User Roles
    
    - **ADMIN**: User management + read-only access to orders, deliveries, and shop items
    - **SELLER**: Manage shop items, confirm orders, initiate handoffs
    - **DELIVERY_PERSON**: Confirm handoffs (with location/package update), handle custody
    - **CUSTOMER**: Create orders, browse items, confirm final delivery, cancel deliveries
    
    ## Access Control
    
    - Users can only access deliveries where they are involved (seller, customer, custodian)
    - Admin has read-only access to all resources for monitoring
    - Cancel delivery is restricted to the customer only
    
    ## Order Flow
    
    1. **PENDING_CONFIRMATION**: Customer creates order
    2. **PENDING_PICKUP**: Seller confirms → Delivery created on blockchain
    3. **IN_TRANSIT**: Delivery person picks up
    4. **PENDING_DELIVERY_CONFIRMATION**: Awaiting customer confirmation
    5. **CONFIRMED_DELIVERY**: Customer confirmed receipt
    
    ## Chain of Custody
    
    All custody transfers require both parties to confirm the handoff:
    - Seller → Delivery Person (pickup)
    - Delivery Person → Delivery Person (transit handoff)
    - Delivery Person → Customer (final delivery)
    """,
    version="2.0.0",
    contact={
        "name": "Delivery Tracking System",
        "email": "support@deliverytracking.com",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(delivery.router)
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(shop_items.router)

# Mount static files for UI
app.mount("/static", StaticFiles(directory="/ui"), name="static")


@app.get("/ui", tags=["ui"])
async def serve_ui():
    """
    Serve the main UI page
    """
    return FileResponse("/ui/index.html")


@app.get("/", tags=["health"])
async def root():
    """
    Root endpoint - Health check
    """
    return {
        "status": "online",
        "service": "Package Delivery Tracking System",
        "version": "2.0.0",
        "blockchain": "Hyperledger Fabric",
        "database": "MongoDB",
        "auth": "HTTP Basic Auth",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint with actual connectivity verification
    """
    # Check MongoDB connectivity
    db_connected = False
    try:
        from app.models.user import User
        # Try to count users to verify DB connection
        await User.find().limit(1).to_list()
        db_connected = True
    except Exception as e:
        logger.warning(f"MongoDB health check failed: {str(e)}")
        db_connected = False
    
    # Check blockchain connectivity
    blockchain_connected = False
    try:
        result = fabric_client.ping_blockchain()
        blockchain_connected = result.get("success", False)
    except Exception as e:
        logger.warning(f"Blockchain health check failed: {str(e)}")
        blockchain_connected = False
    
    overall_status = "healthy" if db_connected and blockchain_connected else "degraded"
    
    return {
        "status": overall_status,
        "service": "api",
        "blockchain_connected": blockchain_connected,
        "database_connected": db_connected
    }


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.getenv("API_RELOAD", "true").lower() == "true"
    )
