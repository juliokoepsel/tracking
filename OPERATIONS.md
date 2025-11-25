# Operations Guide

## 🚀 Getting Started (3 Steps)

```bash
cd /home/leviathan/Desktop/tracking
make start        # Starts everything
make test         # Creates test delivery
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
| `make test` | Create test delivery |
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

### Create Delivery
```bash
POST /api/v1/deliveries
Body: {deliveryId, senderName, senderAddress, recipientName, 
       recipientAddress, packageWeight, packageDimensions, 
       packageDescription, estimatedDeliveryDate}
```

### Get Delivery
```bash
GET /api/v1/deliveries/{deliveryId}
```

### List All
```bash
GET /api/v1/deliveries
```

### Update Delivery
```bash
PUT /api/v1/deliveries/{deliveryId}
Body: {recipientAddress?, deliveryStatus?}
```

### Cancel Delivery
```bash
DELETE /api/v1/deliveries/{deliveryId}
```

### Filter by Status
```bash
GET /api/v1/deliveries/status/{PENDING|IN_TRANSIT|DELIVERED|CANCELED}
```

### View History
```bash
GET /api/v1/deliveries/{deliveryId}/history
```

---

## 🐳 Docker Commands

| Command | Purpose |
|---------|---------|
| `docker-compose ps` | List containers |
| `docker-compose logs -f api` | Follow API logs |
| `docker-compose logs -f peer0.delivery.example.com` | Follow peer logs |
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
| **API Routes** | `api/app/routes/delivery.py` | Endpoints |
| **Chaincode** | `chaincode/delivery/delivery.go` | Smart contract |
| **Network Config** | `fabric-network/config/configtx.yaml` | Fabric setup |
| **Deployment Guide** | `DEPLOYMENT.md` | How to deploy |
| **Troubleshooting** | `TROUBLESHOOTING.md` | Fix issues |

---

## 🎯 Common Tasks

### Initialize Ledger with Sample Data
```bash
make init-ledger
```

### View Examples
```bash
make examples
# or
./api/examples.sh
```

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

## 💡 Example: Complete Workflow

```bash
# 1. Start system
make start

# 2. Create a delivery
curl -X POST http://localhost:8000/api/v1/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryId": "DEL001",
    "senderName": "Alice",
    "senderAddress": "123 Main St",
    "recipientName": "Bob",
    "recipientAddress": "456 Oak Ave",
    "packageWeight": 2.5,
    "packageDimensions": {"length": 30, "width": 20, "height": 15},
    "packageDescription": "Electronics",
    "estimatedDeliveryDate": "2025-10-15T10:00:00Z"
  }'

# 3. Update status
curl -X PUT http://localhost:8000/api/v1/deliveries/DEL001 \
  -H "Content-Type: application/json" \
  -d '{"deliveryStatus": "IN_TRANSIT"}'

# 4. View history
curl http://localhost:8000/api/v1/deliveries/DEL001/history

# 5. Mark as delivered
curl -X PUT http://localhost:8000/api/v1/deliveries/DEL001 \
  -H "Content-Type: application/json" \
  -d '{"deliveryStatus": "DELIVERED"}'
```

---

## 🔐 Delivery Statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | Created, not yet shipped |
| `IN_TRANSIT` | Currently being transported |
| `DELIVERED` | Successfully delivered |
| `CANCELED` | Delivery canceled |

---

## 📊 Data Model Reference

```typescript
{
  deliveryId: string,              // "DEL001"
  senderName: string,              // "Alice Cooper"
  senderAddress: string,           // "123 Main St, NY"
  recipientName: string,           // "Bob Smith"
  recipientAddress: string,        // "456 Oak Ave, LA"
  packageWeight: float,            // 2.5 (kg)
  packageDimensions: {
    length: float,                 // 30.0 (cm)
    width: float,                  // 20.0 (cm)
    height: float                  // 15.0 (cm)
  },
  packageDescription: string,      // "Electronics"
  deliveryStatus: enum,            // PENDING|IN_TRANSIT|DELIVERED|CANCELED
  createdAt: timestamp,            // "2025-10-09T12:00:00Z"
  updatedAt: timestamp,            // "2025-10-09T12:00:00Z"
  estimatedDeliveryDate: timestamp // "2025-10-15T10:00:00Z"
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
3. ✅ Run test delivery: `make test`
4. ✅ Read ARCHITECTURE.md
5. ✅ Modify chaincode (add field)
6. ✅ Add authentication to API
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

- **All data is on blockchain** (immutable)
- **Every change creates a transaction** (traceable)
- **Health check**: http://localhost:8000/health
- **Interactive docs**: http://localhost:8000/docs
- **Get help**: `make help`

---

## 📱 Quick Test

After starting the system:
```bash
# Quick test
make test

# View result
curl http://localhost:8000/api/v1/deliveries/TEST001
```

---

## Testing the System

### Initialize Ledger (Optional)

The chaincode includes an `InitLedger` function that creates sample data. To invoke it:

```bash
docker exec cli peer chaincode invoke \
  -o orderer.example.com:7050 \
  -C deliverychannel \
  -n delivery \
  -c '{"function":"InitLedger","Args":[]}' \
  --waitForEvent
```

### Create a Test Delivery

```bash
curl -X POST http://localhost:8000/api/v1/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryId": "DEL100",
    "senderName": "Test Sender",
    "senderAddress": "123 Test St, Test City, TC 12345",
    "recipientName": "Test Recipient",
    "recipientAddress": "456 Test Ave, Test City, TC 12345",
    "packageWeight": 2.5,
    "packageDimensions": {
      "length": 30.0,
      "width": 20.0,
      "height": 15.0
    },
    "packageDescription": "Test Package",
    "estimatedDeliveryDate": "2025-10-20T10:00:00Z"
  }'
```

### Retrieve the Delivery

```bash
curl http://localhost:8000/api/v1/deliveries/DEL100
```

### Get All Deliveries

```bash
curl http://localhost:8000/api/v1/deliveries
```

### Update Delivery Status

```bash
curl -X PUT http://localhost:8000/api/v1/deliveries/DEL100 \
  -H "Content-Type: application/json" \
  -d '{"deliveryStatus": "IN_TRANSIT"}'
```

### View More Examples

```bash
./api/examples.sh
```

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