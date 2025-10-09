package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// DeliveryContract provides functions for managing package deliveries
type DeliveryContract struct {
	contractapi.Contract
}

// PackageDimensions represents the physical dimensions of a package
type PackageDimensions struct {
	Length float64 `json:"length"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// DeliveryStatus represents the current status of a delivery
type DeliveryStatus string

const (
	StatusPending   DeliveryStatus = "PENDING"
	StatusInTransit DeliveryStatus = "IN_TRANSIT"
	StatusDelivered DeliveryStatus = "DELIVERED"
	StatusCanceled  DeliveryStatus = "CANCELED"
)

// Delivery represents a package delivery record
type Delivery struct {
	DeliveryID            string            `json:"deliveryId"`
	SenderName            string            `json:"senderName"`
	SenderAddress         string            `json:"senderAddress"`
	RecipientName         string            `json:"recipientName"`
	RecipientAddress      string            `json:"recipientAddress"`
	PackageWeight         float64           `json:"packageWeight"`
	PackageDimensions     PackageDimensions `json:"packageDimensions"`
	PackageDescription    string            `json:"packageDescription"`
	DeliveryStatus        DeliveryStatus    `json:"deliveryStatus"`
	CreatedAt             string            `json:"createdAt"`
	UpdatedAt             string            `json:"updatedAt"`
	EstimatedDeliveryDate string            `json:"estimatedDeliveryDate"`
}

// InitLedger initializes the ledger with sample delivery data
func (c *DeliveryContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	currentTime := time.Now().UTC().Format(time.RFC3339)

	deliveries := []Delivery{
		{
			DeliveryID:       "DEL001",
			SenderName:       "Alice Johnson",
			SenderAddress:    "123 Sender Street, New York, NY 10001",
			RecipientName:    "Bob Smith",
			RecipientAddress: "456 Recipient Ave, Los Angeles, CA 90001",
			PackageWeight:    2.5,
			PackageDimensions: PackageDimensions{
				Length: 30.0,
				Width:  20.0,
				Height: 15.0,
			},
			PackageDescription:    "Electronics - Laptop",
			DeliveryStatus:        StatusInTransit,
			CreatedAt:             currentTime,
			UpdatedAt:             currentTime,
			EstimatedDeliveryDate: "2025-10-12T10:00:00Z",
		},
		{
			DeliveryID:       "DEL002",
			SenderName:       "Charlie Brown",
			SenderAddress:    "789 Main St, Chicago, IL 60601",
			RecipientName:    "Diana Prince",
			RecipientAddress: "321 Hero Lane, Metropolis, NY 10002",
			PackageWeight:    1.2,
			PackageDimensions: PackageDimensions{
				Length: 25.0,
				Width:  15.0,
				Height: 10.0,
			},
			PackageDescription:    "Books - Collection",
			DeliveryStatus:        StatusPending,
			CreatedAt:             currentTime,
			UpdatedAt:             currentTime,
			EstimatedDeliveryDate: "2025-10-15T14:00:00Z",
		},
	}

	for _, delivery := range deliveries {
		deliveryJSON, err := json.Marshal(delivery)
		if err != nil {
			return fmt.Errorf("failed to marshal delivery: %v", err)
		}

		err = ctx.GetStub().PutState(delivery.DeliveryID, deliveryJSON)
		if err != nil {
			return fmt.Errorf("failed to put delivery to world state: %v", err)
		}
	}

	return nil
}

// CreateDelivery creates a new delivery record on the ledger
func (c *DeliveryContract) CreateDelivery(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	senderName string,
	senderAddress string,
	recipientName string,
	recipientAddress string,
	packageWeight float64,
	dimensionLength float64,
	dimensionWidth float64,
	dimensionHeight float64,
	packageDescription string,
	estimatedDeliveryDate string,
) error {
	// Check if delivery already exists
	exists, err := c.DeliveryExists(ctx, deliveryID)
	if err != nil {
		return fmt.Errorf("failed to check if delivery exists: %v", err)
	}
	if exists {
		return fmt.Errorf("delivery %s already exists", deliveryID)
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)

	delivery := Delivery{
		DeliveryID:       deliveryID,
		SenderName:       senderName,
		SenderAddress:    senderAddress,
		RecipientName:    recipientName,
		RecipientAddress: recipientAddress,
		PackageWeight:    packageWeight,
		PackageDimensions: PackageDimensions{
			Length: dimensionLength,
			Width:  dimensionWidth,
			Height: dimensionHeight,
		},
		PackageDescription:    packageDescription,
		DeliveryStatus:        StatusPending,
		CreatedAt:             currentTime,
		UpdatedAt:             currentTime,
		EstimatedDeliveryDate: estimatedDeliveryDate,
	}

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	return ctx.GetStub().PutState(deliveryID, deliveryJSON)
}

// ReadDelivery retrieves a delivery from the ledger
func (c *DeliveryContract) ReadDelivery(ctx contractapi.TransactionContextInterface, deliveryID string) (*Delivery, error) {
	deliveryJSON, err := ctx.GetStub().GetState(deliveryID)
	if err != nil {
		return nil, fmt.Errorf("failed to read delivery from world state: %v", err)
	}
	if deliveryJSON == nil {
		return nil, fmt.Errorf("delivery %s does not exist", deliveryID)
	}

	var delivery Delivery
	err = json.Unmarshal(deliveryJSON, &delivery)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal delivery: %v", err)
	}

	return &delivery, nil
}

// UpdateDelivery updates an existing delivery on the ledger
func (c *DeliveryContract) UpdateDelivery(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	recipientAddress string,
	deliveryStatus string,
) error {
	delivery, err := c.ReadDelivery(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Update fields
	if recipientAddress != "" {
		delivery.RecipientAddress = recipientAddress
	}
	if deliveryStatus != "" {
		delivery.DeliveryStatus = DeliveryStatus(deliveryStatus)
	}
	delivery.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	return ctx.GetStub().PutState(deliveryID, deliveryJSON)
}

// DeleteDelivery marks a delivery as canceled (soft delete)
func (c *DeliveryContract) DeleteDelivery(ctx contractapi.TransactionContextInterface, deliveryID string) error {
	delivery, err := c.ReadDelivery(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Soft delete by marking as canceled
	delivery.DeliveryStatus = StatusCanceled
	delivery.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	return ctx.GetStub().PutState(deliveryID, deliveryJSON)
}

// QueryAllDeliveries returns all deliveries found in the world state
func (c *DeliveryContract) QueryAllDeliveries(ctx contractapi.TransactionContextInterface) ([]*Delivery, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer resultsIterator.Close()

	var deliveries []*Delivery
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate results: %v", err)
		}

		var delivery Delivery
		err = json.Unmarshal(queryResponse.Value, &delivery)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal delivery: %v", err)
		}
		deliveries = append(deliveries, &delivery)
	}

	return deliveries, nil
}

// DeliveryExists checks if a delivery exists in the world state
func (c *DeliveryContract) DeliveryExists(ctx contractapi.TransactionContextInterface, deliveryID string) (bool, error) {
	deliveryJSON, err := ctx.GetStub().GetState(deliveryID)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return deliveryJSON != nil, nil
}

// GetDeliveryHistory returns the history of a delivery
func (c *DeliveryContract) GetDeliveryHistory(ctx contractapi.TransactionContextInterface, deliveryID string) ([]map[string]interface{}, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(deliveryID)
	if err != nil {
		return nil, fmt.Errorf("failed to get history for delivery: %v", err)
	}
	defer resultsIterator.Close()

	var history []map[string]interface{}
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate history: %v", err)
		}

		var delivery Delivery
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &delivery)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal delivery: %v", err)
			}
		}

		record := map[string]interface{}{
			"txId":      response.TxId,
			"timestamp": response.Timestamp,
			"isDelete":  response.IsDelete,
			"delivery":  delivery,
		}
		history = append(history, record)
	}

	return history, nil
}

// QueryDeliveriesByStatus returns all deliveries with a specific status
// LevelDB-compatible version using GetStateByRange
func (c *DeliveryContract) QueryDeliveriesByStatus(ctx contractapi.TransactionContextInterface, status string) ([]*Delivery, error) {
	// Use GetStateByRange to iterate through all deliveries
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer resultsIterator.Close()

	var deliveries []*Delivery
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate results: %v", err)
		}

		var delivery Delivery
		err = json.Unmarshal(queryResponse.Value, &delivery)
		if err != nil {
			// Skip non-delivery entries
			continue
		}

		// Filter by status
		if string(delivery.DeliveryStatus) == status {
			deliveries = append(deliveries, &delivery)
		}
	}

	return deliveries, nil
}
