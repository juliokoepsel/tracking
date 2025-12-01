#!/bin/bash
#
# Start the Hyperledger Fabric network for delivery tracking
#

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to the project root directory
cd "$(dirname "$0")/../.."

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Starting Delivery Tracking Network${NC}"
echo -e "${GREEN}========================================${NC}"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Create directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p fabric-network/organizations
mkdir -p fabric-network/channel-artifacts
mkdir -p fabric-network/system-genesis-block

# Generate crypto material
echo -e "${YELLOW}Generating crypto material...${NC}"
if [ ! -d "fabric-network/organizations/peerOrganizations" ]; then
    docker run --rm \
        -v $(pwd)/fabric-network:/fabric-network \
        -w /fabric-network \
        hyperledger/fabric-tools:2.5 \
        cryptogen generate \
        --config=./config/crypto-config.yaml \
        --output="organizations"
    
    echo -e "${GREEN}✓ Crypto material generated${NC}"
else
    echo -e "${GREEN}✓ Crypto material already exists${NC}"
fi

# Generate genesis block
echo -e "${YELLOW}Generating genesis block...${NC}"
docker run --rm \
    -v $(pwd)/fabric-network:/fabric-network \
    -w /fabric-network \
    -e FABRIC_CFG_PATH=/fabric-network/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen \
    -profile DeliveryOrdererGenesis \
    -channelID system-channel \
    -outputBlock ./system-genesis-block/genesis.block

echo -e "${GREEN}✓ Genesis block generated${NC}"

# Generate channel configuration transaction
echo -e "${YELLOW}Generating channel configuration transaction...${NC}"
docker run --rm \
    -v $(pwd)/fabric-network:/fabric-network \
    -w /fabric-network \
    -e FABRIC_CFG_PATH=/fabric-network/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen \
    -profile DeliveryChannel \
    -outputCreateChannelTx ./channel-artifacts/${CHANNEL_NAME}.tx \
    -channelID ${CHANNEL_NAME}

echo -e "${GREEN}✓ Channel configuration generated${NC}"

# Generate anchor peer update for DeliveryOrg
echo -e "${YELLOW}Generating anchor peer update...${NC}"
docker run --rm \
    -v $(pwd)/fabric-network:/fabric-network \
    -w /fabric-network \
    -e FABRIC_CFG_PATH=/fabric-network/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen \
    -profile DeliveryChannel \
    -outputAnchorPeersUpdate ./channel-artifacts/DeliveryOrgMSPanchors.tx \
    -channelID ${CHANNEL_NAME} \
    -asOrg DeliveryOrgMSP

echo -e "${GREEN}✓ Anchor peer update generated${NC}"

# Start the network
echo -e "${YELLOW}Starting Docker containers...${NC}"
docker-compose up -d orderer.example.com peer0.delivery.example.com cli

# Wait for containers to start
echo -e "${YELLOW}Waiting for containers to be ready...${NC}"
sleep 10

# TLS CA file path (inside CLI container)
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# Create channel
echo -e "${YELLOW}Creating channel: ${CHANNEL_NAME}...${NC}"
docker exec cli peer channel create \
    -o orderer.example.com:7050 \
    -c ${CHANNEL_NAME} \
    -f ./channel-artifacts/${CHANNEL_NAME}.tx \
    --outputBlock ./channel-artifacts/${CHANNEL_NAME}.block \
    --tls --cafile ${ORDERER_CA}

echo -e "${GREEN}✓ Channel created${NC}"

# Join peer to channel
echo -e "${YELLOW}Joining peer to channel...${NC}"
docker exec cli peer channel join \
    -b ./channel-artifacts/${CHANNEL_NAME}.block

echo -e "${GREEN}✓ Peer joined channel${NC}"

# Update anchor peer
echo -e "${YELLOW}Updating anchor peer...${NC}"
docker exec cli peer channel update \
    -o orderer.example.com:7050 \
    -c ${CHANNEL_NAME} \
    -f ./channel-artifacts/DeliveryOrgMSPanchors.tx \
    --tls --cafile ${ORDERER_CA}

echo -e "${GREEN}✓ Anchor peer updated${NC}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Network started successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Deploy chaincode: ${GREEN}./fabric-network/scripts/deploy-chaincode.sh${NC}"
echo -e "  2. Start API service: ${GREEN}docker-compose up -d api${NC}"
