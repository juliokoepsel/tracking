# Blockchain Delivery Tracking System

A production-ready multi-organization Hyperledger Fabric delivery tracking system with a NestJS API. Each user gets their own X.509 certificate for blockchain identity, enabling true per-user transaction signing and immutable audit trails.

## Features

- **Multi-Org Blockchain Network**: 3 organizations (Platform, Sellers, Logistics) with Raft consensus
- **Per-User X.509 Identities**: Each user enrolled via Fabric CA gets their own blockchain identity
- **Role-Based Access Control**: Customers, Sellers, Delivery Persons with organization-based permissions
- **Two-Phase Custody Handoffs**: Secure package transfers with initiate/confirm flow
- **Dispute Handling**: Recipients can dispute handoffs with reasons recorded on blockchain
- **Immutable Audit Trail**: Full history of all delivery state changes with transaction IDs
- **Full TLS/HTTPS**: All services communicate over TLS (Fabric network, API, MongoDB, UI)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Docker Network (fabric_network)                       │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        Raft Orderer Cluster                             │    │
│  │   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                 │    │
│  │   │  orderer1     │ │  orderer2     │ │  orderer3     │                 │    │
│  │   │  :7050        │ │  :8050        │ │  :9050        │                 │    │
│  │   └───────────────┘ └───────────────┘ └───────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        Peer Organizations                               │    │
│  │                                                                         │    │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐         │    │
│  │  │   PlatformOrg    │ │   SellersOrg     │ │  LogisticsOrg    │         │    │
│  │  │                  │ │                  │ │                  │         │    │
│  │  │  peer0 :7051     │ │  peer0 :9051     │ │  peer0 :11051    │         │    │
│  │  │  ca    :7054     │ │  ca    :8054     │ │  ca    :9054     │         │    │
│  │  │                  │ │                  │ │                  │         │    │
│  │  │  Users:          │ │  Users:          │ │  Users:          │         │    │
│  │  │  - Customers     │ │  - Sellers       │ │  - Drivers       │         │    │
│  │  │  - Admins        │ │                  │ │                  │         │    │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘         │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐               │
│  │  NestJS API      │  │  MongoDB         │  │  Chaincode       │               │
│  │  :3000           │  │  :27017          │  │  (delivery)      │               │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- At least 8GB RAM
- At least 15GB disk space
- **mkcert** (for TLS certificates) - Install with:
  - Ubuntu/Debian: `sudo apt install mkcert libnss3-tools`
  - macOS: `brew install mkcert`
  - Windows: `choco install mkcert`
  - Then run: `mkcert -install`

### Start Everything

```bash
# Generate TLS certificates first (only needed once)
make generate-certs

# Start the entire system (network + chaincode + API)
make start

# Or with sudo if needed
sudo make start
```

This will:
1. Generate TLS certificates for nginx, NestJS, and MongoDB
2. Generate crypto material for all organizations
3. Start 3 Raft orderers
4. Start 3 peers (one per org)
5. Start 3 Fabric CAs with TLS
6. Create and join the delivery channel
7. Deploy the delivery chaincode
8. Start MongoDB (TLS enabled)
9. Start the NestJS API (HTTPS)
10. Start the nginx UI (HTTPS)

### Access Points

- **UI**: https://localhost
- **API**: https://localhost:3000/api/v1
- **Health**: https://localhost:3000/api/v1/health

### Verify System Health

```bash
# Using curl with -k to skip certificate verification
curl -k https://localhost:3000/api/v1/health
```

## API Usage

### Authentication

#### Register Users

```bash
# Register a seller (enrolled to SellersOrg)
curl -k -X POST https://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@example.com",
    "password": "password123",
    "name": "Test Seller",
    "role": "SELLER",
    "address": {
      "street": "123 Seller St",
      "city": "NYC",
      "state": "NY",
      "zipCode": "10001",
      "country": "US"
    }
  }'

# Register a customer (enrolled to PlatformOrg)
curl -k -X POST https://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "password123",
    "name": "Test Customer",
    "role": "CUSTOMER",
    "address": {
      "street": "456 Customer Ave",
      "city": "Brooklyn",
      "state": "NY",
      "zipCode": "11201",
      "country": "US"
    }
  }'

# Register a delivery person (enrolled to LogisticsOrg)
curl -k -X POST https://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@example.com",
    "password": "password123",
    "name": "Test Driver",
    "role": "DELIVERY_PERSON",
    "vehicleInfo": "White Van - ABC123"
  }'
```

