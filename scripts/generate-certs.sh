#!/bin/bash
# Generate TLS certificates for all services using mkcert
# Requires mkcert to be installed: https://github.com/FiloSottile/mkcert

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_ROOT/certs"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Generating TLS Certificates${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo -e "${RED}Error: mkcert is not installed${NC}"
    echo ""
    echo "Install mkcert first:"
    echo "  Ubuntu/Debian: sudo apt install mkcert libnss3-tools"
    echo "  macOS: brew install mkcert"
    echo "  Windows: choco install mkcert"
    echo ""
    echo "Then run: mkcert -install"
    exit 1
fi

# Create certs directory
mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

echo -e "${YELLOW}Installing local CA (if not already done)...${NC}"
mkcert -install

echo ""
echo -e "${YELLOW}Generating nginx certificate...${NC}"
mkcert -cert-file nginx.pem -key-file nginx-key.pem localhost 127.0.0.1 ::1

echo ""
echo -e "${YELLOW}Generating NestJS API certificate...${NC}"
mkcert -cert-file nestjs.pem -key-file nestjs-key.pem localhost 127.0.0.1 ::1 nestjs-api delivery-api

echo ""
echo -e "${YELLOW}Generating MongoDB certificate...${NC}"
mkcert -cert-file mongodb.pem -key-file mongodb-key.pem localhost 127.0.0.1 ::1 mongodb delivery-mongodb

# MongoDB requires cert and key in a single PEM file
echo ""
echo -e "${YELLOW}Creating combined MongoDB PEM file...${NC}"
cat mongodb.pem mongodb-key.pem > mongodb-combined.pem

# Copy CA certificate for clients that need to verify
echo ""
echo -e "${YELLOW}Copying CA certificate...${NC}"
CAROOT=$(mkcert -CAROOT)
cp "$CAROOT/rootCA.pem" "$CERTS_DIR/ca.pem"

# Set permissions - all files readable for Docker containers
chmod 644 *.pem

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Certificates generated successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Generated files in $CERTS_DIR:"
ls -la "$CERTS_DIR"
echo ""
echo -e "${YELLOW}Note: These certificates are for development only.${NC}"
echo -e "${YELLOW}For production, use proper certificates from a CA.${NC}"
