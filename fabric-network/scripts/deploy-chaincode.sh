#!/bin/bash
#
# Deploy chaincode to the Hyperledger Fabric network
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
echo -e "${GREEN}Deploying Chaincode${NC}"
echo -e "${GREEN}========================================${NC}"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

CHAINCODE_PATH="/opt/gopath/src/github.com/chaincode/delivery"
CHAINCODE_LABEL="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"

# Package chaincode
echo -e "${YELLOW}Packaging chaincode...${NC}"
docker exec cli peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz \
    --path ${CHAINCODE_PATH} \
    --lang golang \
    --label ${CHAINCODE_LABEL}

echo -e "${GREEN}✓ Chaincode packaged${NC}"

# Install chaincode on peer
echo -e "${YELLOW}Installing chaincode on peer...${NC}"
docker exec cli peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz

echo -e "${GREEN}✓ Chaincode installed${NC}"

# TLS CA file path (inside CLI container)
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# Get package ID
echo -e "${YELLOW}Getting package ID...${NC}"
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep ${CHAINCODE_LABEL} | sed 's/^Package ID: //' | sed 's/, Label.*//')
echo -e "${GREEN}Package ID: ${PACKAGE_ID}${NC}"

# Approve chaincode for organization
echo -e "${YELLOW}Approving chaincode for DeliveryOrg...${NC}"
docker exec cli peer lifecycle chaincode approveformyorg \
    -o orderer.example.com:7050 \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --package-id ${PACKAGE_ID} \
    --sequence 1 \
    --tls --cafile ${ORDERER_CA}

echo -e "${GREEN}✓ Chaincode approved${NC}"

# Check commit readiness
echo -e "${YELLOW}Checking commit readiness...${NC}"
docker exec cli peer lifecycle chaincode checkcommitreadiness \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --sequence 1

# Commit chaincode
echo -e "${YELLOW}Committing chaincode...${NC}"
docker exec cli peer lifecycle chaincode commit \
    -o orderer.example.com:7050 \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --sequence 1 \
    --tls --cafile ${ORDERER_CA}

echo -e "${GREEN}✓ Chaincode committed${NC}"

# Wait for chaincode to be ready
sleep 5

# Verify chaincode is committed
echo -e "${YELLOW}Verifying chaincode deployment...${NC}"
docker exec cli peer lifecycle chaincode querycommitted \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Chaincode deployed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}You can now start the API service:${NC}"
echo -e "  ${GREEN}docker-compose up -d api${NC}"
