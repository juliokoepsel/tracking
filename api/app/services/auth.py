"""
Authentication Service - HTTP Basic Auth with role-based access control
Handles user authentication and authorization
"""
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from typing import Callable
import logging

from app.models.user import User
from app.models.enums import UserRole

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Basic security scheme
security = HTTPBasic()


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password string
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password to compare against
        
    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


async def get_current_user(
    credentials: HTTPBasicCredentials = Depends(security)
) -> User:
    """
    Dependency to get the currently authenticated user.
    
    Uses HTTP Basic Auth to authenticate.
    
    Args:
        credentials: HTTP Basic credentials from request
        
    Returns:
        The authenticated User document
        
    Raises:
        HTTPException: 401 if credentials are invalid
    """
    user = await User.find_one(User.username == credentials.username)
    
    if not user:
        logger.warning(f"Authentication failed: user '{credentials.username}' not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    if not verify_password(credentials.password, user.hashed_password):
        logger.warning(f"Authentication failed: invalid password for user '{credentials.username}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    if not user.is_active:
        logger.warning(f"Authentication failed: user '{credentials.username}' is inactive")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    
    logger.debug(f"User '{user.username}' authenticated successfully")
    return user


def require_roles(*roles: UserRole) -> Callable:
    """
    Dependency factory for role-based access control.
    
    Creates a dependency that checks if the authenticated user
    has one of the required roles.
    
    Args:
        *roles: Variable number of UserRole values that are allowed
        
    Returns:
        A dependency function that returns the user if authorized
        
    Example:
        @router.get("/admin-only")
        async def admin_endpoint(user: User = Depends(require_roles(UserRole.ADMIN))):
            return {"message": "Admin access granted"}
    """
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            logger.warning(
                f"Access denied: user '{user.username}' with role '{user.role}' "
                f"tried to access endpoint requiring roles {[r.value for r in roles]}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in roles]}"
            )
        return user
    
    return role_checker


# Convenience dependencies for common role checks
require_admin = require_roles(UserRole.ADMIN)
require_seller = require_roles(UserRole.SELLER)
require_customer = require_roles(UserRole.CUSTOMER)
require_delivery_person = require_roles(UserRole.DELIVERY_PERSON)
require_seller_or_admin = require_roles(UserRole.SELLER, UserRole.ADMIN)
require_any_role = require_roles(
    UserRole.CUSTOMER, 
    UserRole.SELLER, 
    UserRole.DELIVERY_PERSON, 
    UserRole.ADMIN
)
