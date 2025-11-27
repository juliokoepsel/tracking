# 📦 Package Delivery Tracking System with Hyperledger Fabric

> A complete blockchain-based package delivery tracking system built with Hyperledger Fabric, FastAPI, and MongoDB

[![Hyperledger Fabric](https://img.shields.io/badge/Hyperledger%20Fabric-2.5-blue.svg)](https://www.hyperledger.org/use/fabric)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green.svg)](https://fastapi.tiangolo.com/)
[![Go](https://img.shields.io/badge/Go-1.20-00ADD8.svg)](https://golang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Latest-47A248.svg)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

A production-ready, distributed package delivery tracking system leveraging blockchain technology for immutable record-keeping, chain of custody tracking, and multi-role authentication.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ REST API (HTTP Basic Auth)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Service (Docker Container)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes → Auth → Services → Fabric SDK / MongoDB     │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
                │ Fabric SDK              │ Motor/Beanie
                ▼                         ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│  Hyperledger Fabric       │   │     MongoDB Container       │
│  ┌──────────┐ ┌─────────┐ │   │  ┌─────────┐  ┌─────────┐  │
│  │  Peer    │ │ Orderer │ │   │  │ Users   │  │ Orders  │  │
│  └──────────┘ └─────────┘ │   │  └─────────┘  └─────────┘  │
│  ┌──────────────────────┐ │   └─────────────────────────────┘
│  │ Chaincode (Go)       │ │
│  │ • Chain of Custody   │ │
│  │ • Ownership Enforce  │ │
│  └──────────────────────┘ │
└───────────────────────────┘
```

## 📦 Features

### Core Features
- **CRUD Operations**: Create, Read, Update, Delete delivery packages
- **Blockchain Storage**: All delivery data stored on Hyperledger Fabric
- **Smart Contracts**: Go-based chaincode for business logic
- **RESTful API**: FastAPI endpoints for easy integration
- **Docker Containerization**: Fully containerized deployment
- **Status Tracking**: Track delivery status throughout the lifecycle

### Authentication & Authorization
- **HTTP Basic Auth**: Secure API access with username/password
- **Multi-Role System**: Customer, Seller, Delivery Person, Admin roles
- **Role-Based Access Control**: Endpoints restricted by user role
- **Ownership Enforcement**: Chaincode-level ownership verification

### Chain of Custody
- **Handoff Tracking**: Full custody transfer recording
- **Two-Party Confirmation**: Both parties must confirm transfers
- **Dispute System**: Ability to dispute handoffs
- **Audit Trail**: Complete history of custody changes

### Off-Chain Data
- **MongoDB Integration**: Users and orders stored off-chain
- **Beanie ODM**: Async MongoDB document modeling
- **Pre-seeded Admin**: System starts with admin user

## 👥 User Roles

| Role | Permissions |
|------|-------------|
| **ADMIN** | Full system access, user management, view all orders |
| **SELLER** | Create orders/deliveries, initiate handoffs, manage own orders |
| **DELIVERY_PERSON** | Confirm/dispute handoffs, update delivery status |
| **CUSTOMER** | View own orders, confirm final delivery |

## 📊 Delivery Status Flow

```
PENDING_SHIPPING → PENDING_PICKUP → IN_TRANSIT → PENDING_DELIVERY_CONFIRMATION → CONFIRMED_DELIVERY
        ↓               ↓                ↓                    ↓
    CANCELLED     DISPUTED_PICKUP  PENDING_TRANSIT_HANDOFF  DISPUTED_DELIVERY
                                          ↓
                                   DISPUTED_TRANSIT_HANDOFF
```

## 🚀 Quick Start

### Prerequisites

- Docker (installed ✓)
- Docker Compose (installed ✓)
- At least 4GB RAM available for Docker

### Installation

1. **Clone and navigate to the project**
   ```bash
   cd /home/leviathan/Desktop/tracking
   ```

2. **Copy environment file**
   ```bash
   cp .env-example .env
   ```

3. **Start the Fabric network**
   ```bash
   ./fabric-network/scripts/start-network.sh
   ```

4. **Deploy the chaincode**
   ```bash
   ./fabric-network/scripts/deploy-chaincode.sh
   ```

5. **Start all services (API + MongoDB)**
   ```bash
   docker-compose up -d
   ```

6. **Access the API documentation**
   Open your browser: http://localhost:8000/docs

### Default Admin Credentials

```
Username: admin
Password: admin
```

## 📚 API Endpoints

### Authentication
All endpoints require HTTP Basic Auth. Include credentials in the request header.

### Users (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/users` | Create new user |
| GET | `/api/v1/users` | List all users |
| GET | `/api/v1/users/me` | Get current user profile |
| GET | `/api/v1/users/{id}` | Get user by ID |
| PUT | `/api/v1/users/{id}` | Update user |
| DELETE | `/api/v1/users/{id}` | Deactivate user |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/orders` | Create order (Seller/Admin) |
| GET | `/api/v1/orders` | List orders (role-filtered) |
| GET | `/api/v1/orders/{id}` | Get order details |
| GET | `/api/v1/orders/tracking/{tracking_id}` | Get by tracking ID |
| PUT | `/api/v1/orders/{id}/cancel` | Cancel order |

### Deliveries (Blockchain)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/deliveries` | Create delivery |
| GET | `/api/v1/deliveries` | Get all deliveries |
| GET | `/api/v1/deliveries/{id}` | Get delivery by ID |
| PUT | `/api/v1/deliveries/{id}` | Update delivery |
| DELETE | `/api/v1/deliveries/{id}` | Cancel delivery |
| GET | `/api/v1/deliveries/status/{status}` | Filter by status |
| GET | `/api/v1/deliveries/{id}/history` | Get history |

### Chain of Custody
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/deliveries/{id}/handoff/initiate` | Start handoff |
| POST | `/api/v1/deliveries/{id}/handoff/confirm` | Confirm handoff |
| POST | `/api/v1/deliveries/{id}/handoff/dispute` | Dispute handoff |
| POST | `/api/v1/deliveries/{id}/handoff/cancel` | Cancel handoff |

### Example: Create Delivery
```bash
curl -X POST http://localhost:8000/api/v1/deliveries \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryId": "DEL001",
    "senderName": "John Doe",
    "senderAddress": "123 Main St, City, Country",
    "recipientName": "Jane Smith",
    "recipientAddress": "456 Oak Ave, City, Country",
    "packageWeight": 2.5,
    "packageDimensions": {
      "length": 30,
      "width": 20,
      "height": 15
    },
    "packageDescription": "Electronics",
  "estimatedDeliveryDate": "2025-10-15T10:00:00Z"
}
```

### Get Delivery by ID
```bash
GET /api/v1/deliveries/{deliveryId}
```

### Get All Deliveries
```bash
GET /api/v1/deliveries
```

### Update Delivery
```bash
PUT /api/v1/deliveries/{deliveryId}
Content-Type: application/json

{
  "deliveryStatus": "IN_TRANSIT",
  "recipientAddress": "789 New St, City, Country"
}
```

### Delete Delivery
```bash
DELETE /api/v1/deliveries/{deliveryId}
```

## 🗂️ Project Structure

```
tracking/
├── .env                          # Environment configuration
├── docker-compose.yml            # Docker orchestration
├── README.md                     # This file
│
├── fabric-network/               # Hyperledger Fabric network
│   ├── config/                   # Network configuration files
│   │   ├── configtx.yaml
│   │   └── crypto-config.yaml
│   ├── scripts/                  # Utility scripts
│   │   ├── start-network.sh
│   │   ├── deploy-chaincode.sh
│   │   └── cleanup.sh
│   └── organizations/            # Crypto material (generated)
│
├── chaincode/                    # Go smart contracts
│   ├── delivery/
│   │   ├── main.go
│   │   ├── delivery.go
│   │   └── go.mod
│
└── api/                          # FastAPI application
    ├── Dockerfile
    ├── requirements.txt
    ├── main.py
    ├── connection-profile.json
    └── app/
        ├── __init__.py
        ├── models/               # Pydantic models
        │   └── delivery.py
        ├── routes/               # API endpoints
        │   └── delivery.py
        └── services/             # Business logic
            └── fabric_client.py
```

## 🔧 Development

### Stop all services
```bash
docker-compose down
```

### Clean up and restart
```bash
./fabric-network/scripts/cleanup.sh
./fabric-network/scripts/start-network.sh
```

### View logs
```bash
# API logs
docker-compose logs -f api

# Fabric peer logs
docker-compose logs -f peer0.delivery.example.com
```

## 📊 Data Model

**Delivery Package:**
- `deliveryId`: Unique identifier
- `senderName`: Name of the sender
- `senderAddress`: Sender's address
- `recipientName`: Name of the recipient
- `recipientAddress`: Recipient's address
- `packageWeight`: Weight in kg
- `packageDimensions`: Object with length, width, height (cm)
- `packageDescription`: Description of contents
- `deliveryStatus`: PENDING | IN_TRANSIT | DELIVERED | CANCELED
- `createdAt`: Timestamp of creation
- `updatedAt`: Timestamp of last update
- `estimatedDeliveryDate`: Expected delivery date

## 🔐 Security Notes

- All transactions are recorded on the blockchain (immutable)
- Access control managed through Fabric MSP
- TLS enabled for peer-to-peer communication
- Admin credentials stored in .env file (change in production)

## 📚 Documentation Map

- **README.md** - Overview, quick start, and project structure
- **ARCHITECTURE.md** - System design, components, and data flows
- **DEPLOYMENT.md** - Step-by-step deployment and configuration
- **OPERATIONS.md** - Commands, workflows, and common tasks
- **TROUBLESHOOTING.md** - Deep-dive issue resolution
- **STRUCTURE.generated.md** - Auto-generated file tree and statistics
- **METRICS.generated.md** - Auto-generated project metrics

## 📝 License

MIT License

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please open an issue in the repository.
