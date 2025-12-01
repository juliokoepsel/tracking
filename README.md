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
│  │  Routes → Auth → Services → Fabric Client / MongoDB  │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
                │ Fabric SDK              │ Motor/Beanie
                ▼                         ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│  Hyperledger Fabric       │   │     MongoDB Container       │
│  ┌──────────┐ ┌─────────┐ │   │  ┌─────────┐ ┌──────────┐  │
│  │  Peer    │ │ Orderer │ │   │  │ Users   │ │ Orders   │  │
│  └──────────┘ └─────────┘ │   │  ├─────────┤ ├──────────┤  │
│  ┌──────────────────────┐ │   │  │ShopItems│ │Deliveries│  │
│  │ Chaincode (Go)       │ │   │  └─────────┘ └──────────┘  │
│  │ • Delivery Tracking  │ │   └─────────────────────────────┘
│  │ • Role Enforcement   │ │
│  │ • Handoff Workflow   │ │
│  └──────────────────────┘ │
└───────────────────────────┘
```

## 📦 Features

### Core Features
- **Order Management**: Customers create orders, sellers confirm to create blockchain deliveries
- **Shop Items**: Sellers manage product catalogs with pricing
- **Blockchain Delivery Tracking**: All delivery data stored immutably on Hyperledger Fabric
- **Smart Contracts**: Go-based chaincode with role validation and chaincode events
- **RESTful API**: FastAPI endpoints with HTTP Basic authentication
- **Docker Containerization**: Fully containerized deployment

### Authentication & Authorization
- **HTTP Basic Authentication**: Secure username/password API access
- **Multi-Role System**: Customer, Seller, Delivery Person, Admin roles
- **Role-Based Access Control**: Endpoints restricted by user role
- **Chaincode Role Enforcement**: Role validation at the blockchain level

### Chain of Custody
- **Handoff Tracking**: Full custody transfer recording between roles
- **Two-Party Confirmation**: Both parties must confirm transfers
- **Dispute System**: Ability to dispute handoffs with reason tracking
- **Chaincode Events**: Real-time status sync via blockchain events

### Off-Chain Data
- **MongoDB Integration**: Users, orders, and shop items stored off-chain
- **Beanie ODM**: Async MongoDB document modeling
- **Pre-seeded Admin**: System starts with admin user

## 👥 User Roles

| Role | Permissions |
|------|-------------|
| **ADMIN** | User management only (create, update, deactivate users) |
| **SELLER** | Manage shop items, confirm orders → create deliveries, initiate handoffs |
| **DELIVERY_PERSON** | Confirm/dispute handoffs, transit custody transfers |
| **CUSTOMER** | Create orders, view own orders, confirm final delivery |

## 📊 Order & Delivery Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ORDER FLOW (MongoDB)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Customer creates order    Seller confirms order    Delivery created        │
│  ────────────────────► ──────────────────────► ────────────────────►       │
│  PENDING_CONFIRMATION       CONFIRMED              (links to delivery_id)   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DELIVERY FLOW (Blockchain)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PENDING_PICKUP ──► IN_TRANSIT ──► OUT_FOR_DELIVERY ──► DELIVERED          │
│        │                 │                 │                                │
│        ▼                 ▼                 ▼                                │
│  DISPUTED_PICKUP   DISPUTED_TRANSIT  DISPUTED_DELIVERY                     │
│                                                                             │
│  Handoff Flow:                                                              │
│  Seller → DeliveryPerson → [Multiple Transit Handoffs] → Customer          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
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
All endpoints require HTTP Basic authentication (except registration). Include credentials in the Authorization header:
```
Authorization: Basic <base64(username:password)>
```

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Verify credentials (returns user info) |

### Users (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | List all users |
| GET | `/api/v1/users/me` | Get current user profile |
| PUT | `/api/v1/users/me/address` | Update own address |
| GET | `/api/v1/users/{id}` | Get user by ID |
| PUT | `/api/v1/users/{id}` | Update user (Admin) |
| DELETE | `/api/v1/users/{id}` | Deactivate user (Admin) |

### Shop Items (Seller)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/shop-items` | Create shop item (Seller) |
| GET | `/api/v1/shop-items` | List all shop items |
| GET | `/api/v1/shop-items/{id}` | Get item by ID |
| PUT | `/api/v1/shop-items/{id}` | Update item (Owner/Admin) |
| DELETE | `/api/v1/shop-items/{id}` | Delete item (Owner/Admin) |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/orders` | Create order (Customer) |
| GET | `/api/v1/orders` | List orders (role-filtered) |
| GET | `/api/v1/orders/{id}` | Get order details |
| PUT | `/api/v1/orders/{id}/confirm` | Confirm order → creates delivery (Seller) |
| PUT | `/api/v1/orders/{id}/cancel` | Cancel order |

### Deliveries (Blockchain)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/deliveries` | Get all deliveries (role-filtered) |
| GET | `/api/v1/deliveries/{id}` | Get delivery by ID |
| GET | `/api/v1/deliveries/{id}/history` | Get delivery history |

