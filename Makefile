.PHONY: help start-network deploy-chaincode start-api stop clean restart logs test init-ledger status

# Colors for output
GREEN  := \033[0;32m
YELLOW := \033[1;33m
RED    := \033[0;31m
NC     := \033[0m # No Color

help: ## Show this help message
	@printf "$(GREEN)========================================$(NC)\n"
	@printf "$(GREEN)Package Delivery Tracking System$(NC)\n"
	@printf "$(GREEN)========================================$(NC)\n\n"
	@printf "Available commands:\n\n"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@printf "\n"

start-network: ## Start the Hyperledger Fabric network
	@printf "$(GREEN)Starting Fabric network...$(NC)\n"
	@./fabric-network/scripts/start-network.sh

deploy-chaincode: ## Deploy the delivery chaincode
	@printf "$(GREEN)Deploying chaincode...$(NC)\n"
	@./fabric-network/scripts/deploy-chaincode.sh

start-api: ## Start the FastAPI service
	@printf "$(GREEN)Starting API service...$(NC)\n"
	@docker-compose up -d api
	@printf "$(GREEN)API is running at http://localhost:8000$(NC)\n"
	@printf "$(YELLOW)API Documentation: http://localhost:8000/docs$(NC)\n"

start: start-network deploy-chaincode start-api ## Start the entire system (network + chaincode + API)
	@printf "\n"
	@printf "$(GREEN)========================================$(NC)\n"
	@printf "$(GREEN)System started successfully!$(NC)\n"
	@printf "$(GREEN)========================================$(NC)\n"
	@printf "$(YELLOW)API: http://localhost:8000$(NC)\n"
	@printf "$(YELLOW)Docs: http://localhost:8000/docs$(NC)\n"

stop: ## Stop all services
	@printf "$(YELLOW)Stopping all services...$(NC)\n"
	@docker-compose down

clean: ## Stop services and clean up all data
	@printf "$(RED)Cleaning up...$(NC)\n"
	@./fabric-network/scripts/cleanup.sh

restart: stop start ## Restart the entire system

logs: ## View logs from all containers
	@docker-compose logs -f

logs-api: ## View API logs only
	@docker-compose logs -f api

logs-peer: ## View peer logs only
	@docker-compose logs -f peer0.delivery.example.com

logs-orderer: ## View orderer logs only
	@docker-compose logs -f orderer.example.com

status: ## Show status of all containers
	@printf "$(GREEN)Container Status:$(NC)\n"
	@docker-compose ps
	@printf "\n"
	@printf "$(GREEN)Docker Resources:$(NC)\n"
	@docker stats --no-stream

init-ledger: ## Initialize the ledger (no sample data in new structure)
	@printf "$(YELLOW)Note: The new chaincode does not include InitLedger with sample data.$(NC)\n"
	@printf "$(YELLOW)Use the API to create users, shop items, and orders.$(NC)\n"

health: ## Check system health
	@printf "$(GREEN)Checking system health...$(NC)\n"
	@curl -s http://localhost:8000/health | jq .
	@printf "\n"

list-orders: ## List all orders (requires auth token)
	@printf "$(GREEN)To list orders, use:$(NC)\n"
	@printf "curl -H 'Authorization: Bearer <token>' http://localhost:8000/api/v1/orders\n"

list-deliveries: ## List all deliveries (requires auth token)
	@printf "$(GREEN)To list deliveries, use:$(NC)\n"
	@printf "curl -H 'Authorization: Bearer <token>' http://localhost:8000/api/v1/deliveries\n"

backup: ## Backup blockchain data
	@printf "$(YELLOW)Creating backup...$(NC)\n"
	@mkdir -p backup
	@docker run --rm \
		-v tracking_peer0.delivery.example.com:/data \
		-v $(PWD)/backup:/backup \
		alpine tar czf /backup/peer-data-$$(date +%Y%m%d-%H%M%S).tar.gz /data
	@printf "$(GREEN)Backup created in ./backup/$(NC)\n"

install-deps: ## Install development dependencies (if needed)
	@printf "$(YELLOW)Checking Docker installation...$(NC)\n"
	@docker --version
	@docker-compose --version
	@printf "$(GREEN)All dependencies are installed!$(NC)\n"

build-api: ## Rebuild the API container
	@printf "$(YELLOW)Building API container...$(NC)\n"
	@docker-compose build api

shell-cli: ## Open a shell in the CLI container
	@docker exec -it cli bash

shell-api: ## Open a shell in the API container
	@docker exec -it delivery-api bash

examples: ## Show API usage examples
	@./api/examples.sh

docs: ## Open API documentation in browser
	@printf "$(GREEN)Opening API documentation...$(NC)\n"
	@xdg-open http://localhost:8000/docs 2>/dev/null || open http://localhost:8000/docs 2>/dev/null || printf "Please open http://localhost:8000/docs in your browser\n"

network-info: ## Display network information
	@printf "$(GREEN)Network Information:$(NC)\n"
	@printf "Channel: $$(grep CHANNEL_NAME .env | cut -d '=' -f2)\n"
	@printf "Chaincode: $$(grep CHAINCODE_NAME .env | cut -d '=' -f2)\n"
	@printf "Organization: $$(grep ORG_NAME .env | cut -d '=' -f2)\n"
	@printf "API Port: $$(grep API_PORT .env | cut -d '=' -f2)\n"
	@printf "\n"
	@printf "$(GREEN)Endpoints:$(NC)\n"
	@printf "API: http://localhost:8000\n"
	@printf "Swagger UI: http://localhost:8000/docs\n"
	@printf "ReDoc: http://localhost:8000/redoc\n"
