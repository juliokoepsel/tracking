# Deployment Guide - Package Delivery Tracking System

This guide will walk you through deploying the complete Hyperledger Fabric + FastAPI + MongoDB package delivery tracking system.

## Prerequisites

✓ Docker (installed)
✓ Docker Compose (installed)
✓ At least 4GB RAM available
✓ At least 10GB disk space

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Orderer    │  │    Peer0     │  │     CLI      │      │
│  │              │  │  DeliveryOrg │  │   (Tools)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────┬───────┴──────────────────┘              │
│                    │                                         │
│         ┌──────────▼──────────┐                             │
│         │   Chaincode (Go)    │                             │
│         │  Delivery Contract  │                             │
│         └──────────┬──────────┘                             │
│                    │                                         │
│  ┌─────────────────▼────────────────┐                       │
│  │       FastAPI Service            │                       │
│  │       (Port 8000)                │                       │
│  └─────────────────┬────────────────┘                       │
│                    │                                         │
│         ┌──────────▼──────────┐                             │
│         │      MongoDB        │                             │
│         │    (Port 27017)     │                             │
│         └─────────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

## Step-by-Step Deployment

### Step 1: Navigate to Project Directory

```bash
cd /home/leviathan/Desktop/tracking
```

### Step 2: Review Configuration

Check the `.env` file to ensure all settings are correct:

```bash
cat .env
```

Key settings:
- `CHANNEL_NAME=deliverychannel` - Blockchain channel name
- `CHAINCODE_NAME=delivery` - Smart contract name
- `API_PORT=8000` - API service port
- `JWT_SECRET` - Secret key for JWT tokens (change in production!)
- `MONGO_*` - MongoDB connection settings

### Step 3: Start the Fabric Network

This script will:
- Generate crypto material (certificates and keys)
- Create the genesis block
- Start orderer and peer containers
- Create and join the channel
- Update anchor peers

```bash
./fabric-network/scripts/start-network.sh
```

**Expected output:**
```
========================================
Starting Delivery Tracking Network
========================================
✓ Crypto material generated
✓ Genesis block generated
✓ Channel configuration generated
✓ Anchor peer update generated
✓ Channel created
✓ Peer joined channel
✓ Anchor peer updated
========================================
Network started successfully!
========================================
```

**Estimated time:** 2-3 minutes

### Step 4: Deploy the Chaincode

This script will:
- Package the Go chaincode
- Install chaincode on the peer
- Approve chaincode for the organization
- Commit chaincode to the channel

```bash
./fabric-network/scripts/deploy-chaincode.sh
```

**Expected output:**
```
========================================
Deploying Chaincode
========================================
✓ Chaincode packaged
✓ Chaincode installed
✓ Chaincode approved
✓ Chaincode committed
========================================
Chaincode deployed successfully!
========================================
```

**Estimated time:** 1-2 minutes

### Step 5: Start the FastAPI Service

```bash
docker-compose up -d api mongodb
```

**Verify the services are running:**
```bash
docker-compose ps
```

You should see all containers running:
- orderer.example.com
- peer0.delivery.example.com
- cli
- delivery-api
- mongodb

**Check API logs:**
```bash
docker-compose logs -f api
```

Press `Ctrl+C` to stop following logs.

### Step 6: Verify Deployment

**Test the health endpoint:**
```bash
curl http://localhost:8000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "api",
  "blockchain_connected": true
}
```

**Register a test user:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123",
    "email": "test@example.com",
    "role": "CUSTOMER"
  }'
```

**Access the interactive API documentation:**

Open your web browser and navigate to:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc



## Upgrading Chaincode

When you modify the chaincode:

1. **Update version in .env:**
   ```bash
   CHAINCODE_VERSION=1.1
   ```

2. **Redeploy:**
   ```bash
   ./fabric-network/scripts/deploy-chaincode.sh
   ```

## Security Considerations

### For Production Deployment:

1. **Change JWT Secret:**
   - Generate a strong random secret for `JWT_SECRET` in .env
   - Use at least 32 characters

2. **Enable TLS:**
   - Set `CORE_PEER_TLS_ENABLED=true` in docker-compose.yml
   - Generate proper TLS certificates

3. **Change default credentials:**
   - Update `ADMIN_USER` and `ADMIN_PASSWORD` in .env
   - Change MongoDB credentials
   - Change default admin user password

4. **Configure CORS:**
   - Update `allow_origins` in `api/main.py` to specific domains

5. **Use secrets management:**
   - Store sensitive data in Docker secrets or environment-specific vaults

6. **Network security:**
   - Use Docker overlay networks
   - Implement firewall rules
   - Use reverse proxy (nginx)

## Performance Tuning

### For better performance:

1. **Increase block timeout (configtx.yaml):**
   ```yaml
   BatchTimeout: 2s  # Reduce for faster blocks
   ```

2. **Adjust batch size (configtx.yaml):**
   ```yaml
   MaxMessageCount: 10  # Increase for higher throughput
   ```

3. **Scale peers:**
   - Add more peer containers in docker-compose.yml
   - Distribute load across peers

## Backup and Recovery

### Backup blockchain data:

```bash
# Stop containers
docker-compose down

# Backup volumes
docker run --rm -v tracking_peer0.delivery.example.com:/data \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/peer-data-$(date +%Y%m%d).tar.gz /data

# Restart
docker-compose up -d
```

### Restore from backup:

```bash
# Stop containers
docker-compose down

# Restore volume
docker run --rm -v tracking_peer0.delivery.example.com:/data \
  -v $(pwd)/backup:/backup \
  alpine tar xzf /backup/peer-data-YYYYMMDD.tar.gz -C /

# Restart
docker-compose up -d
```

## Next Steps

1. **Create initial users:**
   - Register seller, customer, and delivery person accounts
   - Use the Swagger UI at http://localhost:8000/docs

2. **Create shop items:**
   - Login as seller and create product listings

3. **Test the workflow:**
   - Customer creates order
   - Seller confirms → delivery created on blockchain
   - Handoff workflow from seller to driver to customer

4. **Scale the network:**
   - Add more organizations
   - Add more peers
   - Implement Raft consensus for orderers

5. **Monitoring and Analytics:**
   - Integrate Prometheus metrics
   - Set up Grafana dashboards
   - Add ELK stack for log aggregation

## Support

For issues or questions:
- Check the logs: `docker-compose logs`
- Review Hyperledger Fabric documentation: https://hyperledger-fabric.readthedocs.io/
- FastAPI documentation: https://fastapi.tiangolo.com/

---

**Deployment completed successfully! 🎉**

Your package delivery tracking system is now running on blockchain!
