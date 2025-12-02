# Blockchain Delivery Tracking System

A production-ready multi-organization Hyperledger Fabric delivery tracking system with a NestJS API. Each user gets their own X.509 certificate for blockchain identity, enabling true per-user transaction signing and immutable audit trails.

## Features

### Core Features
- **Multi-Org Blockchain Network**: 3 organizations (Platform, Sellers, Logistics) with Raft consensus
- **Per-User X.509 Identities**: Each user enrolled via Fabric CA gets their own blockchain identity
- **Role-Based Access Control**: Customers, Sellers, Delivery Persons with organization-based permissions
- **Two-Phase Custody Handoffs**: Secure package transfers with initiate/confirm flow
- **Dispute Handling**: Recipients can dispute handoffs with reasons recorded on blockchain
- **Immutable Audit Trail**: Full history of all delivery state changes with transaction IDs
- **Full TLS/HTTPS**: All services communicate over TLS (Fabric network, API, MongoDB, UI)

### Security Features (v2.0)
- **Encrypted Wallet Storage**: AES-256-GCM encryption with PBKDF2 key derivation for private keys
- **2-of-3 Endorsement Policy**: Transactions require endorsement from at least 2 organizations
- **Input Validation**: Comprehensive chaincode-level validation (delivery ID format, weights, dimensions)
- **Private Data Collections**: 
  - `deliveryPrivateDetails`: Sensitive address/contact info (Platform + Sellers)
  - `handoffPrivateData`: Photo/signature hashes (Logistics + Platform)
  - `pricingData`: Confidential pricing (Sellers only)

### Performance Features (v2.0)
- **CouchDB State Database**: Rich query support with JSON document storage
- **Composite Key Indexes**: O(log n) lookups for seller, customer, custodian, and status queries
- **CouchDB Rich Queries**: Date range queries, location-based queries, custom selectors

### Real-Time Features (v2.0)
- **Chaincode Event Subscription**: NestJS listens to blockchain events
- **WebSocket Gateway**: Real-time push notifications to frontend clients
- **Event Types**: delivery:created, delivery:statusChanged, handoff:initiated/confirmed/disputed

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
│  │                     Peer Organizations + CouchDB                        │    │
│  │                                                                         │    │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐         │    │
│  │  │   PlatformOrg    │ │   SellersOrg     │ │  LogisticsOrg    │         │    │
│  │  │                  │ │                  │ │                  │         │    │
│  │  │  peer0 :7051     │ │  peer0 :8051     │ │  peer0 :9051     │         │    │
│  │  │  ca    :7054     │ │  ca    :8054     │ │  ca    :9054     │         │    │
│  │  │  couchdb :5984   │ │  couchdb :6984   │ │  couchdb :7984   │         │    │
│  │  │                  │ │                  │ │                  │         │    │
│  │  │  Users:          │ │  Users:          │ │  Users:          │         │    │
│  │  │  - Customers     │ │  - Sellers       │ │  - Drivers       │         │    │
│  │  │  - Admins        │ │                  │ │                  │         │    │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘         │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐               │
│  │  NestJS API      │  │  MongoDB         │  │  Chaincode       │               │
│  │  :3000 (HTTPS)   │  │  :27017 (TLS)    │  │  (delivery)      │               │
│  │  WebSocket       │  │                  │  │  + PDC           │               │
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
- **WebSocket**: wss://localhost:3000/delivery-events
- **CouchDB** (PlatformOrg): http://localhost:5984 (admin:adminpw)
- **CouchDB** (SellersOrg): http://localhost:6984 (admin:adminpw)
- **CouchDB** (LogisticsOrg): http://localhost:7984 (admin:adminpw)

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

## WebSocket Real-Time Events

Connect to the WebSocket gateway for real-time delivery updates:

### Connection

```javascript
// Using socket.io-client
import { io } from 'socket.io-client';

const socket = io('wss://localhost:3000/delivery-events', {
  auth: {
    token: 'your-jwt-token'
  },
  rejectUnauthorized: false // for self-signed certs
});
```

### Subscribe to Events

```javascript
// Subscribe to a specific delivery
socket.emit('subscribe:delivery', { deliveryId: 'DEL-12345-ABC' }, (response) => {
  console.log(response); // { success: true, message: 'Subscribed to delivery DEL-12345-ABC' }
});

// Subscribe to all events for a user
socket.emit('subscribe:user', { userId: 'user-id' }, (response) => {
  console.log(response);
});
```

