# Troubleshooting Guide

This guide covers common issues and their solutions for the Package Delivery Tracking System.

## Table of Contents

1. [Network Issues](#network-issues)
2. [Chaincode Issues](#chaincode-issues)
3. [API Issues](#api-issues)
4. [Docker Issues](#docker-issues)
5. [Data Issues](#data-issues)
6. [Performance Issues](#performance-issues)

---

## Network Issues

### Issue: Network fails to start

**Symptoms:**
- Error: "Cannot start service orderer"
- Containers fail to start

**Solutions:**

1. **Check if ports are already in use:**
   ```bash
   sudo lsof -i :7050  # Orderer
   sudo lsof -i :7051  # Peer
   sudo lsof -i :8000  # API
   ```

2. **Clean up and restart:**
   ```bash
   make clean
   make start-network
   ```

3. **Check Docker daemon:**
   ```bash
   sudo systemctl status docker
   sudo systemctl restart docker
   ```

### Issue: "Channel already exists" error

**Symptoms:**
- Error when creating channel

**Solution:**
```bash
# Clean up and start fresh
make clean
make start-network
```

### Issue: Peer fails to join channel

**Symptoms:**
- Error: "Failed to join channel"

**Solutions:**

1. **Check if channel block exists:**
   ```bash
   docker exec cli ls -la /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/
   ```

2. **Verify peer is running:**
   ```bash
   docker-compose ps peer0.delivery.example.com
   ```

3. **Check peer logs:**
   ```bash
   docker-compose logs peer0.delivery.example.com
   ```

---

## Chaincode Issues

### Issue: Chaincode installation fails

**Symptoms:**
- Error: "Failed to install chaincode"
- Error: "Cannot find package"

**Solutions:**

1. **Verify chaincode exists:**
   ```bash
   docker exec cli ls -la /opt/gopath/src/github.com/chaincode/delivery/
   ```

2. **Check Go modules:**
   ```bash
   docker exec cli cat /opt/gopath/src/github.com/chaincode/delivery/go.mod
   ```

3. **Rebuild from scratch:**
   ```bash
   make clean
   make start-network
   make deploy-chaincode
   ```

### Issue: Chaincode approval fails

**Symptoms:**
- Error: "Failed to approve chaincode"

**Solutions:**

1. **Check if chaincode is installed:**
   ```bash
   docker exec cli peer lifecycle chaincode queryinstalled
   ```

2. **Verify package ID:**
   ```bash
   docker exec cli peer lifecycle chaincode queryinstalled | grep delivery
   ```

3. **Check channel membership:**
   ```bash
   docker exec cli peer channel list
   ```

### Issue: Chaincode commit fails

**Symptoms:**
- Error: "Failed to commit chaincode"
- Error: "Chaincode definition not agreed"

**Solutions:**

1. **Check commit readiness:**
   ```bash
   docker exec cli peer lifecycle chaincode checkcommitreadiness \
     --channelID deliverychannel \
     --name delivery \
     --version 1.0 \
     --sequence 1
   ```

2. **Verify approval:**
   ```bash
   docker exec cli peer lifecycle chaincode queryapprovalstatus \
     --channelID deliverychannel \
     --name delivery
   ```

### Issue: Chaincode execution timeout

**Symptoms:**
- Error: "Chaincode execution timeout"

**Solutions:**

1. **Increase timeout in docker-compose.yml:**
   ```yaml
   environment:
     - CORE_CHAINCODE_EXECUTETIMEOUT=300s
   ```

2. **Restart peer:**
   ```bash
   docker-compose restart peer0.delivery.example.com
   ```

---

## API Issues

### Issue: API container fails to start

**Symptoms:**
- API container exits immediately
- Import errors in logs

**Solutions:**

1. **Check API logs:**
   ```bash
   docker-compose logs api
   ```

2. **Verify Python dependencies:**
   ```bash
   docker exec delivery-api pip list
   ```

3. **Rebuild API container:**
   ```bash
   make build-api
   docker-compose up -d api
   ```

### Issue: Cannot connect to Fabric network

**Symptoms:**
- Error: "Failed to connect to peer"
- Error: "Connection refused"

**Solutions:**

1. **Verify network connectivity:**
   ```bash
   docker exec delivery-api ping -c 3 peer0.delivery.example.com
   ```

2. **Check if peer is running:**
   ```bash
   docker-compose ps peer0.delivery.example.com
   ```

3. **Verify crypto material is mounted:**
   ```bash
   docker exec delivery-api ls -la /app/organizations/
   ```

4. **Check peer address in .env:**
   ```bash
   grep PEER_ADDRESS .env
   ```

### Issue: "Chaincode not found" error

**Symptoms:**
- Error when invoking chaincode through API

**Solutions:**

1. **Verify chaincode is deployed:**
   ```bash
   docker exec cli peer lifecycle chaincode querycommitted \
     --channelID deliverychannel \
     --name delivery
   ```

2. **Check chaincode name in .env:**
   ```bash
   grep CHAINCODE_NAME .env
   ```

3. **Redeploy chaincode:**
   ```bash
   make deploy-chaincode
   ```

### Issue: API returns 500 errors

**Symptoms:**
- Internal server errors
- Errors in API logs

**Solutions:**

1. **Check detailed logs:**
   ```bash
   docker-compose logs -f api
   ```

2. **Verify environment variables:**
   ```bash
   docker exec delivery-api env | grep -E "CHANNEL|CHAINCODE|PEER"
   ```

3. **Test peer command directly:**
   ```bash
   docker exec cli peer chaincode query \
     -C deliverychannel \
     -n delivery \
     -c '{"function":"QueryAllDeliveries","Args":[]}'
   ```

---

## Docker Issues

### Issue: Docker daemon not running

**Symptoms:**
- Error: "Cannot connect to the Docker daemon"

**Solution:**
```bash
# Start Docker service
sudo systemctl start docker

# Enable Docker to start on boot
sudo systemctl enable docker

# Check status
sudo systemctl status docker
```

### Issue: Insufficient disk space

**Symptoms:**
- Error: "No space left on device"

**Solutions:**

1. **Check disk usage:**
   ```bash
   df -h
   docker system df
   ```

2. **Clean up Docker:**
   ```bash
   # Remove unused containers, networks, images
   docker system prune -a

   # Remove unused volumes (WARNING: This removes data!)
   docker volume prune
   ```

### Issue: Docker network conflicts

**Symptoms:**
- Error: "Network already exists"
- IP address conflicts

**Solutions:**

1. **Remove existing network:**
   ```bash
   docker network rm fabric-delivery-network
   ```

2. **Restart Docker:**
   ```bash
   sudo systemctl restart docker
   ```

### Issue: Permission denied errors

**Symptoms:**
- Error: "Permission denied" when running Docker commands

**Solutions:**

1. **Add user to docker group:**
   ```bash
   sudo usermod -aG docker $USER
   ```

2. **Log out and log back in**, then verify:
   ```bash
   groups
   docker ps
   ```

---

## Data Issues

### Issue: Cannot create delivery - already exists

**Symptoms:**
- Error: "Delivery already exists"

**Solutions:**

1. **Use a different delivery ID:**
   ```bash
   # Use unique IDs like: DEL001, DEL002, etc.
   ```

2. **Query existing delivery:**
   ```bash
   curl http://localhost:8000/api/v1/deliveries/DEL001
   ```

3. **Clear data and reinitialize:**
   ```bash
   make clean
   make start
   ```

### Issue: Delivery not found

**Symptoms:**
- Error: "Delivery does not exist"

**Solutions:**

1. **List all deliveries:**
   ```bash
   curl http://localhost:8000/api/v1/deliveries
   ```

2. **Initialize ledger with sample data:**
   ```bash
   make init-ledger
   ```

3. **Create a new delivery:**
   ```bash
   make test
   ```

### Issue: Inconsistent data

**Symptoms:**
- Data doesn't match expected values
- Updates not reflected

**Solutions:**

1. **Query delivery history:**
   ```bash
   curl http://localhost:8000/api/v1/deliveries/DEL001/history
   ```

2. **Check peer ledger directly:**
   ```bash
   docker exec cli peer chaincode query \
     -C deliverychannel \
     -n delivery \
     -c '{"function":"ReadDelivery","Args":["DEL001"]}'
   ```

---

## Performance Issues

### Issue: Slow response times

**Symptoms:**
- API requests take a long time
- Timeouts

**Solutions:**

1. **Check container resources:**
   ```bash
   docker stats
   ```

2. **Increase Docker resources:**
   - Open Docker Desktop settings
   - Increase CPU and memory allocation

3. **Optimize batch timeout in configtx.yaml:**
   ```yaml
   BatchTimeout: 1s  # Reduce from 2s
   ```

### Issue: High memory usage

**Symptoms:**
- Containers using excessive memory
- System slowdown

**Solutions:**

1. **Check memory usage:**
   ```bash
   docker stats --no-stream
   ```

2. **Restart containers:**
   ```bash
   make restart
   ```

3. **Limit container memory in docker-compose.yml:**
   ```yaml
   services:
     peer0.delivery.example.com:
       mem_limit: 2g
   ```

---

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

## Complete Reset

If all else fails, perform a complete reset:

```bash
# Stop everything
docker-compose down -v

# Clean up
make clean

# Remove all Docker resources (WARNING: Removes ALL Docker data!)
docker system prune -a --volumes

# Restart Docker
sudo systemctl restart docker

# Start fresh
make start
make init-ledger
make test
```

---

## Getting Help

### Check logs for errors
```bash
# All logs
make logs

# Specific service
make logs-api
make logs-peer
make logs-orderer
```

### Verify configuration
```bash
cat .env
cat docker-compose.yml
```

### Check Hyperledger Fabric documentation
https://hyperledger-fabric.readthedocs.io/

### Check FastAPI documentation
https://fastapi.tiangolo.com/

---

## Common Error Messages and Solutions

| Error Message | Likely Cause | Solution |
|--------------|--------------|----------|
| "Cannot connect to Docker daemon" | Docker not running | `sudo systemctl start docker` |
| "Port already in use" | Service already running | Find and stop conflicting service |
| "Chaincode not found" | Chaincode not deployed | Run `make deploy-chaincode` |
| "Channel does not exist" | Network not initialized | Run `make start-network` |
| "Permission denied" | Insufficient permissions | Add user to docker group |
| "No space left on device" | Disk full | Run `docker system prune -a` |
| "Connection refused" | Service not running | Check `docker-compose ps` |
| "Timeout" | Service taking too long | Increase timeout settings |

---

Remember: When in doubt, check the logs first!
