"""
User Routes - CRUD operations for user management
Admin-only access for most operations
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional
from datetime import datetime
import logging

from app.models.user import User, UserCreate, UserUpdate, UserResponse, UserListResponse
from app.models.enums import UserRole
from app.services.auth import (
    get_current_user, 
    hash_password,
    require_admin
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized"},
    },
)


def user_to_response(user: User) -> UserResponse:
    """Convert User document to UserResponse schema"""
    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        organization_id=user.organization_id,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description="Create a new user account. Admin only."
)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_admin)
):
    """
    Create a new user with the following information:
    
    - **username**: Unique username (3-50 characters)
    - **email**: Valid email address
    - **password**: Password (min 6 characters)
    - **role**: User role (CUSTOMER, SELLER, DELIVERY_PERSON, ADMIN)
    - **full_name**: User's full name
    - **organization_id**: Optional organization ID for delivery personnel
    """
    # Check if username already exists
    existing_user = await User.find_one(User.username == user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{user_data.username}' already exists"
        )
    
    # Check if email already exists
    existing_email = await User.find_one(User.email == user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{user_data.email}' already registered"
        )
    
    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
        full_name=user_data.full_name,
        organization_id=user_data.organization_id,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    await new_user.insert()
    logger.info(f"User '{new_user.username}' created by admin '{current_user.username}'")
    
    return user_to_response(new_user)


@router.get(
    "",
    response_model=UserListResponse,
    summary="List all users",
    description="Retrieve all users. Admin only."
)
async def list_users(
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_admin)
):
    """
    List all users with optional filters:
    
    - **role**: Filter by user role
    - **is_active**: Filter by active status
    """
    query = {}
    
    if role:
        query["role"] = role
    if is_active is not None:
        query["is_active"] = is_active
    
    users = await User.find(query).to_list()
    
    return UserListResponse(
        success=True,
        message="Users retrieved successfully",
        count=len(users),
        data=[user_to_response(u) for u in users]
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Get the currently authenticated user's profile."
)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Get the profile of the currently authenticated user.
    """
    return user_to_response(current_user)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    description="Retrieve a specific user by ID. Admin only."
)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """
    Get a user by their ID.
    """
    user = await User.get(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found"
        )
    
    return user_to_response(user)


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user",
    description="Update a user's information. Admin only."
)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(require_admin)
):
    """
    Update a user's information:
    
    - **email**: New email address
    - **full_name**: New full name
    - **organization_id**: New organization ID
    - **is_active**: Active status
    """
    user = await User.get(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found"
        )
    
    # Check email uniqueness if being updated
    if user_update.email and user_update.email != user.email:
        existing_email = await User.find_one(User.email == user_update.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{user_update.email}' already registered"
            )
    
    # Apply updates
    update_data = user_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    await user.update({"$set": update_data})
    
    # Refresh user data
    user = await User.get(user_id)
    logger.info(f"User '{user.username}' updated by admin '{current_user.username}'")
    
    return user_to_response(user)


@router.delete(
    "/{user_id}",
    response_model=UserResponse,
    summary="Deactivate user",
    description="Deactivate a user account (soft delete). Admin only."
)
async def deactivate_user(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """
    Deactivate a user account (soft delete).
    
    The user will no longer be able to authenticate.
    """
    user = await User.get(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found"
        )
    
    # Prevent self-deactivation
    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    user.is_active = False
    user.updated_at = datetime.utcnow()
    await user.save()
    
    logger.info(f"User '{user.username}' deactivated by admin '{current_user.username}'")
    
    return user_to_response(user)
