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
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                                 │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    FastAPI Service                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │    │
│  │  │   Routes     │  │   Models     │  │   Services   │         │    │
│  │  │  - CRUD      │  │  - Pydantic  │  │  - Fabric    │         │    │
│  │  │  - OpenAPI   │  │  - Validation│  │    Client    │         │    │
│  │  └──────────────┘  └──────────────┘  └──────┬───────┘         │    │
│  └────────────────────────────────────────────┼─────────────────┘    │
└────────────────────────────────────────────────┼──────────────────────┘
                                                  │
                                                  │ Fabric SDK
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Hyperledger Fabric Network                            │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                     Channel: deliverychannel                    │    │
│  │                                                                  │    │
│  │  ┌──────────────┐         ┌──────────────┐                     │    │
│  │  │   Orderer    │◄───────►│    Peer0     │                     │    │
│  │  │              │         │  DeliveryOrg  │                     │    │
│  │  │  - Consensus │         │  - Endorser   │                     │    │
│  │  │  - Ordering  │         │  - Committer  │                     │    │
│  │  └──────────────┘         └──────┬────────┘                     │    │
│  │                                   │                              │    │
│  │                           ┌───────▼────────┐                    │    │
│  │                           │   Chaincode    │                    │    │
│  │                           │   (Go Smart    │                    │    │
│  │                           │    Contract)   │                    │    │
│  │                           │                │                    │    │
│  │                           │  - Create      │                    │    │
│  │                           │  - Read        │                    │    │
│  │                           │  - Update      │                    │    │
│  │                           │  - Delete      │                    │    │
│  │                           │  - Query       │                    │    │
│  │                           └───────┬────────┘                    │    │
│  │                                   │                              │    │
│  │                           ┌───────▼────────┐                    │    │
│  │                           │   World State  │                    │    │
│  │                           │   (LevelDB)    │                    │    │
│  │                           └────────────────┘                    │    │
│  │                                                                  │    │
│  │                           ┌────────────────┐                    │    │
│  │                           │   Blockchain   │                    │    │
│  │                           │   (Ledger)     │                    │    │
│  │                           └────────────────┘                    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Client Layer
- **Purpose**: User interfaces for interacting with the system
- **Technologies**: Web browsers, mobile apps, desktop applications
- **Communication**: REST API over HTTP/HTTPS

#### 2. API Gateway Layer (FastAPI)
- **Container**: `delivery-api`
- **Port**: 8000
- **Components**:
  - **Routes** (`app/routes/delivery.py`): API endpoint handlers
  - **Models** (`app/models/delivery.py`): Data validation and serialization
  - **Services** (`app/services/fabric_client.py`): Blockchain interaction logic
- **Features**:
  - Automatic API documentation (Swagger/OpenAPI)
  - Request validation
  - Error handling
  - CORS support

#### 3. Hyperledger Fabric Network

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
  - `InitLedger()`: Initialize with sample data
  - `CreateDelivery()`: Create new delivery record
  - `ReadDelivery()`: Retrieve delivery by ID
  - `UpdateDelivery()`: Update delivery information
  - `DeleteDelivery()`: Mark delivery as canceled
  - `QueryAllDeliveries()`: Get all deliveries
  - `GetDeliveryHistory()`: Get transaction history
  - `QueryDeliveriesByStatus()`: Filter by status

##### Storage
- **World State**: Current state of all deliveries (LevelDB)
- **Blockchain**: Immutable transaction log

### Data Flow

#### Create Delivery Flow

```
Client                 API                  Fabric             Chaincode
  │                     │                     │                   │
  ├──POST /deliveries──►│                     │                   │
  │                     ├──Validate Request───┤                   │
  │                     │                     │                   │
  │                     ├──Invoke Chaincode──►│                   │
  │                     │                     ├──Execute Create──►│
  │                     │                     │                   ├──Validate
  │                     │                     │                   ├──Store
  │                     │                     │◄──Return Result───┤
  │                     │◄──Transaction ID────┤                   │
  │                     ├──Query Delivery────►│                   │
  │                     │◄──Delivery Data─────┤                   │
  │◄──201 Created───────┤                     │                   │
  │   {delivery data}   │                     │                   │
```

#### Query Delivery Flow

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
│  ┌────────▼─────────┐                                        │
│  │  delivery-api    │  Port 8000 (HTTP)                     │
│  └──────────────────┘                                        │
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
│  │  - Input Validation (Pydantic)                       │    │
│  │  - CORS Configuration                                │    │
│  │  - Request Rate Limiting (TODO)                      │    │
│  │  - Authentication/Authorization (TODO)               │    │
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
| Containerization | Docker | Latest |
| Orchestration | Docker Compose | Latest |
| Database (State) | LevelDB | Fabric default |
| API Documentation | OpenAPI/Swagger | 3.0 |



### Design Patterns Used

1. **Repository Pattern**: `fabric_client.py` abstracts blockchain operations
2. **Model-View-Controller**: Separation of routes, models, and services
3. **Dependency Injection**: FastAPI's dependency system
4. **Chain of Responsibility**: Fabric's endorsement flow
5. **Command Pattern**: Chaincode functions as commands
6. **Factory Pattern**: Chaincode contract creation

### Key Features

✓ **Immutability**: All transactions recorded permanently
✓ **Transparency**: Complete audit trail via history
✓ **Decentralization**: Distributed ledger across peers
✓ **Smart Contracts**: Business logic on blockchain
✓ **RESTful API**: Easy integration with any client
✓ **Automatic Documentation**: Interactive API docs
✓ **Containerized**: Portable and reproducible
✓ **Scalable**: Can add more peers and organizations


