# Operations Guide

## 🚀 Getting Started (3 Steps)

```bash
cd /home/leviathan/Desktop/tracking
make start        # Starts everything
# Register users and create orders via API
```

Then open: http://localhost:8000/docs

---

## 📋 Most Used Commands

| Command | What It Does |
|---------|-------------|
| `make start` | Start entire system |
| `make stop` | Stop all services |
| `make logs` | View all logs |
| `make status` | Check container status |
| `make clean` | Remove all data |
| `make help` | Show all commands |

---

## 🌐 Important URLs

| Service | URL |
|---------|-----|
| **API Docs (Swagger)** | http://localhost:8000/docs |
| **API Docs (ReDoc)** | http://localhost:8000/redoc |
| **Health Check** | http://localhost:8000/health |
| **Root Endpoint** | http://localhost:8000/ |

---

## 📡 API Endpoints Quick Reference

### Authentication
```bash
# Register new user
POST /api/v1/auth/register
Body: {username, password, email, role}

# Login
POST /api/v1/auth/login
Returns: {access_token, token_type}
```

### Users (Admin only for management)
```bash
GET /api/v1/users/me              # Get current user
PUT /api/v1/users/me/address      # Update own address
GET /api/v1/users                 # List all (Admin)
GET /api/v1/users/{id}            # Get user (Admin)
PUT /api/v1/users/{id}            # Update user (Admin)
DELETE /api/v1/users/{id}         # Deactivate (Admin)
```

### Shop Items (Seller)
```bash
POST /api/v1/shop-items           # Create item (Seller)
GET /api/v1/shop-items            # List all items
GET /api/v1/shop-items/{id}       # Get item
PUT /api/v1/shop-items/{id}       # Update (Owner/Admin)
DELETE /api/v1/shop-items/{id}    # Delete (Owner/Admin)
```

### Orders
```bash
POST /api/v1/orders               # Create order (Customer)
GET /api/v1/orders                # List orders (role-filtered)
GET /api/v1/orders/{id}           # Get order details
PUT /api/v1/orders/{id}/confirm   # Confirm → creates delivery (Seller)
PUT /api/v1/orders/{id}/cancel    # Cancel order
```

### Deliveries (Blockchain)
```bash
GET /api/v1/deliveries            # List all (role-filtered)
GET /api/v1/deliveries/{id}       # Get delivery details
GET /api/v1/deliveries/{id}/history # Get history
```

### Handoff Operations
```bash
POST /api/v1/deliveries/{id}/handoff/initiate  # Start handoff
POST /api/v1/deliveries/{id}/handoff/confirm   # Confirm handoff
POST /api/v1/deliveries/{id}/handoff/dispute   # Dispute handoff
```

---

## 🐳 Docker Commands

| Command | Purpose |
|---------|---------|
| `docker-compose ps` | List containers |
| `docker-compose logs -f api` | Follow API logs |
| `docker-compose logs -f peer0.delivery.example.com` | Follow peer logs |
| `docker-compose logs -f mongodb` | Follow MongoDB logs |
| `docker-compose restart api` | Restart API |
| `docker stats` | Resource usage |

---

## 🔧 Troubleshooting Quick Fixes

### API Not Working
```bash
make logs-api
docker-compose restart api
```

### Network Issues
```bash
make clean
make start
```

### Port Already in Use
```bash
# Check what's using port 8000
sudo lsof -i :8000
# Change API_PORT in .env, then restart
```

### Chaincode Issues
```bash
make deploy-chaincode
```

---

## 📂 Important Files

| File | Location | Purpose |
|------|----------|---------|
| **Environment Config** | `.env` | All settings |
| **API Code** | `api/main.py` | API entry point |
| **API Routes** | `api/app/routes/*.py` | All endpoints |
| **Services** | `api/app/services/*.py` | Business logic |
| **Models** | `api/app/models/*.py` | Data models |
| **Chaincode** | `chaincode/delivery/delivery.go` | Smart contract |
| **Network Config** | `fabric-network/config/configtx.yaml` | Fabric setup |
| **Deployment Guide** | `DEPLOYMENT.md` | How to deploy |
| **Troubleshooting** | `TROUBLESHOOTING.md` | Fix issues |

---

## 🎯 Common Tasks

### Open Shell in Container
```bash
make shell-cli    # Fabric CLI
make shell-api    # API container
```

### Backup Data
```bash
make backup
```

### Check System Health
```bash
make health
```

### View Network Info
```bash
make network-info
```

---

## 💡 Example: Complete Order to Delivery Workflow

```bash
# 1. Start system
make start

# 2. Register users
# Register a seller
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "seller1", "password": "password123", "email": "seller@test.com", "role": "SELLER"}'

# Register a customer
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "customer1", "password": "password123", "email": "customer@test.com", "role": "CUSTOMER"}'

# Register a delivery person
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "driver1", "password": "password123", "email": "driver@test.com", "role": "DELIVERY_PERSON"}'

# 3. Login as seller to get token
SELLER_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "seller1", "password": "password123"}' | jq -r '.access_token')

# 4. Seller creates shop item
curl -X POST http://localhost:8000/api/v1/shop-items \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Laptop", "description": "Gaming laptop", "price_cents": 99900, "stock": 10}'

# 5. Login as customer
CUSTOMER_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "customer1", "password": "password123"}' | jq -r '.access_token')

# 6. Customer creates order (use shop item ID from step 4)
curl -X POST http://localhost:8000/api/v1/orders \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"item_id": "SHOP_ITEM_ID", "quantity": 1}],
    "shipping_address": {"street": "123 Main St", "city": "NYC", "state": "NY", "postal_code": "10001", "country": "USA"}
  }'

# 7. Seller confirms order (creates blockchain delivery)
curl -X PUT http://localhost:8000/api/v1/orders/{order_id}/confirm \
  -H "Authorization: Bearer $SELLER_TOKEN"

# 8. Seller initiates handoff to delivery person
curl -X POST http://localhost:8000/api/v1/deliveries/{delivery_id}/handoff/initiate \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to_user_id": "DRIVER_USER_ID"}'

# 9. Delivery person confirms pickup
DRIVER_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "driver1", "password": "password123"}' | jq -r '.access_token')

curl -X POST http://localhost:8000/api/v1/deliveries/{delivery_id}/handoff/confirm \
  -H "Authorization: Bearer $DRIVER_TOKEN"

# 10. View delivery history
curl http://localhost:8000/api/v1/deliveries/{delivery_id}/history \
  -H "Authorization: Bearer $DRIVER_TOKEN"
```

