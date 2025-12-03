# Blockchain Delivery Tracking System

A production-ready **decentralized** multi-organization Hyperledger Fabric delivery tracking system. Each organization runs their own API instance with separate database, achieving true organizational decentralization. Users get X.509 certificates with embedded role attributes for blockchain identity.

## Features

### Core Features
- **Multi-Org Blockchain Network**: 3 organizations (Platform, Sellers, Logistics) with Raft consensus
- **Decentralized Infrastructure**: Each org runs their own API + MongoDB instance
- **Per-User X.509 Identities**: Each user enrolled via Fabric CA gets their own blockchain identity
- **Role-Based Access Control**: Customers, Sellers, Delivery Persons with organization-based permissions
- **Two-Phase Custody Handoffs**: Secure package transfers with initiate/confirm flow
- **State-Based Endorsement**: Per-delivery endorsement policies follow custody chain
- **Dispute Handling**: Recipients can dispute handoffs with reasons recorded on blockchain
- **Immutable Audit Trail**: Full history of all delivery state changes with transaction IDs

### Security Features
- **Encrypted Wallet Storage**: AES-256-GCM encryption with per-org encryption keys
- **2-of-3 Endorsement Policy**: Transactions require endorsement from at least 2 organizations
- **Per-Key State Validation**: Custody changes require endorsement from current custodian's org
- **Service Discovery**: Dynamic peer discovery via gossip protocol
- **Input Validation**: Comprehensive chaincode-level validation (delivery ID format, weights, dimensions)
- **Private Data Collections**: 
  - `deliveryPrivateDetails`: Sensitive address info (all orgs)

### Performance Features
- **CouchDB State Database**: Rich query support with JSON document storage
- **Composite Key Indexes**: O(log n) lookups for seller, customer, custodian, status, and order queries
- **CouchDB Rich Queries**: Date range queries, location-based queries, custom selectors

### Real-Time Features
- **Chaincode Event Subscription**: NestJS listens to blockchain events
- **WebSocket Gateway**: Real-time push notifications to frontend clients
- **Event Types**: delivery:created, delivery:statusChanged, handoff:initiated/confirmed/disputed

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           Docker Network (fabric_network)                           │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                        Raft Orderer Cluster                                 │    │
│  │   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                     │    │
│  │   │  orderer1     │ │  orderer2     │ │  orderer3     │                     │    │
│  │   │  :7050        │ │  :8050        │ │  :9050        │                     │    │
│  │   └───────────────┘ └───────────────┘ └───────────────┘                     │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                     Peer Organizations + CouchDB                            │    │
│  │                                                                             │    │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐             │    │
│  │  │   PlatformOrg    │ │   SellersOrg     │ │  LogisticsOrg    │             │    │
│  │  │                  │ │                  │ │                  │             │    │
│  │  │  peer0 :7051     │ │  peer0 :8051     │ │  peer0 :9051     │             │    │
│  │  │  ca    :7054     │ │  ca    :8054     │ │  ca    :9054     │             │    │
│  │  │  couchdb :5984   │ │  couchdb :6984   │ │  couchdb :7984   │             │    │
│  │  │                  │ │                  │ │                  │             │    │
│  │  │  Users:          │ │  Users:          │ │  Users:          │             │    │
│  │  │  - Customers     │ │  - Sellers       │ │  - Drivers       │             │    │
│  │  │  - Admins        │ │  (+ companies)   │ │  (+ companies)   │             │    │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘             │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                    Decentralized API Layer (per-org)                        │    │
│  │                                                                             │    │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐             │    │
│  │  │  api-platform    │ │  api-sellers     │ │  api-logistics   │             │    │
│  │  │  :3001           │ │  :3002           │ │  :3003           │             │    │
│  │  │  mongodb-platform│ │  mongodb-sellers │ │  mongodb-logistics│            │    │
│  │  │  :27017          │ │  :27018          │ │  :27019          │             │    │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘             │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
│  ┌──────────────────┐                                                               │
│  │  Chaincode       │  Endorsement: OutOf(2, PlatformMSP, SellersMSP, LogisticsMSP) │
│  │  (delivery)      │  + Per-key state-based endorsement (custody chain)            │
│  │  + PDC           │                                                               │
│  └──────────────────┘                                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Decentralization Model

Each organization operates independently:

| Organization | API Endpoint | Database | Users | Wallet Encryption |
|-------------|--------------|----------|-------|-------------------|
| PlatformOrg | `localhost:3001` | `mongodb-platform:27017` | Customers, Admins | `WALLET_ENCRYPTION_KEY_PLATFORM` |
| SellersOrg | `localhost:3002` | `mongodb-sellers:27018` | Sellers (+companies) | `WALLET_ENCRYPTION_KEY_SELLERS` |
| LogisticsOrg | `localhost:3003` | `mongodb-logistics:27019` | Delivery Persons (+companies) | `WALLET_ENCRYPTION_KEY_LOGISTICS` |