### Handoff Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/deliveries/{id}/handoff/initiate` | Initiate handoff to next party |
| POST | `/api/v1/deliveries/{id}/handoff/confirm` | Confirm pending handoff |
| POST | `/api/v1/deliveries/{id}/handoff/dispute` | Dispute handoff with reason |

### Example: Complete Order Flow

**1. Customer creates an order:**
```bash
curl -X POST http://localhost:8000/api/v1/orders \
  -H "Authorization: Bearer <customer_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"item_id": "shop_item_id_here", "quantity": 2}
    ],
    "shipping_address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "USA"
    }
  }'
```

**2. Seller confirms the order (creates blockchain delivery):**
```bash
curl -X PUT http://localhost:8000/api/v1/orders/{order_id}/confirm \
  -H "Authorization: Bearer <seller_token>"
```

**3. Seller initiates handoff to delivery person:**
```bash
curl -X POST http://localhost:8000/api/v1/deliveries/{delivery_id}/handoff/initiate \
  -H "Authorization: Bearer <seller_token>" \
  -H "Content-Type: application/json" \
  -d '{"to_user_id": "delivery_person_id"}'
```

**4. Delivery person confirms pickup (with location and package data):**
```bash
curl -X POST http://localhost:8000/api/v1/deliveries/{delivery_id}/handoff/confirm \
  -H "Authorization: Bearer <delivery_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "package_weight": 2.5,
    "dimension_length": 30,
    "dimension_width": 20,
    "dimension_height": 10
  }'
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
│   └── delivery/
│       ├── main.go               # Chaincode entry point
│       ├── delivery.go           # Delivery contract logic
│       └── go.mod
│
└── api/                          # FastAPI application
    ├── Dockerfile
    ├── requirements.txt
    ├── main.py
    ├── connection-profile.json
    └── app/
        ├── __init__.py
        ├── models/               # Pydantic/Beanie models
        │   ├── enums.py          # Role, OrderStatus, DeliveryStatus
        │   ├── user.py           # User model with Address
        │   ├── shop_item.py      # ShopItem model (seller products)
        │   └── order.py          # Order model with items
        ├── routes/               # API endpoints
        │   ├── auth.py           # JWT authentication
        │   ├── users.py          # User management
        │   ├── shop_items.py     # Shop item CRUD
        │   ├── orders.py         # Order management
        │   └── delivery.py       # Blockchain delivery operations
        └── services/             # Business logic
            ├── fabric_client.py  # Fabric SDK wrapper
            ├── order_service.py  # Order business logic
            ├── delivery_service.py # Delivery operations
            ├── shop_item_service.py # Shop item logic
            ├── event_listener.py # Chaincode event sync
            └── database.py       # MongoDB initialization
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

## 📊 Data Models

### Blockchain Delivery (Chaincode)
- `delivery_id`: Unique identifier
- `order_id`: Reference to MongoDB order
- `seller_id`: Seller user ID
- `customer_id`: Customer user ID
- `current_holder_id`: Current custody holder
- `status`: Delivery status enum
- `pending_handoff_to`: User ID for pending handoff
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

### Order (MongoDB)
- `customer_id`: Customer who created the order
- `seller_id`: Seller who owns the items
- `items`: List of {item_id, quantity, price_cents}
- `total_cents`: Total order amount
- `status`: PENDING_CONFIRMATION | CONFIRMED | CANCELLED
- `delivery_id`: Link to blockchain delivery (after confirmation)
- `shipping_address`: Delivery address

### ShopItem (MongoDB)
- `seller_id`: Owner of the item
- `name`: Product name
- `description`: Product description
- `price_cents`: Price in cents
- `is_active`: Whether item is available

## 🔐 Security Notes

- All delivery transactions are recorded on the blockchain (immutable)
- JWT authentication with configurable expiration
- Role-based access control at API and chaincode level
- Chaincode validates caller role for all operations
- MongoDB stores sensitive user data off-chain
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
