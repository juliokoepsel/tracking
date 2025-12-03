#!/bin/bash
#
# Deploy chaincode to the Multi-Org Hyperledger Fabric network
# Installs on all 3 org peers, approves by all 3 orgs, commits
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
echo -e "${GREEN}Deploying Chaincode to Multi-Org Network${NC}"
echo -e "${GREEN}========================================${NC}"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

CHAINCODE_NAME=${CHAINCODE_NAME:-delivery}
CHAINCODE_VERSION=${CHAINCODE_VERSION:-1.0}
CHANNEL_NAME=${CHANNEL_NAME:-deliverychannel}
SEQUENCE=${1:-1}

CHAINCODE_PATH="/opt/gopath/src/github.com/chaincode/delivery"
CHAINCODE_LABEL="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"

# Endorsement policy: 2 out of 3 organizations must endorse transactions
# This ensures cross-organization validation for all delivery state changes
# No single organization can forge transactions - requires collusion of at least 2 orgs
# Service discovery is enabled in the gateway to find endorsing peers across organizations
ENDORSEMENT_POLICY="OutOf(2, 'PlatformOrgMSP.member', 'SellersOrgMSP.member', 'LogisticsOrgMSP.member')"

# Private Data Collections config
COLLECTIONS_CONFIG="/opt/gopath/src/github.com/chaincode/delivery/collections_config.json"

# TLS CA file path
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/orderer.example.com/orderers/orderer1.orderer.example.com/msp/tlscacerts/tlsca.orderer.example.com-cert.pem

# Package chaincode (only need to do this once)
echo -e "${YELLOW}Packaging chaincode...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=PlatformOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.platform.example.com:7051 \
    cli peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz \
    --path ${CHAINCODE_PATH} \
    --lang golang \
    --label ${CHAINCODE_LABEL}

echo -e "${GREEN}✓ Chaincode packaged${NC}"

# Install chaincode on PlatformOrg peer
echo -e "${BLUE}Installing chaincode on PlatformOrg peer...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=PlatformOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.platform.example.com:7051 \
    cli peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz

echo -e "${GREEN}✓ Chaincode installed on PlatformOrg${NC}"

# Install chaincode on SellersOrg peer
echo -e "${BLUE}Installing chaincode on SellersOrg peer...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=SellersOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/sellers.example.com/peers/peer0.sellers.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/sellers.example.com/users/Admin@sellers.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.sellers.example.com:8051 \
    cli peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz

echo -e "${GREEN}✓ Chaincode installed on SellersOrg${NC}"

# Install chaincode on LogisticsOrg peer
echo -e "${BLUE}Installing chaincode on LogisticsOrg peer...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=LogisticsOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/logistics.example.com/peers/peer0.logistics.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/logistics.example.com/users/Admin@logistics.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.logistics.example.com:9051 \
    cli peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz

echo -e "${GREEN}✓ Chaincode installed on LogisticsOrg${NC}"

# Get package ID
echo -e "${YELLOW}Getting package ID...${NC}"
PACKAGE_ID=$(docker exec \
    -e CORE_PEER_LOCALMSPID=PlatformOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.platform.example.com:7051 \
    cli peer lifecycle chaincode queryinstalled | grep ${CHAINCODE_LABEL} | sed 's/^Package ID: //' | sed 's/, Label.*//')

echo -e "${GREEN}Package ID: ${PACKAGE_ID}${NC}"

# Approve chaincode for PlatformOrg
echo -e "${BLUE}Approving chaincode for PlatformOrg (with 2-of-3 endorsement policy)...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=PlatformOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.platform.example.com:7051 \
    cli peer lifecycle chaincode approveformyorg \
    -o orderer1.orderer.example.com:7050 \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --package-id ${PACKAGE_ID} \
    --sequence ${SEQUENCE} \
    --signature-policy "${ENDORSEMENT_POLICY}" \
    --collections-config ${COLLECTIONS_CONFIG} \
    --tls --cafile ${ORDERER_CA}

echo -e "${GREEN}✓ Chaincode approved by PlatformOrg${NC}"

# Approve chaincode for SellersOrg
echo -e "${BLUE}Approving chaincode for SellersOrg (with 2-of-3 endorsement policy)...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=SellersOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/sellers.example.com/peers/peer0.sellers.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/sellers.example.com/users/Admin@sellers.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.sellers.example.com:8051 \
    cli peer lifecycle chaincode approveformyorg \
    -o orderer1.orderer.example.com:7050 \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --package-id ${PACKAGE_ID} \
    --sequence ${SEQUENCE} \
    --signature-policy "${ENDORSEMENT_POLICY}" \
    --collections-config ${COLLECTIONS_CONFIG} \
    --tls --cafile ${ORDERER_CA}

