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
│   │   ├── deliverychannel.block
│   │   ├── deliverychannel.tx
│   │   └── DeliveryOrgMSPanchors.tx
│   ├── config
│   │   ├── configtx.yaml
│   │   └── crypto-config.yaml
│   ├── organizations
│   │   ├── ordererOrganizations
│   │   │   └── example.com
│   │   │       ├── ca
│   │   │       │   ├── ca.example.com-cert.pem
│   │   │       │   └── priv_sk
│   │   │       ├── msp
│   │   │       │   ├── admincerts
│   │   │       │   ├── cacerts
│   │   │       │   │   └── ca.example.com-cert.pem
│   │   │       │   ├── config.yaml
│   │   │       │   └── tlscacerts
│   │   │       │       └── tlsca.example.com-cert.pem
│   │   │       ├── orderers
│   │   │       │   └── orderer.example.com
│   │   │       │       ├── msp
│   │   │       │       │   ├── admincerts
│   │   │       │       │   ├── cacerts
│   │   │       │       │   │   └── ca.example.com-cert.pem
│   │   │       │       │   ├── config.yaml
│   │   │       │       │   ├── keystore
│   │   │       │       │   │   └── priv_sk
│   │   │       │       │   ├── signcerts
│   │   │       │       │   │   └── orderer.example.com-cert.pem
│   │   │       │       │   └── tlscacerts
│   │   │       │       │       └── tlsca.example.com-cert.pem
│   │   │       │       └── tls
│   │   │       │           ├── ca.crt
│   │   │       │           ├── server.crt
│   │   │       │           └── server.key
│   │   │       ├── tlsca
│   │   │       │   ├── priv_sk
│   │   │       │   └── tlsca.example.com-cert.pem
│   │   │       └── users
│   │   │           └── Admin@example.com
│   │   │               ├── msp
│   │   │               │   ├── admincerts
│   │   │               │   ├── cacerts
│   │   │               │   │   └── ca.example.com-cert.pem
│   │   │               │   ├── config.yaml
│   │   │               │   ├── keystore
│   │   │               │   │   └── priv_sk
│   │   │               │   ├── signcerts
│   │   │               │   │   └── Admin@example.com-cert.pem
│   │   │               │   └── tlscacerts
│   │   │               │       └── tlsca.example.com-cert.pem
│   │   │               └── tls
│   │   │                   ├── ca.crt
│   │   │                   ├── client.crt
│   │   │                   └── client.key
│   │   └── peerOrganizations
│   │       └── delivery.example.com
│   │           ├── ca
│   │           │   ├── ca.delivery.example.com-cert.pem
│   │           │   └── priv_sk
│   │           ├── msp
│   │           │   ├── admincerts
│   │           │   ├── cacerts
│   │           │   │   └── ca.delivery.example.com-cert.pem
│   │           │   ├── config.yaml
│   │           │   └── tlscacerts
│   │           │       └── tlsca.delivery.example.com-cert.pem
│   │           ├── peers
│   │           │   └── peer0.delivery.example.com
│   │           │       ├── msp
│   │           │       │   ├── admincerts
│   │           │       │   ├── cacerts
│   │           │       │   │   └── ca.delivery.example.com-cert.pem
│   │           │       │   ├── config.yaml
│   │           │       │   ├── keystore
│   │           │       │   │   └── priv_sk
│   │           │       │   ├── signcerts
│   │           │       │   │   └── peer0.delivery.example.com-cert.pem
│   │           │       │   └── tlscacerts
│   │           │       │       └── tlsca.delivery.example.com-cert.pem
│   │           │       └── tls
│   │           │           ├── ca.crt
│   │           │           ├── server.crt
│   │           │           └── server.key
│   │           ├── tlsca
│   │           │   ├── priv_sk
│   │           │   └── tlsca.delivery.example.com-cert.pem
│   │           └── users
│   │               ├── Admin@delivery.example.com
│   │               │   ├── msp
│   │               │   │   ├── admincerts
│   │               │   │   ├── cacerts
│   │               │   │   │   └── ca.delivery.example.com-cert.pem
│   │               │   │   ├── config.yaml
│   │               │   │   ├── keystore
│   │               │   │   │   └── priv_sk
│   │               │   │   ├── signcerts
│   │               │   │   │   └── Admin@delivery.example.com-cert.pem
│   │               │   │   └── tlscacerts
│   │               │   │       └── tlsca.delivery.example.com-cert.pem
│   │               │   └── tls
│   │               │       ├── ca.crt
│   │               │       ├── client.crt
│   │               │       └── client.key
│   │               └── User1@delivery.example.com
│   │                   ├── msp
│   │                   │   ├── admincerts
│   │                   │   ├── cacerts
│   │                   │   │   └── ca.delivery.example.com-cert.pem
│   │                   │   ├── config.yaml
│   │                   │   ├── keystore
│   │                   │   │   └── priv_sk
│   │                   │   ├── signcerts
│   │                   │   │   └── User1@delivery.example.com-cert.pem
│   │                   │   └── tlscacerts
│   │                   │       └── tlsca.delivery.example.com-cert.pem
│   │                   └── tls
│   │                       ├── ca.crt
│   │                       ├── client.crt
│   │                       └── client.key
│   ├── scripts
│   │   ├── cleanup.sh
│   │   ├── deploy-chaincode.sh
│   │   └── start-network.sh
│   └── system-genesis-block
│       └── genesis.block
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
