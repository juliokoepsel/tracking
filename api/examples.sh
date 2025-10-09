#!/bin/bash
#
# API Testing Examples
# Collection of curl commands to test the Delivery Tracking API
#

API_URL="http://localhost:8000"

echo "========================================="
echo "Package Delivery Tracking API - Examples"
echo "========================================="
echo ""

# Health Check
echo "1. Health Check"
echo "curl -X GET $API_URL/health"
echo ""

# Create Delivery
echo "2. Create New Delivery"
cat << 'EOF'
curl -X POST http://localhost:8000/api/v1/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryId": "DEL003",
    "senderName": "Alice Cooper",
    "senderAddress": "100 Rock Street, Austin, TX 78701",
    "recipientName": "Bob Dylan",
    "recipientAddress": "200 Music Ave, Nashville, TN 37201",
    "packageWeight": 3.5,
    "packageDimensions": {
      "length": 40.0,
      "width": 30.0,
      "height": 20.0
    },
    "packageDescription": "Musical Equipment",
    "estimatedDeliveryDate": "2025-10-20T15:00:00Z"
  }'
EOF
echo ""
echo ""

# Get Delivery by ID
echo "3. Get Delivery by ID"
echo "curl -X GET $API_URL/api/v1/deliveries/DEL003"
echo ""

# Get All Deliveries
echo "4. Get All Deliveries"
echo "curl -X GET $API_URL/api/v1/deliveries"
echo ""

# Update Delivery
echo "5. Update Delivery Status"
cat << 'EOF'
curl -X PUT http://localhost:8000/api/v1/deliveries/DEL003 \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryStatus": "IN_TRANSIT"
  }'
EOF
echo ""
echo ""

# Update Delivery Address
echo "6. Update Delivery Address"
cat << 'EOF'
curl -X PUT http://localhost:8000/api/v1/deliveries/DEL003 \
  -H "Content-Type: application/json" \
  -d '{
    "recipientAddress": "300 New Address, Nashville, TN 37202"
  }'
EOF
echo ""
echo ""

# Get Deliveries by Status
echo "7. Get Deliveries by Status"
echo "curl -X GET $API_URL/api/v1/deliveries/status/IN_TRANSIT"
echo ""

# Get Delivery History
echo "8. Get Delivery History"
echo "curl -X GET $API_URL/api/v1/deliveries/DEL003/history"
echo ""

# Delete (Cancel) Delivery
echo "9. Cancel Delivery"
echo "curl -X DELETE $API_URL/api/v1/deliveries/DEL003"
echo ""

# API Documentation
echo "10. View API Documentation"
echo "Open in browser: $API_URL/docs"
echo ""

echo "========================================="
echo "Additional Examples"
echo "========================================="
echo ""

# Create Multiple Deliveries
echo "11. Create Multiple Deliveries (run in sequence)"
cat << 'EOF'
# Delivery 1
curl -X POST http://localhost:8000/api/v1/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryId": "DEL004",
    "senderName": "Tech Store Inc",
    "senderAddress": "500 Silicon Valley, CA 94000",
    "recipientName": "John Developer",
    "recipientAddress": "123 Code Street, Seattle, WA 98101",
    "packageWeight": 1.8,
    "packageDimensions": {
      "length": 35.0,
      "width": 25.0,
      "height": 12.0
    },
    "packageDescription": "Laptop Computer",
    "estimatedDeliveryDate": "2025-10-18T09:00:00Z"
  }'

# Delivery 2
curl -X POST http://localhost:8000/api/v1/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryId": "DEL005",
    "senderName": "Book Publisher LLC",
    "senderAddress": "789 Literature Ave, New York, NY 10001",
    "recipientName": "Sarah Reader",
    "recipientAddress": "456 Library Lane, Boston, MA 02101",
    "packageWeight": 2.2,
    "packageDimensions": {
      "length": 28.0,
      "width": 20.0,
      "height": 8.0
    },
    "packageDescription": "Book Collection - 10 Books",
    "estimatedDeliveryDate": "2025-10-16T14:00:00Z"
  }'
EOF
echo ""
echo ""

echo "========================================="
echo "Testing Complete Workflow"
echo "========================================="
echo ""
echo "1. Create a delivery (DEL006)"
echo "2. Get the delivery details"
echo "3. Update status to IN_TRANSIT"
echo "4. Update status to DELIVERED"
echo "5. View complete history"
echo ""

cat << 'EOF'
# Step 1: Create
curl -X POST http://localhost:8000/api/v1/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryId": "DEL006",
    "senderName": "Express Shipping Co",
    "senderAddress": "1000 Logistics Blvd, Chicago, IL 60601",
    "recipientName": "Client Services",
    "recipientAddress": "2000 Business Park, Miami, FL 33101",
    "packageWeight": 5.0,
    "packageDimensions": {
      "length": 50.0,
      "width": 40.0,
      "height": 30.0
    },
    "packageDescription": "Office Supplies",
    "estimatedDeliveryDate": "2025-10-14T11:00:00Z"
  }'

# Step 2: Get Details
curl -X GET http://localhost:8000/api/v1/deliveries/DEL006

# Step 3: Update to IN_TRANSIT
curl -X PUT http://localhost:8000/api/v1/deliveries/DEL006 \
  -H "Content-Type: application/json" \
  -d '{"deliveryStatus": "IN_TRANSIT"}'

# Step 4: Update to DELIVERED
curl -X PUT http://localhost:8000/api/v1/deliveries/DEL006 \
  -H "Content-Type: application/json" \
  -d '{"deliveryStatus": "DELIVERED"}'

# Step 5: View History
curl -X GET http://localhost:8000/api/v1/deliveries/DEL006/history
EOF
echo ""
echo ""

echo "========================================="
echo "For interactive testing, visit:"
echo "  Swagger UI: $API_URL/docs"
echo "  ReDoc: $API_URL/redoc"
echo "========================================="
