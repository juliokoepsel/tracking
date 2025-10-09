#!/bin/bash
#
# Cleanup and stop the Hyperledger Fabric network
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
echo -e "${RED}Stopping and Cleaning Up Network${NC}"
echo -e "${RED}========================================${NC}"

# Stop all containers
echo -e "${YELLOW}Stopping Docker containers...${NC}"
docker-compose down -v

# Remove generated artifacts
echo -e "${YELLOW}Removing generated artifacts...${NC}"
rm -rf fabric-network/organizations/peerOrganizations
rm -rf fabric-network/organizations/ordererOrganizations
rm -rf fabric-network/channel-artifacts/*.tx
rm -rf fabric-network/channel-artifacts/*.block
rm -rf fabric-network/system-genesis-block/*.block

# Remove chaincode packages
echo -e "${YELLOW}Removing chaincode packages...${NC}"
docker exec cli rm -f *.tar.gz 2>/dev/null || true

# Remove orphaned volumes
echo -e "${YELLOW}Removing Docker volumes...${NC}"
docker volume prune -f

# Remove chaincode images
echo -e "${YELLOW}Removing chaincode Docker images...${NC}"
docker rmi $(docker images | grep dev-peer | awk '{print $3}') 2>/dev/null || true

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cleanup completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}To restart the network, run:${NC}"
echo -e "  ${GREEN}./fabric-network/scripts/start-network.sh${NC}"