### Listen for Events

```javascript
// Delivery created
socket.on('delivery:created', (data) => {
  console.log('New delivery:', data.deliveryId, data.newStatus);
});

// Status changed
socket.on('delivery:statusChanged', (data) => {
  console.log(`Delivery ${data.deliveryId}: ${data.oldStatus} → ${data.newStatus}`);
});

// Handoff initiated
socket.on('handoff:initiated', (data) => {
  console.log(`Handoff from ${data.fromUserId} to ${data.toUserId}`);
});

// Handoff confirmed
socket.on('handoff:confirmed', (data) => {
  console.log(`Handoff confirmed, new custodian: ${data.newCustodianId}`);
});

// Handoff disputed
socket.on('handoff:disputed', (data) => {
  console.log(`Handoff disputed by ${data.disputedBy}`);
});
```

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
│       ├── delivery.go           # Smart contract implementation
│       ├── main.go               # Chaincode entry point
│       ├── collections_config.json  # Private Data Collections config
│       └── META-INF/
│           └── statedb/couchdb/indexes/  # CouchDB index definitions
├── fabric-network/
│   ├── config/
│   │   ├── configtx.yaml         # Channel & org configuration
│   │   └── crypto-config.yaml
│   ├── organizations/            # Generated crypto material
│   └── scripts/
│       ├── start-network.sh
│       ├── deploy-chaincode.sh   # Includes endorsement policy + PDC
│       └── cleanup.sh
├── nestjs-api/
│   └── src/
│       ├── auth/                 # JWT authentication
│       ├── users/                # User management (MongoDB)
│       ├── shop-items/           # Shop items (MongoDB)
│       ├── orders/               # Orders (MongoDB)
│       ├── deliveries/           # Delivery operations (Blockchain)
│       ├── events/               # WebSocket gateway
│       └── fabric/               # Fabric Gateway, CA, Events services
│           ├── fabric-gateway.service.ts
│           ├── fabric-ca.service.ts
│           ├── wallet.service.ts       # Encrypted wallet storage
│           └── chaincode-events.service.ts  # Event subscription
├── certs/                        # TLS certificates (generated)
├── docker-compose.yml            # All services + CouchDB
├── Makefile                      # Convenience commands
└── README.md
```

## Chaincode Functions

### Core Functions

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

### Query Functions

| Function | Description | Allowed Roles |
|----------|-------------|---------------|
| `QueryDeliveriesByCustodian` | List user's deliveries (uses composite keys) | Any authenticated user |
| `QueryDeliveriesByStatus` | List by status (uses composite keys) | Any authenticated user |
| `GetDeliveryHistory` | Get blockchain history | Any participant |
| `QueryDeliveriesRich` | CouchDB rich query (selector) | ADMIN only |
| `QueryDeliveriesByDateRange` | Query by creation date range | Any authenticated user |
| `QueryDeliveriesByLocation` | Query by city/state | DELIVERY_PERSON, ADMIN |

### Private Data Functions

| Function | Description | Allowed Orgs |
|----------|-------------|--------------|
| `SetDeliveryPrivateDetails` | Store sensitive address/contact | PlatformOrg, SellersOrg |
| `GetDeliveryPrivateDetails` | Read sensitive address/contact | PlatformOrg, SellersOrg |
| `SetHandoffPrivateData` | Store photo/signature hashes | LogisticsOrg, PlatformOrg |
| `GetHandoffPrivateData` | Read photo/signature hashes | LogisticsOrg, PlatformOrg |
| `SetPricingData` | Store confidential pricing | SellersOrg only |
| `GetPricingData` | Read confidential pricing | SellersOrg only |
| `VerifyDeliveryPrivateDataHash` | Verify data hash | Any org |

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

# Wallet Encryption (REQUIRED - 32-char hex string)
WALLET_ENCRYPTION_KEY=<32-character-hex-string>
# Generate with: openssl rand -hex 16
```

### Security Configuration

The `WALLET_ENCRYPTION_KEY` is used to encrypt user private keys stored in MongoDB:
- Uses AES-256-GCM encryption with PBKDF2 key derivation
- Private keys are never stored in plaintext
- Required for production deployments

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
