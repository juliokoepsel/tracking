# Architecture Documentation

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Browser    │  │    Mobile    │  │   Desktop    │                  │
│  │     App      │  │     App      │  │     App      │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                  │                  │                          │
│         └──────────────────┼──────────────────┘                          │
└────────────────────────────┼─────────────────────────────────────────────┘
                             │
                             │ HTTP/REST + Basic Auth
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                                 │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    FastAPI Service                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │    │
│  │  │   Routes     │  │   Models     │  │   Services   │         │    │
│  │  │  - Auth      │  │  - User      │  │  - Fabric    │         │    │
│  │  │  - Users     │  │  - Order     │  │    Client    │         │    │
│  │  │  - ShopItems │  │  - ShopItem  │  │  - Order     │         │    │
│  │  │  - Orders    │  │  - Delivery  │  │  - Delivery  │         │    │
│  │  │  - Delivery  │  │  - Enums     │  │  - ShopItem  │         │    │
│  │  └──────────────┘  └──────────────┘  └──────┬───────┘         │    │
│  └────────────────────────────────────────────┼─────────────────┘    │
└───────────────────────┬───────────────────────┼──────────────────────┘
                        │                        │
                        │ Motor/Beanie           │ Fabric SDK
                        ▼                        ▼
┌───────────────────────────────────┐   ┌────────────────────────────────┐
│       MongoDB Container           │   │   Hyperledger Fabric Network   │
│  ┌─────────┐ ┌──────────┐        │   │  ┌──────────┐ ┌─────────┐     │
│  │ Users   │ │ Orders   │        │   │  │  Peer    │ │ Orderer │     │
│  ├─────────┤ ├──────────┤        │   │  └──────────┘ └─────────┘     │
│  │ShopItems│ │          │        │   │  ┌──────────────────────┐     │
│  └─────────┘ └──────────┘        │   │  │ Chaincode (Go)       │     │
│                                   │   │  │ • Delivery Tracking  │     │
│  Off-chain: PII, Orders,         │   │  │ • Role Enforcement   │     │
│  User data, Pricing              │   │  │ • Handoff Workflow   │     │
└───────────────────────────────────┘   │  │ • Chaincode Events   │     │
                                         │  └──────────────────────┘     │
                                         │                                │
                                         │  On-chain: Delivery state,    │
                                         │  Custody, Status, History     │
                                         └────────────────────────────────┘
```

### Component Details

#### 1. Client Layer
- **Purpose**: User interfaces for interacting with the system
- **Technologies**: Web browsers, mobile apps, desktop applications
- **Communication**: REST API over HTTP/HTTPS with HTTP Basic authentication

#### 2. API Gateway Layer (FastAPI)
- **Container**: `delivery-api`
- **Port**: 8000
- **Components**:
  - **Routes**: 
    - `auth.py`: HTTP Basic authentication (login, register)
    - `users.py`: User management (Admin only)
    - `shop_items.py`: Product catalog (Seller)
    - `orders.py`: Order lifecycle (Customer creates, Seller confirms)
    - `delivery.py`: Blockchain delivery operations & handoffs
  - **Models**: 
    - `user.py`: User with Address, roles
    - `shop_item.py`: Seller products with pricing
    - `order.py`: Order with items, status, delivery link
    - `enums.py`: Role, OrderStatus, DeliveryStatus enums
  - **Services**: 
    - `fabric_client.py`: Blockchain interaction
    - `order_service.py`: Order business logic
    - `delivery_service.py`: Delivery operations
    - `shop_item_service.py`: Shop item logic
    - `event_listener.py`: Chaincode event sync
    - `database.py`: MongoDB initialization
- **Features**:
  - HTTP Basic Authentication
  - Role-based access control
  - Automatic API documentation (Swagger/OpenAPI)
  - Request validation
  - Error handling
  - CORS support

#### 3. MongoDB (Off-Chain Storage)
- **Container**: `mongodb`
- **Port**: 27017
- **Collections**:
  - `users`: User accounts, addresses, roles
  - `orders`: Order data, items, pricing
  - `shop_items`: Seller product catalogs
- **Purpose**: Store PII and sensitive data off-chain

#### 4. Hyperledger Fabric Network

##### Orderer (`orderer.example.com`)
- **Type**: Solo orderer (development)
- **Port**: 7050
- **Responsibilities**:
  - Transaction ordering
  - Block creation
  - Consensus

##### Peer (`peer0.delivery.example.com`)
- **Organization**: DeliveryOrg
- **Port**: 7051
- **Responsibilities**:
  - Chaincode execution
  - Transaction endorsement
  - State management
  - Ledger maintenance

##### Chaincode (Smart Contract)
- **Language**: Go
- **Name**: delivery
- **Version**: 1.0
- **Functions**:
  - `CreateDelivery(delivery_id, order_id, seller_id, customer_id, role)`: Create delivery (Seller only)
  - `GetDelivery(delivery_id)`: Retrieve delivery by ID
  - `GetAllDeliveries()`: List all deliveries
  - `GetDeliveryHistory(delivery_id)`: Get transaction history
  - `InitiateHandoff(delivery_id, to_user_id, caller_id, role)`: Start custody transfer
  - `ConfirmHandoff(delivery_id, caller_id, role)`: Accept pending handoff
  - `DisputeHandoff(delivery_id, reason, caller_id, role)`: Dispute handoff
- **Chaincode Events**:
  - `DeliveryCreated`: Emitted when delivery is created
  - `DeliveryStatusChanged`: Emitted on status change
  - `HandoffInitiated`: Emitted when handoff starts
  - `HandoffConfirmed`: Emitted when handoff is confirmed
  - `HandoffDisputed`: Emitted when handoff is disputed

##### Storage
- **World State**: Current state of all deliveries (LevelDB)
- **Blockchain**: Immutable transaction log

### Data Flow

#### Order to Delivery Flow

```
Customer              API                   MongoDB            Blockchain
  │                    │                      │                    │
  ├──POST /orders─────►│                      │                    │
  │   (create order)   ├──Save Order──────────►                    │
  │                    │   (PENDING_CONFIRM)  │                    │
  │◄──Order Created────┤                      │                    │
  │                    │                      │                    │
  │ [Seller Confirms]  │                      │                    │
  │                    │                      │                    │
