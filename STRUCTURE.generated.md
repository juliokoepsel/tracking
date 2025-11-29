# Project Structure

```
.
├── api
│   ├── app
│   │   ├── __init__.py
│   │   ├── models
│   │   │   ├── enums.py
│   │   │   ├── order.py
│   │   │   ├── shop_item.py
│   │   │   └── user.py
│   │   ├── routes
│   │   │   ├── delivery.py
│   │   │   ├── orders.py
│   │   │   ├── shop_items.py
│   │   │   └── users.py
│   │   └── services
│   │       ├── auth.py
│   │       ├── database.py
│   │       ├── delivery_service.py
│   │       ├── event_listener.py
│   │       ├── fabric_client.py
│   │       ├── order_service.py
│   │       └── shop_item_service.py
│   ├── connection-profile.json
│   ├── Dockerfile
│   ├── examples.sh
│   ├── main.py
│   ├── organizations
│   ├── postman-collection.json
│   └── requirements.txt
├── ARCHITECTURE.md
├── BANNER.txt
├── chaincode
│   └── delivery
│       ├── delivery.go
│       ├── Dockerfile
│       ├── go.mod
│       ├── go.sum
│       └── main.go
├── DEPLOYMENT.md
├── docker-compose.yml
├── fabric-network
│   ├── channel-artifacts
│   ├── config
│   │   ├── configtx.yaml
│   │   └── crypto-config.yaml
│   ├── organizations
│   ├── scripts
│   │   ├── cleanup.sh
│   │   ├── deploy-chaincode.sh
│   │   └── start-network.sh
│   └── system-genesis-block
├── generate_docs.sh
├── Makefile
├── METRICS.generated.md
├── mongo-init
│   └── init-mongo.js
├── OPERATIONS.md
├── README.md
├── STRUCTURE.generated.md
└── TROUBLESHOOTING.md
```