#### Login

```bash
# Login returns a JWT token
curl -k -X POST https://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "seller@example.com", "password": "password123"}'

# Store token for subsequent requests
export TOKEN="<jwt_token_from_response>"
```

### Shop Items (Sellers Only)

```bash
# Create a shop item
curl -k -X POST https://localhost:3000/api/v1/shop-items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Wireless Headphones",
    "description": "Bluetooth 5.0 over-ear headphones",
    "priceInCents": 9999
  }'

# List your shop items
curl -k https://localhost:3000/api/v1/shop-items \
  -H "Authorization: Bearer $TOKEN"
```

### Orders (Customers)

```bash
# Create an order (as customer)
curl -k -X POST https://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{
    "sellerId": "<seller_user_id>",
    "items": [{"itemId": "<shop_item_id>", "quantity": 1}]
  }'

# Seller confirms order (creates delivery on blockchain)
curl -k -X POST https://localhost:3000/api/v1/orders/<order_id>/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -d '{
    "packageWeight": 0.5,
    "packageLength": 20,
    "packageWidth": 15,
    "packageHeight": 5,
    "city": "NYC",
    "state": "NY",
    "country": "US"
  }'
```

### Deliveries (Blockchain Operations)

```bash
# Get delivery details
curl -k https://localhost:3000/api/v1/deliveries/<delivery_id> \
  -H "Authorization: Bearer $TOKEN"

# Get deliveries assigned to me
curl -k https://localhost:3000/api/v1/deliveries/my \
  -H "Authorization: Bearer $TOKEN"

# Get full blockchain history
curl -k https://localhost:3000/api/v1/deliveries/<delivery_id>/history \
  -H "Authorization: Bearer $TOKEN"
```

### Handoff Flow

The system uses a two-phase handoff process for secure custody transfers:

```bash
# 1. Seller initiates handoff to driver
curl -k -X POST https://localhost:3000/api/v1/deliveries/<delivery_id>/handoff/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -d '{"toUserId": "<driver_id>", "toRole": "DELIVERY_PERSON"}'

# 2. Driver confirms pickup
curl -k -X POST https://localhost:3000/api/v1/deliveries/<delivery_id>/handoff/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d '{"city": "NYC", "state": "NY", "country": "US"}'

# 3. Driver updates location during transit
curl -X PUT https://localhost:3000/api/v1/deliveries/<delivery_id>/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d '{"city": "Brooklyn", "state": "NY", "country": "US"}'

# 4. Driver initiates handoff to customer
curl -k -X POST https://localhost:3000/api/v1/deliveries/<delivery_id>/handoff/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d '{"toUserId": "<customer_id>", "toRole": "CUSTOMER"}'

# 5. Customer confirms delivery
curl -k -X POST https://localhost:3000/api/v1/deliveries/<delivery_id>/handoff/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{"city": "Brooklyn", "state": "NY", "country": "US"}'
```

### Dispute Handling

Recipients can dispute a pending handoff:

```bash
# Recipient disputes the handoff
curl -k -X POST https://localhost:3000/api/v1/deliveries/<delivery_id>/handoff/dispute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RECIPIENT_TOKEN" \
  -d '{"reason": "Package appears damaged, refusing to accept custody"}'
```

The delivery status changes to `DISPUTED_*` and requires manual resolution.

## Delivery Status Flow

