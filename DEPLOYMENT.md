# Deployment Guide - Package Delivery Tracking System

This guide will walk you through deploying the complete Hyperledger Fabric + FastAPI package delivery tracking system.

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
│         ┌──────────▼──────────┐                             │
│         │   FastAPI Service   │                             │
│         │   (Port 8000)       │                             │
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
docker-compose up -d api
```

**Verify the service is running:**
```bash
docker-compose ps
```

You should see all containers running:
- orderer.example.com
- peer0.delivery.example.com
- cli
- delivery-api

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

**Access the interactive API documentation:**

Open your web browser and navigate to:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

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

## Troubleshooting

### Issue: Containers not starting

**Solution:**
```bash
# Check Docker daemon
sudo systemctl status docker

# Check available resources
docker system df

# Clean up unused resources
docker system prune -a
```

### Issue: Chaincode installation fails

**Solution:**
```bash
# Check if Go dependencies are accessible
docker exec cli go version

# Verify chaincode path
docker exec cli ls -la /opt/gopath/src/github.com/chaincode/delivery/

# Check peer logs
docker-compose logs peer0.delivery.example.com
```

### Issue: API cannot connect to Fabric

**Solution:**
```bash
# Verify network connectivity
docker exec delivery-api ping -c 3 peer0.delivery.example.com

# Check if crypto material is mounted
docker exec delivery-api ls -la /app/organizations/

# Restart API service
docker-compose restart api
```

### Issue: Port 8000 already in use

**Solution:**
```bash
# Find process using port 8000
sudo lsof -i :8000

# Either kill the process or change API_PORT in .env
# Then restart
docker-compose down
docker-compose up -d api
```

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

1. **Enable TLS:**
   - Set `CORE_PEER_TLS_ENABLED=true` in docker-compose.yml
   - Generate proper TLS certificates

2. **Change default credentials:**
   - Update `ADMIN_USER` and `ADMIN_PASSWORD` in .env

3. **Configure CORS:**
   - Update `allow_origins` in `api/main.py` to specific domains

4. **Use secrets management:**
   - Store sensitive data in Docker secrets or environment-specific vaults

5. **Enable authentication:**
   - Add JWT or OAuth2 authentication to API endpoints

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

1. **Extend the chaincode:**
   - Add more business logic
   - Implement access control
   - Add delivery tracking events

2. **Enhance the API:**
   - Add user authentication
   - Implement rate limiting
   - Add caching layer

3. **Scale the network:**
   - Add more organizations
   - Add more peers
   - Implement Raft consensus for orderers

4. **Monitoring and Analytics:**
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
