.PHONY: help start-network deploy-chaincode start-api stop clean restart logs status health generate-certs

# Colors for output
GREEN  := \033[0;32m
YELLOW := \033[1;33m
RED    := \033[0;31m
NC     := \033[0m # No Color

help: ## Show this help message
	@printf "$(GREEN)========================================$(NC)\n"
	@printf "$(GREEN)Blockchain Delivery Tracking System$(NC)\n"
	@printf "$(GREEN)Multi-Org Hyperledger Fabric + NestJS$(NC)\n"
	@printf "$(GREEN)========================================$(NC)\n\n"
	@printf "Available commands:\n\n"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@printf "\n"

generate-certs: ## Generate TLS certificates for HTTPS (requires mkcert)
	@printf "$(GREEN)Generating TLS certificates...$(NC)\n"
	@./scripts/generate-certs.sh

start-network: ## Start the multi-org Fabric network (3 orderers, 3 peers, 3 CAs)
	@printf "$(GREEN)Starting Multi-Org Fabric network...$(NC)\n"
	@./fabric-network/scripts/start-network.sh

deploy-chaincode: ## Deploy the delivery chaincode to all organizations
	@printf "$(GREEN)Deploying chaincode...$(NC)\n"
	@./fabric-network/scripts/deploy-chaincode.sh

start-api: generate-certs ## Start MongoDB instances, NestJS APIs (per-org), and UI services
	@printf "$(GREEN)Building and starting per-org MongoDB, NestJS API instances, and UI...$(NC)\n"
	@docker-compose up -d --build --quiet-pull mongodb-platform mongodb-sellers mongodb-logistics api-platform api-sellers api-logistics delivery-ui 2>&1 | grep -v "Running\|Created\|Started\|Healthy" || true
	@printf "$(GREEN)Platform API is running at https://localhost:3001$(NC)\n"
	@printf "$(GREEN)Sellers API is running at https://localhost:3002$(NC)\n"
	@printf "$(GREEN)Logistics API is running at https://localhost:3003$(NC)\n"
	@printf "$(GREEN)UI is running at https://localhost$(NC)\n"

start: start-network deploy-chaincode start-api ## Start the entire system
	@printf "\n"
	@printf "$(GREEN)========================================$(NC)\n"
	@printf "$(GREEN)System started successfully!$(NC)\n"
	@printf "$(GREEN)========================================$(NC)\n"
	@printf "$(YELLOW)UI:  https://localhost$(NC)\n"
	@printf "$(YELLOW)Platform API: https://localhost:3001$(NC)\n"
	@printf "$(YELLOW)Sellers API:  https://localhost:3002$(NC)\n"
	@printf "$(YELLOW)Logistics API: https://localhost:3003$(NC)\n"

stop: ## Stop all services
	@printf "$(YELLOW)Stopping all services...$(NC)\n"
	@docker-compose down

clean: ## Stop services and clean up all data
	@printf "$(RED)Cleaning up...$(NC)\n"
	@./fabric-network/scripts/cleanup.sh

restart: stop start ## Restart the entire system

logs: ## View logs from all containers
	@docker-compose logs -f

logs-api: ## View all NestJS API logs (all orgs)
	@docker-compose logs -f api-platform api-sellers api-logistics

logs-api-platform: ## View Platform API logs
	@docker-compose logs -f api-platform

logs-api-sellers: ## View Sellers API logs
	@docker-compose logs -f api-sellers

logs-api-logistics: ## View Logistics API logs
	@docker-compose logs -f api-logistics

logs-peers: ## View all peer logs
	@docker-compose logs -f peer0.platform.example.com peer0.sellers.example.com peer0.logistics.example.com

logs-orderers: ## View all orderer logs
	@docker-compose logs -f orderer1.orderer.example.com orderer2.orderer.example.com orderer3.orderer.example.com

logs-cas: ## View all Fabric CA logs
	@docker-compose logs -f ca.platform.example.com ca.sellers.example.com ca.logistics.example.com

status: ## Show status of all containers
	@printf "$(GREEN)Container Status:$(NC)\n"
	@docker-compose ps
	@printf "\n"

health: ## Check API health (all orgs)
	@printf "$(GREEN)Checking API health...$(NC)\n"
	@printf "Platform API (3001): " && curl -sk https://localhost:3001/api/v1/health | jq -r '.status // "not running"' || echo "not running"
	@printf "Sellers API (3002):  " && curl -sk https://localhost:3002/api/v1/health | jq -r '.status // "not running"' || echo "not running"
	@printf "Logistics API (3003): " && curl -sk https://localhost:3003/api/v1/health | jq -r '.status // "not running"' || echo "not running"
	@printf "\n"

build-api: ## Rebuild all NestJS API containers
	@printf "$(YELLOW)Building NestJS API containers...$(NC)\n"
	@docker-compose build api-platform api-sellers api-logistics

shell-cli: ## Open a shell in the CLI container
	@docker exec -it cli bash

shell-api: ## Open a shell in the Platform API container
	@docker exec -it api-platform sh

shell-api-sellers: ## Open a shell in the Sellers API container
	@docker exec -it api-sellers sh

shell-api-logistics: ## Open a shell in the Logistics API container
	@docker exec -it api-logistics sh

network-info: ## Display network information
	@printf "$(GREEN)Network Information:$(NC)\n"
	@printf "Channel: $$(grep CHANNEL_NAME .env | cut -d '=' -f2)\n"
	@printf "Chaincode: $$(grep CHAINCODE_NAME .env | cut -d '=' -f2)\n"
	@printf "\n"
	@printf "$(GREEN)Organizations:$(NC)\n"
	@printf "  PlatformOrg  - peer0.platform.example.com:7051  (customers, admins)\n"
	@printf "  SellersOrg   - peer0.sellers.example.com:9051   (sellers)\n"
	@printf "  LogisticsOrg - peer0.logistics.example.com:11051 (drivers)\n"
	@printf "\n"
	@printf "$(GREEN)Orderers (Raft):$(NC)\n"
	@printf "  orderer1.orderer.example.com:7050\n"
	@printf "  orderer2.orderer.example.com:8050\n"
	@printf "  orderer3.orderer.example.com:9050\n"
	@printf "\n"
	@printf "$(GREEN)APIs (per-org):$(NC)\n"
	@printf "  Platform API:  https://localhost:3001\n"
	@printf "  Sellers API:   https://localhost:3002\n"
	@printf "  Logistics API: https://localhost:3003\n"
	@printf "$(GREEN)UI:$(NC)\n"
	@printf "  https://localhost\n"

dev: ## Run NestJS API in development mode locally
	@printf "$(GREEN)Starting NestJS API in dev mode...$(NC)\n"
	@cd nestjs-api && pnpm run start:dev