**Key Properties:**
- No single org controls all user data or submission endpoints
- Each org manages only their own users' private keys
- 2-of-3 endorsement required for all blockchain transactions
- Per-delivery state policies follow custody chain

### Authentication Model

| Layer | Method | Purpose |
|-------|--------|---------|
| HTTP API | JWT (shared secret) | Identify user for API requests |
| Cross-org writes | HTTP verification | Verify user exists in home org for sensitive operations |
| Blockchain | X.509 certificate | Cryptographic identity for all Fabric transactions |

- **Read operations**: JWT signature validation only (fast)
- **Sensitive writes** (orders): JWT + cross-org HTTP verification
- **Blockchain operations**: User's X.509 certificate from wallet

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
8. Start 3 MongoDB instances (TLS enabled, one per org)
9. Start 3 NestJS API instances (HTTPS, one per org)
10. Start the nginx UI (HTTPS)

### Access Points

**Per-Organization APIs (HTTPS):**
- **Platform API**: https://localhost:3001/api/v1 (Customers, Admins)
- **Sellers API**: https://localhost:3002/api/v1 (Sellers)
- **Logistics API**: https://localhost:3003/api/v1 (Delivery Persons)

**Web UI:**
- **Delivery UI**: https://localhost (via nginx)

### Verify System Health

```bash
# Check each org's API health
curl -k https://localhost:3001/api/v1/health  # Platform
curl -k https://localhost:3002/api/v1/health  # Sellers
curl -k https://localhost:3003/api/v1/health  # Logistics
```

## API Usage

### Authentication

Each user type registers with their organization's API:

#### Register Users

```bash
# Register a seller (via Sellers API - port 3002)
curl -k -X POST https://localhost:3002/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "seller1",
    "email": "seller@example.com",
    "password": "password123",
    "fullName": "Test Seller",
    "role": "SELLER"
  }'

# Register a customer (via Platform API - port 3001)
curl -k -X POST https://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "customer1",
    "email": "customer@example.com",
    "password": "password123",
    "fullName": "Test Customer",
    "role": "CUSTOMER",
    "address": {
      "street": "456 Customer Ave",
      "city": "Brooklyn",
      "state": "NY",
      "postalCode": "11201",
      "country": "US"
    }
  }'

# Register a delivery person (via Logistics API - port 3003)
curl -k -X POST https://localhost:3003/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "driver1",
    "email": "driver@example.com",
    "password": "password123",
    "fullName": "Test Driver",
    "role": "DELIVERY_PERSON",
    "vehicleInfo": {
      "type": "Van",
      "licensePlate": "ABC123"
    }
  }'
```

#### Login

```bash
# Login to appropriate org's API
# Sellers login to port 3002
curl -k -X POST https://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "seller1", "password": "password123"}'

# Customers login to port 3001
curl -k -X POST https://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "customer1", "password": "password123"}'

# Store token for subsequent requests
export TOKEN="<jwt_token_from_response>"
```

### Shop Items (Sellers Only)

```bash
# Create a shop item (via Sellers API - port 3002)
curl -k -X POST https://localhost:3002/api/v1/shop-items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -d '{
    "name": "Wireless Headphones",
    "description": "Bluetooth 5.0 over-ear headphones",
    "priceInCents": 9999
  }'

# List your shop items
curl -k https://localhost:3002/api/v1/shop-items \
  -H "Authorization: Bearer $SELLER_TOKEN"
```

### Orders (Customers)

```bash
# Create an order (as customer via Sellers API - port 3002)
# Orders are created on Sellers API where shop items exist.
# Customer JWT is validated via cross-org verification with Platform API.
curl -k -X POST https://localhost:3002/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{
    "sellerId": "<seller_user_id>",
    "items": [{"itemId": "<shop_item_id>", "quantity": 1}]
  }'

# Seller confirms order (creates delivery on blockchain via Sellers API - port 3002)
curl -k -X POST https://localhost:3002/api/v1/orders/<order_id>/confirm \
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

Each user queries their org's API:

```bash
# Get delivery details (use your org's API port)
# Platform users (customers): port 3001
# Sellers: port 3002  
# Logistics (drivers): port 3003
curl -k https://localhost:3001/api/v1/deliveries/<delivery_id> \
  -H "Authorization: Bearer $TOKEN"

# Get deliveries assigned to me
curl -k https://localhost:3001/api/v1/deliveries/my \
  -H "Authorization: Bearer $TOKEN"

# Get full blockchain history
curl -k https://localhost:3001/api/v1/deliveries/<delivery_id>/history \
  -H "Authorization: Bearer $TOKEN"
```

### Handoff Flow

The system uses a two-phase handoff process for secure custody transfers:

```bash
# 1. Seller initiates handoff to driver (via Sellers API - port 3002)
curl -k -X POST https://localhost:3002/api/v1/deliveries/<delivery_id>/handoff/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -d '{"toUserId": "<driver_id>", "toRole": "DELIVERY_PERSON"}'

