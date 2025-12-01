#!/bin/bash
#
# API Testing Examples
# Collection of curl commands to test the Delivery Tracking API
# Updated for the new order-based workflow with JWT authentication
#

API_URL="http://localhost:8000"

echo "========================================="
echo "Package Delivery Tracking API - Examples"
echo "========================================="
echo ""
echo "NOTE: This system uses JWT authentication."
echo "All endpoints (except register/login) require a Bearer token."
echo ""

# Health Check
echo "1. Health Check (no auth required)"
echo "curl -X GET $API_URL/health"
echo ""

echo "========================================="
echo "Authentication"
echo "========================================="
echo ""

# Register Users
echo "2. Register a Seller"
cat << 'EOF'
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "seller1",
    "password": "password123",
    "email": "seller@example.com",
    "role": "SELLER"
  }'
EOF
echo ""
echo ""

echo "3. Register a Customer"
cat << 'EOF'
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "customer1",
    "password": "password123",
    "email": "customer@example.com",
    "role": "CUSTOMER"
  }'
EOF
echo ""
echo ""

echo "4. Register a Delivery Person"
cat << 'EOF'
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "driver1",
    "password": "password123",
    "email": "driver@example.com",
    "role": "DELIVERY_PERSON"
  }'
EOF
echo ""
echo ""

# Login
echo "5. Login (get JWT token)"
cat << 'EOF'
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "seller1",
    "password": "password123"
  }'
# Response: {"access_token": "...", "token_type": "bearer"}
EOF
echo ""
echo ""

echo "========================================="
echo "Shop Items (Seller)"
echo "========================================="
echo ""

echo "6. Create a Shop Item (Seller only)"
cat << 'EOF'
curl -X POST http://localhost:8000/api/v1/shop-items \
  -H "Authorization: Bearer <SELLER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gaming Laptop",
    "description": "High-performance gaming laptop with RTX 4080",
    "price_cents": 149900
  }'
EOF
echo ""
echo ""

echo "7. List All Shop Items"
cat << 'EOF'
curl -X GET http://localhost:8000/api/v1/shop-items \
  -H "Authorization: Bearer <TOKEN>"
EOF
echo ""
echo ""

echo "8. Get Shop Item by ID"
cat << 'EOF'
curl -X GET http://localhost:8000/api/v1/shop-items/<ITEM_ID> \
  -H "Authorization: Bearer <TOKEN>"
EOF
echo ""
echo ""

echo "========================================="
echo "Orders (Customer creates, Seller confirms)"
echo "========================================="
echo ""

echo "9. Create an Order (Customer only)"
cat << 'EOF'
curl -X POST http://localhost:8000/api/v1/orders \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"item_id": "<SHOP_ITEM_ID>", "quantity": 1}
    ],
    "shipping_address": {
      "street": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "USA"
    }
  }'
EOF
echo ""
echo ""

echo "10. List Orders (filtered by role)"
cat << 'EOF'
curl -X GET http://localhost:8000/api/v1/orders \
  -H "Authorization: Bearer <TOKEN>"
# Customer sees their orders
# Seller sees orders for their items
# Admin sees all orders
EOF
echo ""
echo ""

echo "11. Get Order Details"
cat << 'EOF'
curl -X GET http://localhost:8000/api/v1/orders/<ORDER_ID> \
  -H "Authorization: Bearer <TOKEN>"
EOF
echo ""
echo ""

echo "12. Confirm Order → Creates Blockchain Delivery (Seller only)"
cat << 'EOF'
curl -X PUT http://localhost:8000/api/v1/orders/<ORDER_ID>/confirm \
  -H "Authorization: Bearer <SELLER_TOKEN>"
# This creates a delivery on the blockchain and links it to the order
EOF
echo ""
echo ""

echo "========================================="
echo "Deliveries (Blockchain Operations)"
echo "========================================="
echo ""

echo "13. List All Deliveries"
cat << 'EOF'
curl -X GET http://localhost:8000/api/v1/deliveries \
  -H "Authorization: Bearer <TOKEN>"
EOF
echo ""
echo ""

echo "14. Get Delivery Details"
cat << 'EOF'
curl -X GET http://localhost:8000/api/v1/deliveries/<DELIVERY_ID> \
  -H "Authorization: Bearer <TOKEN>"
EOF
echo ""
echo ""

echo "15. Get Delivery History (blockchain audit trail)"
cat << 'EOF'
curl -X GET http://localhost:8000/api/v1/deliveries/<DELIVERY_ID>/history \
  -H "Authorization: Bearer <TOKEN>"
EOF
echo ""
echo ""

echo "========================================="
echo "Handoff Operations (Chain of Custody)"
echo "========================================="
echo ""

echo "16. Initiate Handoff (current holder only)"
cat << 'EOF'
# Seller hands off to Delivery Person
curl -X POST http://localhost:8000/api/v1/deliveries/<DELIVERY_ID>/handoff/initiate \
  -H "Authorization: Bearer <SELLER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "to_user_id": "<DELIVERY_PERSON_ID>"
  }'
EOF
echo ""
echo ""

echo "17. Confirm Handoff (recipient confirms pickup)"
cat << 'EOF'
curl -X POST http://localhost:8000/api/v1/deliveries/<DELIVERY_ID>/handoff/confirm \
  -H "Authorization: Bearer <DELIVERY_PERSON_TOKEN>"
EOF
echo ""
echo ""

echo "18. Dispute Handoff (if there's a problem)"
cat << 'EOF'
curl -X POST http://localhost:8000/api/v1/deliveries/<DELIVERY_ID>/handoff/dispute \
  -H "Authorization: Bearer <DELIVERY_PERSON_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Package was damaged on receipt"
  }'
EOF
echo ""
echo ""

echo "========================================="
echo "User Management (Admin only)"
echo "========================================="
echo ""

echo "19. Get Current User Profile"
cat << 'EOF'
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer <TOKEN>"
EOF
echo ""
echo ""

echo "20. Update Own Address"
cat << 'EOF'
curl -X PUT http://localhost:8000/api/v1/users/me/address \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "street": "456 Oak Avenue",
    "city": "Los Angeles",
    "state": "CA",
    "postal_code": "90001",
    "country": "USA"
  }'
EOF
echo ""
echo ""

echo "21. List All Users (Admin only)"
cat << 'EOF'
curl -X GET http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
EOF
echo ""
echo ""

echo "========================================="
echo "Complete Workflow Example"
echo "========================================="
echo ""
echo "Follow these steps to test the complete flow:"
echo ""
echo "1. Register seller, customer, and delivery person"
echo "2. Login as seller, create shop items"
echo "3. Login as customer, create order"
echo "4. Login as seller, confirm order (creates delivery)"
echo "5. Seller initiates handoff to delivery person"
echo "6. Delivery person confirms handoff"
echo "7. Delivery person initiates handoff to customer"
echo "8. Customer confirms final delivery"
echo "9. View delivery history for complete audit trail"
echo ""

echo "========================================="
echo "Interactive Testing"
echo "========================================="
echo ""
echo "For interactive testing, visit:"
echo "  Swagger UI: $API_URL/docs"
echo "  ReDoc: $API_URL/redoc"
echo "========================================="
