package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	deliveryContract := new(DeliveryContract)

	chaincode, err := contractapi.NewChaincode(deliveryContract)
	if err != nil {
		log.Panicf("Error creating delivery chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting delivery chaincode: %v", err)
	}
}