# 2. Driver confirms pickup (via Logistics API - port 3003)
curl -k -X POST https://localhost:3003/api/v1/deliveries/<delivery_id>/handoff/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d '{"city": "NYC", "state": "NY", "country": "US"}'

# 3. Driver updates location during transit (via Logistics API - port 3003)
curl -k -X PUT https://localhost:3003/api/v1/deliveries/<delivery_id>/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d '{"city": "Brooklyn", "state": "NY", "country": "US"}'

# 4. Driver initiates handoff to customer (via Logistics API - port 3003)
curl -k -X POST https://localhost:3003/api/v1/deliveries/<delivery_id>/handoff/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d '{"toUserId": "<customer_id>", "toRole": "CUSTOMER"}'

# 5. Customer confirms delivery (via Platform API - port 3001)
curl -k -X POST https://localhost:3001/api/v1/deliveries/<delivery_id>/handoff/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{"city": "Brooklyn", "state": "NY", "country": "US"}'
```

### Dispute Handling

Recipients can dispute a pending handoff:

```bash
# Recipient disputes the handoff (use recipient's org API)
# Driver disputing: port 3003 (Logistics)
# Customer disputing: port 3001 (Platform)
curl -k -X POST https://localhost:3001/api/v1/deliveries/<delivery_id>/handoff/dispute \
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

// Connect to your org's API for WebSocket events
// Platform users: port 3001, Sellers: port 3002, Logistics: port 3003
const socket = io('wss://localhost:3001/delivery-events', {
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
│       ├── delivery.go           # Smart contract (+ state-based endorsement)
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
│       ├── deploy-chaincode.sh   # 2-of-3 endorsement policy
│       └── cleanup.sh
├── nestjs-api/
│   └── src/
│       ├── auth/                 # JWT authentication
│       ├── users/                # User management (per-org MongoDB)
│       ├── shop-items/           # Shop items (MongoDB)
│       ├── orders/               # Orders (MongoDB)
│       ├── deliveries/           # Delivery operations (Blockchain)
│       ├── events/               # WebSocket gateway
│       ├── common/enums.ts       # Org/MSP mappings, role permissions
│       └── fabric/               # Fabric Gateway, CA, Events services
│           ├── fabric-gateway.service.ts  # Service discovery enabled
│           ├── fabric-ca.service.ts       # Per-org CA enrollment
│           ├── wallet.service.ts          # Per-org encrypted storage
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
| `SetDeliveryPrivateDetails` | Store sensitive address | PlatformOrg, SellersOrg |
| `GetDeliveryPrivateDetails` | Read sensitive address | All orgs |
| `VerifyDeliveryPrivateDataHash` | Verify data hash | Any org |

## Endorsement Policies

### Chaincode-Level Policy (2-of-3)

All transactions require endorsement from at least 2 of the 3 organizations:

```
OutOf(2, 'PlatformOrgMSP.member', 'SellersOrgMSP.member', 'LogisticsOrgMSP.member')
```

This prevents any single organization from unilaterally approving transactions.

### State-Based Endorsement (Per-Delivery)

Each delivery has a dynamic endorsement policy that follows its custody chain:

| Custody State | Required Endorser |
|--------------|-------------------|
| Seller has package | SellersOrgMSP |
| Driver has package | LogisticsOrgMSP |
| Customer received | PlatformOrgMSP |

When custody changes via `ConfirmHandoff`, the policy updates to require the new custodian's organization.

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

# Service Discovery
DISCOVERY_AS_LOCALHOST=true

# Per-Org Configuration (set by docker-compose per service)
ORG_NAME=PlatformOrg  # or SellersOrg, LogisticsOrg

# MongoDB (per-org)
MONGO_URI_PLATFORM=mongodb://mongodb-platform:27017/delivery_tracking
MONGO_URI_SELLERS=mongodb://mongodb-sellers:27018/delivery_tracking
MONGO_URI_LOGISTICS=mongodb://mongodb-logistics:27019/delivery_tracking

# JWT
JWT_SECRET=<your-secret>
JWT_EXPIRES_IN=24h

# Cross-Org Verification (for sensitive operations like order creation)
INTERNAL_API_KEY=<your-internal-key>

# Per-Org Wallet Encryption Keys (REQUIRED - 32-char hex string each)
WALLET_ENCRYPTION_KEY_PLATFORM=<32-character-hex-string>
WALLET_ENCRYPTION_KEY_SELLERS=<32-character-hex-string>
WALLET_ENCRYPTION_KEY_LOGISTICS=<32-character-hex-string>
# Generate with: openssl rand -hex 16
```

### Security Configuration

Each organization has its own wallet encryption key:
- **PlatformOrg**: `WALLET_ENCRYPTION_KEY_PLATFORM` - encrypts customer/admin keys
- **SellersOrg**: `WALLET_ENCRYPTION_KEY_SELLERS` - encrypts seller keys
- **LogisticsOrg**: `WALLET_ENCRYPTION_KEY_LOGISTICS` - encrypts driver keys

This ensures no single organization can access another organization's private keys.

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
