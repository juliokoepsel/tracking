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

start-api: generate-certs ## Start MongoDB, NestJS API, and UI services (HTTPS)
	@printf "$(GREEN)Starting MongoDB, NestJS API, and UI...$(NC)\n"
	@docker-compose up -d mongodb nestjs-api delivery-ui
	@printf "$(GREEN)API is running at https://localhost:3000$(NC)\n"
	@printf "$(GREEN)UI is running at https://localhost$(NC)\n"

start: start-network deploy-chaincode start-api ## Start the entire system
	@printf "\n"
	@printf "$(GREEN)========================================$(NC)\n"
	@printf "$(GREEN)System started successfully!$(NC)\n"
	@printf "$(GREEN)========================================$(NC)\n"
	@printf "$(YELLOW)UI:  https://localhost$(NC)\n"
	@printf "$(YELLOW)API: https://localhost:3000$(NC)\n"
	@printf "$(YELLOW)Health: https://localhost:3000/api/v1/health$(NC)\n"

stop: ## Stop all services
	@printf "$(YELLOW)Stopping all services...$(NC)\n"
	@docker-compose down

clean: ## Stop services and clean up all data
	@printf "$(RED)Cleaning up...$(NC)\n"
	@./fabric-network/scripts/cleanup.sh

restart: stop start ## Restart the entire system

logs: ## View logs from all containers
	@docker-compose logs -f

logs-api: ## View NestJS API logs
	@docker-compose logs -f nestjs-api

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

health: ## Check API health
	@printf "$(GREEN)Checking API health...$(NC)\n"
	@curl -sk https://localhost:3000/api/v1/health | jq . || echo "API not running"
	@printf "\n"

build-api: ## Rebuild the NestJS API container
	@printf "$(YELLOW)Building NestJS API container...$(NC)\n"
	@docker-compose build nestjs-api

shell-cli: ## Open a shell in the CLI container
	@docker exec -it cli bash

shell-api: ## Open a shell in the NestJS API container
	@docker exec -it delivery-api sh

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
	@printf "$(GREEN)API:$(NC)\n"
	@printf "  https://localhost:3000\n"
	@printf "$(GREEN)UI:$(NC)\n"
	@printf "  https://localhost\n"

dev: ## Run NestJS API in development mode locally
	@printf "$(GREEN)Starting NestJS API in dev mode...$(NC)\n"
	@cd nestjs-api && pnpm run start:dev