echo -e "${GREEN}✓ Chaincode approved by SellersOrg${NC}"

# Approve chaincode for LogisticsOrg
echo -e "${BLUE}Approving chaincode for LogisticsOrg (with 2-of-3 endorsement policy)...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=LogisticsOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/logistics.example.com/peers/peer0.logistics.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/logistics.example.com/users/Admin@logistics.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.logistics.example.com:9051 \
    cli peer lifecycle chaincode approveformyorg \
    -o orderer1.orderer.example.com:7050 \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --package-id ${PACKAGE_ID} \
    --sequence ${SEQUENCE} \
    --signature-policy "${ENDORSEMENT_POLICY}" \
    --collections-config ${COLLECTIONS_CONFIG} \
    --tls --cafile ${ORDERER_CA}

echo -e "${GREEN}✓ Chaincode approved by LogisticsOrg${NC}"

# Check commit readiness
echo -e "${YELLOW}Checking commit readiness...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=PlatformOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.platform.example.com:7051 \
    cli peer lifecycle chaincode checkcommitreadiness \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --sequence ${SEQUENCE} \
    --signature-policy "${ENDORSEMENT_POLICY}" \
    --collections-config ${COLLECTIONS_CONFIG} \
    --output json

# Commit chaincode (requires endorsement from all orgs)
echo -e "${YELLOW}Committing chaincode with 2-of-3 endorsement policy and private data collections...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=PlatformOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.platform.example.com:7051 \
    cli peer lifecycle chaincode commit \
    -o orderer1.orderer.example.com:7050 \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME} \
    --version ${CHAINCODE_VERSION} \
    --sequence ${SEQUENCE} \
    --signature-policy "${ENDORSEMENT_POLICY}" \
    --collections-config ${COLLECTIONS_CONFIG} \
    --tls --cafile ${ORDERER_CA} \
    --peerAddresses peer0.platform.example.com:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt \
    --peerAddresses peer0.sellers.example.com:8051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/sellers.example.com/peers/peer0.sellers.example.com/tls/ca.crt \
    --peerAddresses peer0.logistics.example.com:9051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/logistics.example.com/peers/peer0.logistics.example.com/tls/ca.crt

echo -e "${GREEN}✓ Chaincode committed${NC}"

# Wait for chaincode to be ready
sleep 5

# Verify chaincode is committed
echo -e "${YELLOW}Verifying chaincode deployment...${NC}"
docker exec \
    -e CORE_PEER_LOCALMSPID=PlatformOrgMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/peers/peer0.platform.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/platform.example.com/users/Admin@platform.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.platform.example.com:7051 \
    cli peer lifecycle chaincode querycommitted \
    --channelID ${CHANNEL_NAME} \
    --name ${CHAINCODE_NAME}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Chaincode deployed to all 3 organizations!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Chaincode Info:${NC}"
echo -e "  Name: ${CHAINCODE_NAME}"
echo -e "  Version: ${CHAINCODE_VERSION}"
echo -e "  Sequence: ${SEQUENCE}"
echo -e "  Channel: ${CHANNEL_NAME}"
echo -e "  Endorsement Policy: 2-of-3 orgs"
echo ""
echo -e "${YELLOW}Installed on:${NC}"
echo -e "  ✓ peer0.platform.example.com (PlatformOrg)"
echo -e "  ✓ peer0.sellers.example.com (SellersOrg)"
echo -e "  ✓ peer0.logistics.example.com (LogisticsOrg)"
echo ""
echo -e "${YELLOW}Endorsement Policy:${NC}"
echo -e "  Transactions require endorsement from at least 2 of the 3 organizations."
echo -e "  This ensures cross-organization validation of all delivery state changes."
echo ""
echo -e "${YELLOW}Private Data Collections:${NC}"
echo -e "  • deliveryPrivateDetails: Sensitive address info (all orgs)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Start Fabric CAs: ${GREEN}docker-compose up -d ca.platform.example.com ca.sellers.example.com ca.logistics.example.com${NC}"
echo -e "  2. Start MongoDB & API: ${GREEN}docker-compose up -d mongodb api${NC}"
echo ""
echo -e "${YELLOW}To upgrade chaincode later:${NC}"
echo -e "  ${GREEN}./fabric-network/scripts/deploy-chaincode.sh <new_sequence>${NC}"
