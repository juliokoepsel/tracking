#!/bin/bash
#
# Start the Multi-Org Hyperledger Fabric network for delivery tracking
# Organizations: PlatformOrg, SellersOrg, LogisticsOrg
# Orderers: 3-node Raft consensus
#

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Change to the project root directory
cd "$(dirname "$0")/../.."

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Starting Multi-Org Delivery Tracking Network${NC}"
echo -e "${GREEN}Organizations: PlatformOrg, SellersOrg, LogisticsOrg${NC}"
echo -e "${GREEN}Orderers: 3-node Raft Consensus${NC}"
echo -e "${GREEN}========================================${NC}"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

CHANNEL_NAME=${CHANNEL_NAME:-deliverychannel}

# Create directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p fabric-network/organizations/peerOrganizations
mkdir -p fabric-network/organizations/ordererOrganizations
mkdir -p fabric-network/channel-artifacts
mkdir -p fabric-network/system-genesis-block

# Generate crypto material
echo -e "${YELLOW}Generating crypto material for all organizations...${NC}"
if [ ! -d "fabric-network/organizations/peerOrganizations/platform.example.com" ]; then
    docker run --rm \
        -v $(pwd)/fabric-network:/fabric-network \
        -w /fabric-network \
        hyperledger/fabric-tools:2.5 \
        cryptogen generate \
        --config=./config/crypto-config.yaml \
        --output="organizations"
    
    echo -e "${GREEN}✓ Crypto material generated for all orgs${NC}"
else
    echo -e "${GREEN}✓ Crypto material already exists${NC}"
fi

# Generate genesis block with Raft orderer consortium
echo -e "${YELLOW}Generating genesis block (Raft consensus)...${NC}"
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

# Generate channel configuration block (not tx anymore - using osnadmin)
echo -e "${YELLOW}Generating channel configuration block...${NC}"
docker run --rm \
    -v $(pwd)/fabric-network:/fabric-network \
    -w /fabric-network \
    -e FABRIC_CFG_PATH=/fabric-network/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen \
    -profile DeliveryChannel \
    -outputBlock ./channel-artifacts/${CHANNEL_NAME}.block \
    -channelID ${CHANNEL_NAME}

echo -e "${GREEN}✓ Channel block generated${NC}"

# Start orderers first
echo -e "${YELLOW}Starting Raft orderers...${NC}"
docker-compose up -d orderer1.orderer.example.com orderer2.orderer.example.com orderer3.orderer.example.com
sleep 5

# Start all peers
echo -e "${YELLOW}Starting peers...${NC}"
docker-compose up -d peer0.platform.example.com peer0.sellers.example.com peer0.logistics.example.com
sleep 10

# Start a CLI container for PlatformOrg
echo -e "${YELLOW}Starting CLI container...${NC}"
docker-compose up -d cli
sleep 3

# Orderer TLS paths (using fabric-tools container to run osnadmin)
ORDERER_TLS_DIR=/fabric-network/organizations/ordererOrganizations/orderer.example.com/orderers

# Create channel using osnadmin on orderer1
echo -e "${BLUE}Creating channel using osnadmin on orderer1...${NC}"
docker run --rm \
    --network delivery-network \
    -v $(pwd)/fabric-network:/fabric-network \
    hyperledger/fabric-tools:2.5 \
    osnadmin channel join \
    --channelID ${CHANNEL_NAME} \
    --config-block /fabric-network/channel-artifacts/${CHANNEL_NAME}.block \
    -o orderer1.orderer.example.com:7053 \
    --ca-file ${ORDERER_TLS_DIR}/orderer1.orderer.example.com/tls/ca.crt \
    --client-cert ${ORDERER_TLS_DIR}/orderer1.orderer.example.com/tls/server.crt \
    --client-key ${ORDERER_TLS_DIR}/orderer1.orderer.example.com/tls/server.key

echo -e "${GREEN}✓ Orderer1 joined channel${NC}"

