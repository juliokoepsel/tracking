"""
Enums for the Delivery Tracking System
Centralized enum definitions for roles, statuses, and other constants
"""
from enum import Enum


class UserRole(str, Enum):
    """User roles in the system"""
    CUSTOMER = "CUSTOMER"
    SELLER = "SELLER"
    DELIVERY_PERSON = "DELIVERY_PERSON"
    ADMIN = "ADMIN"


class DeliveryStatus(str, Enum):
    """
    Delivery status states following the chain of custody model.
    
    Flow:
    PENDING_CONFIRMATION -> PENDING_PICKUP -> IN_TRANSIT -> PENDING_DELIVERY_CONFIRMATION -> CONFIRMED_DELIVERY
    
    Dispute states can occur at handoff points:
    - DISPUTED_PICKUP: Driver refuses to accept package from seller
    - DISPUTED_TRANSIT_HANDOFF: Next driver refuses package from current driver
    - DISPUTED_DELIVERY: Customer disputes the delivery
    """
    # Order states (before delivery exists on blockchain)
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"   # Customer created order, awaiting seller confirmation
    
    # Pre-transit states
    PENDING_PICKUP = "PENDING_PICKUP"               # Seller confirmed, awaiting driver pickup
    DISPUTED_PICKUP = "DISPUTED_PICKUP"             # Driver refused pickup
    
    # Transit states
    IN_TRANSIT = "IN_TRANSIT"                       # Package with driver
    PENDING_TRANSIT_HANDOFF = "PENDING_TRANSIT_HANDOFF"  # Driver offering to next
    DISPUTED_TRANSIT_HANDOFF = "DISPUTED_TRANSIT_HANDOFF"  # Next driver refused
    
    # Delivery states
    PENDING_DELIVERY_CONFIRMATION = "PENDING_DELIVERY_CONFIRMATION"  # Arrived, awaiting customer
    CONFIRMED_DELIVERY = "CONFIRMED_DELIVERY"       # Customer confirmed receipt
    DISPUTED_DELIVERY = "DISPUTED_DELIVERY"         # Customer disputes delivery
    
    # Terminal states
    CANCELLED = "CANCELLED"                         # Order cancelled


class DisputeReason(str, Enum):
    """Reasons for disputing a delivery handoff"""
    PACKAGE_DAMAGED = "PACKAGE_DAMAGED"
    PACKAGE_MISSING = "PACKAGE_MISSING"
    WRONG_PACKAGE = "WRONG_PACKAGE"
    PACKAGE_OPENED = "PACKAGE_OPENED"
    INCOMPLETE_DELIVERY = "INCOMPLETE_DELIVERY"
    OTHER = "OTHER"
