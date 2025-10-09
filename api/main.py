"""
FastAPI Application - Package Delivery Tracking System
Main entry point for the API service
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import logging
import os

from app.routes import delivery

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title="Package Delivery Tracking System",
    description="""
    A blockchain-based package delivery tracking system using Hyperledger Fabric.
    
    ## Features
    
    * **Create Deliveries**: Register new package deliveries on the blockchain
    * **Track Deliveries**: Monitor delivery status and location updates
    * **Update Information**: Modify delivery details and status
    * **Query History**: View complete transaction history for each delivery
    * **Immutable Records**: All data stored on Hyperledger Fabric blockchain
    
    ## Delivery Status
    
    - **PENDING**: Delivery has been created but not yet dispatched
    - **IN_TRANSIT**: Package is currently being transported
    - **DELIVERED**: Package has been successfully delivered
    - **CANCELED**: Delivery has been canceled
    """,
    version="1.0.0",
    contact={
        "name": "Delivery Tracking System",
        "email": "support@deliverytracking.com",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
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


@app.get("/", tags=["health"])
async def root():
    """
    Root endpoint - Health check
    """
    return {
        "status": "online",
        "service": "Package Delivery Tracking System",
        "version": "1.0.0",
        "blockchain": "Hyperledger Fabric",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "service": "api",
        "blockchain_connected": True  # TODO: Add actual connectivity check
    }


@app.on_event("startup")
async def startup_event():
    """
    Startup event handler
    """
    logger.info("Starting Package Delivery Tracking API")
    logger.info(f"Channel: {os.getenv('CHANNEL_NAME', 'deliverychannel')}")
    logger.info(f"Chaincode: {os.getenv('CHAINCODE_NAME', 'delivery')}")
    logger.info("API is ready to accept requests")


@app.on_event("shutdown")
async def shutdown_event():
    """
    Shutdown event handler
    """
    logger.info("Shutting down Package Delivery Tracking API")


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
