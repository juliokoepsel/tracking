# 📦 Package Delivery Tracking System with Hyperledger Fabric

> A complete blockchain-based package delivery tracking system built with Hyperledger Fabric and FastAPI

[![Hyperledger Fabric](https://img.shields.io/badge/Hyperledger%20Fabric-2.5-blue.svg)](https://www.hyperledger.org/use/fabric)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green.svg)](https://fastapi.tiangolo.com/)
[![Go](https://img.shields.io/badge/Go-1.20-00ADD8.svg)](https://golang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

A production-ready, distributed package delivery tracking system leveraging blockchain technology for immutable record-keeping and transparency.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ REST API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Service (Docker Container)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes → Services → Fabric SDK Client               │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Fabric SDK
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          Hyperledger Fabric Network (Docker Containers)      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Peer    │  │ Orderer  │  │    CA    │  │Chaincode │    │
│  │          │  │          │  │          │  │  (Go)    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Features

- **CRUD Operations**: Create, Read, Update, Delete delivery packages
- **Blockchain Storage**: All delivery data stored on Hyperledger Fabric
- **Smart Contracts**: Go-based chaincode for business logic
- **RESTful API**: FastAPI endpoints for easy integration
- **Docker Containerization**: Fully containerized deployment
- **Status Tracking**: Track delivery status throughout the lifecycle

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

2. **Start the Fabric network**
   ```bash
   ./fabric-network/scripts/start-network.sh
   ```

3. **Deploy the chaincode**
   ```bash
   ./fabric-network/scripts/deploy-chaincode.sh
   ```

4. **Start the FastAPI service**
   ```bash
   docker-compose up -d api
   ```

5. **Access the API documentation**
   Open your browser: http://localhost:8000/docs

## 📚 API Endpoints

### Create Delivery
```bash
POST /api/v1/deliveries
Content-Type: application/json

{
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