```
PENDING_PICKUP
    │
    ├──(seller initiates handoff)──► PENDING_PICKUP_HANDOFF
    │                                      │
    │                                      ├──(driver confirms)──► IN_TRANSIT
    │                                      │                           │
    │                                      └──(driver disputes)──► DISPUTED_PICKUP_HANDOFF
    │
    └──(customer cancels)──► CANCELLED

IN_TRANSIT
    │
    ├──(driver initiates to customer)──► PENDING_DELIVERY_CONFIRMATION
    │                                           │
    │                                           ├──(customer confirms)──► CONFIRMED_DELIVERY ✓
    │                                           │
    │                                           └──(customer disputes)──► DISPUTED_DELIVERY
    │
    └──(driver initiates to another driver)──► PENDING_TRANSIT_HANDOFF
                                                     │
                                                     ├──(driver2 confirms)──► IN_TRANSIT
                                                     │
                                                     └──(driver2 disputes)──► DISPUTED_TRANSIT_HANDOFF
```

## Project Structure

```
tracking/
├── chaincode/
│   └── delivery/
│       ├── delivery.go      # Smart contract implementation
│       └── main.go          # Chaincode entry point
├── fabric-network/
│   ├── config/
│   │   ├── configtx.yaml    # Channel & org configuration
│   │   └── crypto-config.yaml
│   ├── organizations/       # Generated crypto material
│   └── scripts/
│       ├── start-network.sh
│       ├── deploy-chaincode.sh
│       └── cleanup.sh
├── nestjs-api/
│   └── src/
│       ├── auth/            # JWT authentication
│       ├── users/           # User management (MongoDB)
│       ├── shop-items/      # Shop items (MongoDB)
│       ├── orders/          # Orders (MongoDB)
│       ├── deliveries/      # Delivery operations (Blockchain)
│       └── fabric/          # Fabric Gateway & CA services
├── docker-compose.yml       # All services
├── Makefile                 # Convenience commands
└── README.md
```

## Chaincode Functions

| Function | Description | Allowed Roles |
|----------|-------------|---------------|
| `CreateDelivery` | Create new delivery record | SELLER |
| `ReadDelivery` | Read delivery details | Any participant |
| `UpdateLocation` | Update current location | DELIVERY_PERSON |
| `InitiateHandoff` | Start custody transfer | SELLER, DELIVERY_PERSON |
| `ConfirmHandoff` | Accept custody transfer | DELIVERY_PERSON, CUSTOMER |
| `DisputeHandoff` | Reject custody transfer | DELIVERY_PERSON, CUSTOMER |
| `CancelHandoff` | Cancel pending handoff | Handoff initiator |
| `CancelDelivery` | Cancel delivery | CUSTOMER (before pickup) |
| `QueryDeliveriesByCustodian` | List user's deliveries | Any authenticated user |
| `QueryDeliveriesByStatus` | List by status | Any authenticated user |
| `GetDeliveryHistory` | Get blockchain history | Any participant |

## Make Commands

```bash
make help              # Show all available commands
make start             # Start entire system
make stop              # Stop all services
make clean             # Stop and clean all data
make restart           # Restart everything
make logs              # View all logs
make logs-nestjs       # View NestJS API logs
make logs-peer         # View peer logs
make status            # Show container status
make health            # Check API health
```

## Environment Variables

Key configuration in `.env`:

```env
# Fabric Network
CHANNEL_NAME=deliverychannel
CHAINCODE_NAME=delivery
CHAINCODE_VERSION=1.0

# MongoDB
MONGO_HOST=mongodb
MONGO_PORT=27017
MONGO_DATABASE=delivery_tracking

# JWT
JWT_SECRET=<your-secret>
JWT_EXPIRES_IN=24h

# API
API_PORT=3000
```

## Troubleshooting

### Check Container Status
```bash
docker ps -a
make status
```

### View Logs
```bash
# All logs
make logs

# Specific service
docker logs delivery-api -f
docker logs peer0.platform.example.com -f
docker logs ca.platform.example.com -f
```

### Reset Everything
```bash
make clean
make start
```

### Common Issues

**"x509: certificate signed by unknown authority"**
- Fabric CAs must use cryptogen-generated keys for the trust chain to work
- Check docker-compose.yml CA environment variables

**"Failed to get caller identity"**
- User may not be enrolled with Fabric CA
- Check wallet identities in MongoDB

**Chaincode errors**
- Check peer logs: `docker logs peer0.platform.example.com`
- Check chaincode container logs

## License

MIT
