#!/bin/bash
#
# Cleanup and stop the Multi-Org Hyperledger Fabric network
#

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to the project root directory
cd "$(dirname "$0")/../.."

echo -e "${RED}========================================${NC}"
echo -e "${RED}Stopping and Cleaning Up Multi-Org Network${NC}"
echo -e "${RED}========================================${NC}"

# Stop all containers
echo -e "${YELLOW}Stopping Docker containers...${NC}"
docker-compose down -v 2>/dev/null || true

# Remove generated artifacts
echo -e "${YELLOW}Removing generated crypto material...${NC}"
sudo rm -rf fabric-network/organizations/peerOrganizations
sudo rm -rf fabric-network/organizations/ordererOrganizations
sudo rm -rf fabric-network/organizations/fabric-ca

echo -e "${YELLOW}Removing TLS certificates...${NC}"
rm -rf certs

echo -e "${YELLOW}Removing channel artifacts...${NC}"
sudo rm -rf fabric-network/channel-artifacts/*.tx
sudo rm -rf fabric-network/channel-artifacts/*.block

echo -e "${YELLOW}Removing genesis block...${NC}"
sudo rm -rf fabric-network/system-genesis-block/*.block

# Remove chaincode packages
echo -e "${YELLOW}Removing chaincode packages...${NC}"
docker exec cli rm -f *.tar.gz 2>/dev/null || true

# Remove orphaned volumes
echo -e "${YELLOW}Removing Docker volumes...${NC}"
docker volume prune -f 2>/dev/null || true

# Remove chaincode images
echo -e "${YELLOW}Removing chaincode Docker images...${NC}"
docker rmi $(docker images | grep dev-peer | awk '{print $3}') 2>/dev/null || true

# Remove any stopped containers
echo -e "${YELLOW}Removing stopped containers...${NC}"
docker container prune -f 2>/dev/null || true

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cleanup completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}To restart the network, run:${NC}"
echo -e "  ${GREEN}./fabric-network/scripts/start-network.sh${NC}"