---

## 🔐 Delivery Statuses

| Status | Meaning |
|--------|---------|
| `PENDING_PICKUP` | Created, awaiting seller handoff |
| `IN_TRANSIT` | Being transported by delivery person |
| `OUT_FOR_DELIVERY` | Final delivery attempt |
| `DELIVERED` | Successfully delivered |
| `DISPUTED_PICKUP` | Pickup handoff disputed |
| `DISPUTED_TRANSIT` | Transit handoff disputed |
| `DISPUTED_DELIVERY` | Final delivery disputed |

## 📦 Order Statuses

| Status | Meaning |
|--------|---------|
| `PENDING_CONFIRMATION` | Customer created, awaiting seller |
| `CONFIRMED` | Seller confirmed, delivery created |
| `CANCELLED` | Order cancelled |

---

## 📊 Data Model Reference

### Blockchain Delivery
```typescript
{
  delivery_id: string,       // "del_abc123"
  order_id: string,          // Reference to MongoDB order
  seller_id: string,         // Seller user ID
  customer_id: string,       // Customer user ID
  current_holder_id: string, // Who has custody
  status: enum,              // See statuses above
  pending_handoff_to: string | null,  // Pending handoff target
  created_at: timestamp,
  updated_at: timestamp
}
```

### MongoDB Order
```typescript
{
  id: ObjectId,
  customer_id: string,
  seller_id: string,
  items: [{
    item_id: string,
    quantity: number,
    price_cents: number
  }],
  total_cents: number,
  status: enum,              // PENDING_CONFIRMATION | CONFIRMED | CANCELLED
  delivery_id: string | null, // Set after seller confirms
  shipping_address: {
    street: string,
    city: string,
    state: string,
    postal_code: string,
    country: string
  },
  created_at: timestamp,
  updated_at: timestamp
}
```

### MongoDB ShopItem
```typescript
{
  id: ObjectId,
  seller_id: string,
  name: string,
  description: string,
  price_cents: number,
  stock: number,
  is_active: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## ⚡ Performance Tips

1. **Reduce block timeout** (configtx.yaml): `BatchTimeout: 1s`
2. **Increase Docker resources**: 4GB+ RAM, 2+ CPUs
3. **Use specific queries**: Filter by status instead of getting all
4. **Monitor resources**: `docker stats`

---

## 🎓 Learning Path

1. ✅ Deploy the system: `make start`
2. ✅ Explore API docs: http://localhost:8000/docs
3. ✅ Create users and run workflow
4. ✅ Read ARCHITECTURE.md
5. ✅ Understand chaincode role enforcement
6. ✅ Explore handoff workflow
7. ✅ Deploy to production

---

## 📞 When Things Go Wrong

1. **Check logs first**: `make logs`
2. **Check container status**: `make status`
3. **Read error message carefully**
4. **Check TROUBLESHOOTING.md**
5. **Clean and restart**: `make clean && make start`

---

## 🌟 Remember

- **Delivery data is on blockchain** (immutable)
- **User/Order/Item data is in MongoDB** (off-chain)
- **Every delivery change creates a transaction** (traceable)
- **Role enforcement happens in chaincode** (can't bypass)
- **Health check**: http://localhost:8000/health
- **Interactive docs**: http://localhost:8000/docs
- **Get help**: `make help`

---

## Monitoring

### View Container Status

```bash
docker-compose ps
```

### View Logs

**API logs:**
```bash
docker-compose logs -f api
```

**Peer logs:**
```bash
docker-compose logs -f peer0.delivery.example.com
```

**MongoDB logs:**
```bash
docker-compose logs -f mongodb
```

**Orderer logs:**
```bash
docker-compose logs -f orderer.example.com
```

**All logs:**
```bash
docker-compose logs -f
```

### Check Container Resources

```bash
docker stats
```

## Common Operations

### Restart the API Service

```bash
docker-compose restart api
```

### Rebuild the API Service

```bash
docker-compose up -d --build api
```

### Stop All Services

```bash
docker-compose down
```

### Stop and Remove All Data

```bash
docker-compose down -v
./fabric-network/scripts/cleanup.sh
```

## General Debugging Commands

### View all container logs
```bash
make logs
```

### Check container status
```bash
make status
```

### Verify system health
```bash
make health
```

### Test basic functionality
```bash
make test
```

### Get network information
```bash
make network-info
```

### Open shell in CLI container
```bash
make shell-cli
```

### Open shell in API container
```bash
make shell-api
```

---

**Print this card for quick reference while developing!**

For complete documentation, see:
- README.md - Overview
- DEPLOYMENT.md - Deployment
- TROUBLESHOOTING.md - Fixes
- ARCHITECTURE.md - Design