# Join orderer2 to channel
echo -e "${BLUE}Joining orderer2 to channel...${NC}"
docker run --rm \
    --network delivery-network \
    -v $(pwd)/fabric-network:/fabric-network \
    hyperledger/fabric-tools:2.5 \
    osnadmin channel join \
    --channelID ${CHANNEL_NAME} \
    --config-block /fabric-network/channel-artifacts/${CHANNEL_NAME}.block \
    -o orderer2.orderer.example.com:7053 \
    --ca-file ${ORDERER_TLS_DIR}/orderer2.orderer.example.com/tls/ca.crt \
    --client-cert ${ORDERER_TLS_DIR}/orderer2.orderer.example.com/tls/server.crt \
    --client-key ${ORDERER_TLS_DIR}/orderer2.orderer.example.com/tls/server.key

echo -e "${GREEN}✓ Orderer2 joined channel${NC}"

# Join orderer3 to channel
echo -e "${BLUE}Joining orderer3 to channel...${NC}"
docker run --rm \
    --network delivery-network \
    -v $(pwd)/fabric-network:/fabric-network \
    hyperledger/fabric-tools:2.5 \
    osnadmin channel join \
    --channelID ${CHANNEL_NAME} \
    --config-block /fabric-network/channel-artifacts/${CHANNEL_NAME}.block \
    -o orderer3.orderer.example.com:7053 \
    --ca-file ${ORDERER_TLS_DIR}/orderer3.orderer.example.com/tls/ca.crt \
    --client-cert ${ORDERER_TLS_DIR}/orderer3.orderer.example.com/tls/server.crt \
    --client-key ${ORDERER_TLS_DIR}/orderer3.orderer.example.com/tls/server.key

echo -e "${GREEN}✓ Orderer3 joined channel${NC}"

# Wait for Raft leader election
echo -e "${YELLOW}Waiting for Raft leader election...${NC}"
sleep 5

# TLS CA for peer operations  
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/orderer.example.com/orderers/orderer1.orderer.example.com/tls/ca.crt

# Join PlatformOrg peer to channel
echo -e "${BLUE}Joining PlatformOrg peer to channel...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=PlatformOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.platform.example.com:7051 \
    cli peer channel join \
    -b ./channel-artifacts/${CHANNEL_NAME}.block

echo -e "${GREEN}✓ PlatformOrg peer joined channel${NC}"

# Join SellersOrg peer to channel
echo -e "${BLUE}Joining SellersOrg peer to channel...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=SellersOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/sellers.example.com/peers/peer0.sellers.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/sellers.example.com/users/Admin@sellers.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.sellers.example.com:8051 \
    cli peer channel join \
    -b ./channel-artifacts/${CHANNEL_NAME}.block

echo -e "${GREEN}✓ SellersOrg peer joined channel${NC}"

# Join LogisticsOrg peer to channel
echo -e "${BLUE}Joining LogisticsOrg peer to channel...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=LogisticsOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/logistics.example.com/peers/peer0.logistics.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/logistics.example.com/users/Admin@logistics.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.logistics.example.com:9051 \
    cli peer channel join \
    -b ./channel-artifacts/${CHANNEL_NAME}.block

echo -e "${GREEN}✓ LogisticsOrg peer joined channel${NC}"

# Anchor peers are already configured in the channel block via configtx.yaml AnchorPeers
echo -e "${GREEN}✓ Anchor peers configured in channel genesis block${NC}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Multi-Org Network started successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Network Topology:${NC}"
echo -e "  Orderers (Raft):"
echo -e "    - orderer1.orderer.example.com:7050"
echo -e "    - orderer2.orderer.example.com:7050"
echo -e "    - orderer3.orderer.example.com:7050"
echo ""
echo -e "  PlatformOrg (admins, customers):"
echo -e "    - peer0.platform.example.com:7051"
echo -e "    - ca.platform.example.com:7054"
echo ""
echo -e "  SellersOrg (sellers):"
echo -e "    - peer0.sellers.example.com:8051"
echo -e "    - ca.sellers.example.com:8054"
echo ""
echo -e "  LogisticsOrg (delivery persons):"
echo -e "    - peer0.logistics.example.com:9051"
echo -e "    - ca.logistics.example.com:9054"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Deploy chaincode: ${GREEN}./fabric-network/scripts/deploy-chaincode.sh${NC}"
echo -e "  2. Start CAs: ${GREEN}docker-compose up -d ca.platform.example.com ca.sellers.example.com ca.logistics.example.com${NC}"
echo -e "  3. Start API & MongoDB: ${GREEN}docker-compose up -d mongodb api${NC}"