Seller                 │                      │                    │
  ├─PUT /orders/{id}──►│                      │                    │
  │     /confirm       ├──Update Order────────►                    │
  │                    │   (CONFIRMED)        │                    │
  │                    ├──Create Delivery─────┼───────────────────►│
  │                    │   (blockchain)       │                    ├──Store
  │                    │◄─────────────────────┼──Delivery ID───────┤
  │                    ├──Link delivery_id────►                    │
  │◄──Delivery Created─┤                      │                    │
```

#### Handoff Flow

```
Seller                API                  Blockchain           DeliveryPerson
  │                    │                      │                    │
  ├──POST /handoff────►│                      │                    │
  │    /initiate       ├──InitiateHandoff────►│                    │
  │                    │                      ├──Validate Role     │
  │                    │                      ├──Set Pending       │
  │                    │◄──Event: Initiated───┤                    │
  │◄──Handoff Pending──┤                      │                    │
  │                    │                      │                    │
  │                    │           [Delivery Person Confirms]      │
  │                    │                      │                    │
  │                    │◄──POST /handoff/confirm──────────────────┤
  │                    ├──ConfirmHandoff─────►│                    │
  │                    │                      ├──Validate Role     │
  │                    │                      ├──Transfer Custody  │
  │                    │                      ├──Update Status     │
  │                    │◄──Event: Confirmed───┤                    │
  │                    ├──────────────────────┼──Handoff Complete─►│
```

```
Client                 API                  Fabric             Chaincode
  │                     │                     │                   │
  ├──GET /deliveries/ID►│                     │                   │
  │                     ├──Query Chaincode───►│                   │
  │                     │                     ├──Execute Query───►│
  │                     │                     │                   ├──Read State
  │                     │                     │◄──Delivery Data───┤
  │                     │◄──Delivery Data─────┤                   │
  │◄──200 OK────────────┤                     │                   │
  │   {delivery data}   │                     │                   │
```

### Network Topology

```
┌─────────────────────────────────────────────────────────────┐
│         Docker Network: fabric-delivery-network              │
│                                                               │
│  ┌──────────────────┐                                        │
│  │  orderer         │  Port 7050                             │
│  │  .example.com    │                                        │
│  └────────┬─────────┘                                        │
│           │                                                   │
│           │ Ordering Service                                 │
│           │                                                   │
│  ┌────────▼─────────┐                                        │
│  │  peer0.delivery  │  Port 7051 (Peer)                     │
│  │  .example.com    │  Port 9444 (Operations)               │
│  └────────┬─────────┘                                        │
│           │                                                   │
│           │ Endorsement                                      │
│           │                                                   │
│  ┌────────▼─────────┐    ┌──────────────────┐               │
│  │  delivery-api    │    │     mongodb      │               │
│  │  Port 8000 (HTTP)│◄──►│  Port 27017      │               │
│  └──────────────────┘    └──────────────────┘               │
│                                                               │
│  ┌──────────────────┐                                        │
│  │  cli             │  Interactive shell                     │
│  │  (fabric-tools)  │  for admin operations                 │
│  └──────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

### Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Security Layers                          │
│                                                               │
│  Application Layer                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  - HTTP Basic Authentication                         │    │
│  │  - Role-Based Access Control (RBAC)                  │    │
│  │  - Input Validation (Pydantic)                       │    │
│  │  - CORS Configuration                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Chaincode Layer                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  - Role validation in every function                 │    │
│  │  - Caller ID verification                            │    │
│  │  - Ownership checks for handoffs                     │    │
│  │  - Status transition validation                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Network Layer                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  - Docker Network Isolation                          │    │
│  │  - TLS for Production (Configurable)                 │    │
│  │  - Port Exposure Control                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Blockchain Layer                                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  - MSP (Membership Service Provider)                 │    │
│  │  - Certificate-based Identity                        │    │
│  │  - Channel Access Control                            │    │
│  │  - Chaincode Endorsement Policies                    │    │
│  │  - Immutable Audit Trail                             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Model

```
Development Environment (Current Setup)
┌────────────────────────────────────────┐
│  Single Machine (Docker Compose)       │
│  ┌──────────────────────────────────┐  │
│  │  - 1 Orderer                     │  │
│  │  - 1 Organization (DeliveryOrg)  │  │
│  │  - 1 Peer                        │  │
│  │  - 1 Channel                     │  │
│  │  - 1 API Service                 │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘

Production Environment (Recommended)
┌────────────────────────────────────────┐
│  Multi-Machine Cluster                 │
│  ┌──────────────────────────────────┐  │
│  │  - 3+ Orderers (Raft consensus)  │  │
│  │  - 2+ Organizations              │  │
│  │  - 2+ Peers per organization     │  │
│  │  - Multiple Channels             │  │
│  │  - Load-balanced API services    │  │
│  │  - TLS enabled                   │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### Scaling Strategies

#### Horizontal Scaling

**Peers:**
```yaml
# Add more peers in docker-compose.yml
peer1.delivery.example.com:
  # Similar configuration to peer0
```

**API Services:**
```yaml
# Use Docker Swarm or Kubernetes
replicas: 3
load_balancer:
  type: nginx
```

#### Vertical Scaling

**Resource Limits:**
```yaml
services:
  peer0.delivery.example.com:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

### Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Stack (Future)                 │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Prometheus  │  │   Grafana    │  │     ELK      │      │
│  │   Metrics    │  │  Dashboards  │  │     Logs     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                     Collect Data                             │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│  ┌──────▼───────┐  ┌───────▼──────┐  ┌───────▼──────┐      │
│  │   Orderer    │  │    Peer      │  │     API      │      │
│  │   Metrics    │  │   Metrics    │  │   Metrics    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Blockchain Platform | Hyperledger Fabric | 2.5 |
| Smart Contract | Go | 1.20 |
| API Framework | FastAPI | 0.104.1 |
| API Server | Uvicorn | 0.24.0 |
| Data Validation | Pydantic | 2.5.0 |
| Authentication | HTTP Basic (passlib + bcrypt) | Latest |
| Password Hashing | passlib + bcrypt | Latest |
| Off-Chain Database | MongoDB | Latest |
| MongoDB ODM | Beanie | Latest |
| Containerization | Docker | Latest |
| Orchestration | Docker Compose | Latest |
| Database (State) | LevelDB | Fabric default |
| API Documentation | OpenAPI/Swagger | 3.0 |



### Design Patterns Used

1. **Repository Pattern**: `fabric_client.py` abstracts blockchain operations
2. **Service Layer**: Business logic in `order_service.py`, `delivery_service.py`
3. **Model-View-Controller**: Separation of routes, models, and services
4. **Dependency Injection**: FastAPI's dependency system for auth
5. **Chain of Responsibility**: Fabric's endorsement flow
6. **Command Pattern**: Chaincode functions as commands
7. **Event-Driven**: Chaincode events for status synchronization
8. **Factory Pattern**: Chaincode contract creation

### Key Features

✓ **Immutability**: All delivery transactions recorded permanently
✓ **Transparency**: Complete audit trail via history
✓ **Decentralization**: Distributed ledger across peers
✓ **Smart Contracts**: Business logic with role enforcement
✓ **RESTful API**: Easy integration with any client
✓ **HTTP Basic Authentication**: Secure username/password access
✓ **Role-Based Access**: Admin, Seller, DeliveryPerson, Customer
✓ **Off-Chain Storage**: PII and sensitive data in MongoDB
✓ **Chaincode Events**: Real-time status synchronization
✓ **Automatic Documentation**: Interactive API docs
✓ **Containerized**: Portable and reproducible
✓ **Scalable**: Can add more peers and organizations


