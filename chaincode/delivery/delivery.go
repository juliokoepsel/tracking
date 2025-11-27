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

// UserRole represents the role of a user in the system
type UserRole string

const (
	RoleCustomer       UserRole = "CUSTOMER"
	RoleSeller         UserRole = "SELLER"
	RoleDeliveryPerson UserRole = "DELIVERY_PERSON"
	RoleAdmin          UserRole = "ADMIN"
)

// DeliveryStatus represents the current status of a delivery
type DeliveryStatus string

const (
	StatusPendingShipping             DeliveryStatus = "PENDING_SHIPPING"
	StatusPendingPickup               DeliveryStatus = "PENDING_PICKUP"
	StatusDisputedPickup              DeliveryStatus = "DISPUTED_PICKUP"
	StatusInTransit                   DeliveryStatus = "IN_TRANSIT"
	StatusPendingTransitHandoff       DeliveryStatus = "PENDING_TRANSIT_HANDOFF"
	StatusDisputedTransitHandoff      DeliveryStatus = "DISPUTED_TRANSIT_HANDOFF"
	StatusPendingDeliveryConfirmation DeliveryStatus = "PENDING_DELIVERY_CONFIRMATION"
	StatusConfirmedDelivery           DeliveryStatus = "CONFIRMED_DELIVERY"
	StatusDisputedDelivery            DeliveryStatus = "DISPUTED_DELIVERY"
	StatusCancelled                   DeliveryStatus = "CANCELLED"
)

// HandoffRecord represents a custody transfer event
type HandoffRecord struct {
	FromUserID    string   `json:"fromUserId"`
	FromRole      UserRole `json:"fromRole"`
	ToUserID      string   `json:"toUserId"`
	ToRole        UserRole `json:"toRole"`
	Status        string   `json:"status"` // PENDING, CONFIRMED, DISPUTED
	InitiatedAt   string   `json:"initiatedAt"`
	ConfirmedAt   string   `json:"confirmedAt,omitempty"`
	DisputedAt    string   `json:"disputedAt,omitempty"`
	DisputeReason string   `json:"disputeReason,omitempty"`
}

// CustodyInfo tracks current ownership of the package
type CustodyInfo struct {
	CurrentHolderID   string         `json:"currentHolderId"`
	CurrentHolderRole UserRole       `json:"currentHolderRole"`
	SellerID          string         `json:"sellerId"`
	CustomerID        string         `json:"customerId"`
	PendingHandoff    *HandoffRecord `json:"pendingHandoff,omitempty"`
}

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

	// Chain of custody fields
	Custody        CustodyInfo     `json:"custody"`
	HandoffHistory []HandoffRecord `json:"handoffHistory"`
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
			EstimatedDeliveryDate: "2025-12-12T10:00:00Z",
			Custody: CustodyInfo{
				CurrentHolderID:   "system",
				CurrentHolderRole: RoleSeller,
				SellerID:          "system",
				CustomerID:        "system",
			},
			HandoffHistory: []HandoffRecord{},
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
			DeliveryStatus:        StatusPendingShipping,
			CreatedAt:             currentTime,
			UpdatedAt:             currentTime,
			EstimatedDeliveryDate: "2025-12-15T14:00:00Z",
			Custody: CustodyInfo{
				CurrentHolderID:   "system",
				CurrentHolderRole: RoleSeller,
				SellerID:          "system",
				CustomerID:        "system",
			},
			HandoffHistory: []HandoffRecord{},
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
	ownerID string,
	ownerRole string,
) error {
	// Check if delivery already exists
	exists, err := c.DeliveryExists(ctx, deliveryID)
	if err != nil {
		return fmt.Errorf("failed to check if delivery exists: %v", err)
	}
	if exists {
		return fmt.Errorf("delivery %s already exists", deliveryID)
	}

	// Validate owner role - only sellers and admins can create deliveries
	if ownerRole != string(RoleSeller) && ownerRole != string(RoleAdmin) {
		return fmt.Errorf("only sellers and admins can create deliveries")
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
		DeliveryStatus:        StatusPendingShipping,
		CreatedAt:             currentTime,
		UpdatedAt:             currentTime,
		EstimatedDeliveryDate: estimatedDeliveryDate,
		Custody: CustodyInfo{
			CurrentHolderID:   ownerID,
			CurrentHolderRole: UserRole(ownerRole),
			SellerID:          ownerID,
			CustomerID:        "",
		},
		HandoffHistory: []HandoffRecord{},
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

// UpdateDeliveryWithOwnership updates delivery with ownership verification
func (c *DeliveryContract) UpdateDeliveryWithOwnership(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	recipientAddress string,
	deliveryStatus string,
	callerID string,
	callerRole string,
) error {
	delivery, err := c.ReadDelivery(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Ownership enforcement
	if callerRole != string(RoleAdmin) {
		if delivery.Custody.CurrentHolderID != callerID {
			return fmt.Errorf("caller %s is not the current holder of this delivery", callerID)
		}
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

// InitiateHandoff starts a custody transfer (sender initiates)
func (c *DeliveryContract) InitiateHandoff(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	fromUserID string,
	fromRole string,
	toUserID string,
	toRole string,
) error {
	delivery, err := c.ReadDelivery(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Verify caller is current holder
	if delivery.Custody.CurrentHolderID != fromUserID {
		return fmt.Errorf("only the current holder can initiate a handoff")
	}

	// Check if there's already a pending handoff
	if delivery.Custody.PendingHandoff != nil {
		return fmt.Errorf("there is already a pending handoff for this delivery")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)

	// Create pending handoff
	delivery.Custody.PendingHandoff = &HandoffRecord{
		FromUserID:  fromUserID,
		FromRole:    UserRole(fromRole),
		ToUserID:    toUserID,
		ToRole:      UserRole(toRole),
		Status:      "PENDING",
		InitiatedAt: currentTime,
	}

	// Update delivery status based on handoff type
	switch UserRole(toRole) {
	case RoleDeliveryPerson:
		if delivery.DeliveryStatus == StatusPendingShipping {
			delivery.DeliveryStatus = StatusPendingPickup
		} else {
			delivery.DeliveryStatus = StatusPendingTransitHandoff
		}
	case RoleCustomer:
		delivery.DeliveryStatus = StatusPendingDeliveryConfirmation
	}

	delivery.UpdatedAt = currentTime

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	return ctx.GetStub().PutState(deliveryID, deliveryJSON)
}

// ConfirmHandoff confirms a pending custody transfer (receiver confirms)
func (c *DeliveryContract) ConfirmHandoff(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	confirmingUserID string,
) error {
	delivery, err := c.ReadDelivery(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Verify there's a pending handoff
	if delivery.Custody.PendingHandoff == nil {
		return fmt.Errorf("no pending handoff for this delivery")
	}

	// Verify caller is the intended recipient
	if delivery.Custody.PendingHandoff.ToUserID != confirmingUserID {
		return fmt.Errorf("only the intended recipient can confirm the handoff")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)

	// Complete the handoff
	handoff := delivery.Custody.PendingHandoff
	handoff.Status = "CONFIRMED"
	handoff.ConfirmedAt = currentTime

	// Update custody
	delivery.Custody.CurrentHolderID = handoff.ToUserID
	delivery.Custody.CurrentHolderRole = handoff.ToRole

	// Add to history
	delivery.HandoffHistory = append(delivery.HandoffHistory, *handoff)

	// Clear pending handoff
	delivery.Custody.PendingHandoff = nil

	// Update delivery status based on new holder
	switch handoff.ToRole {
	case RoleDeliveryPerson:
		delivery.DeliveryStatus = StatusInTransit
	case RoleCustomer:
		delivery.DeliveryStatus = StatusConfirmedDelivery
		delivery.Custody.CustomerID = handoff.ToUserID
	}

	delivery.UpdatedAt = currentTime

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	return ctx.GetStub().PutState(deliveryID, deliveryJSON)
}

// DisputeHandoff disputes a pending custody transfer
func (c *DeliveryContract) DisputeHandoff(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	disputingUserID string,
	reason string,
) error {
	delivery, err := c.ReadDelivery(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Verify there's a pending handoff
	if delivery.Custody.PendingHandoff == nil {
		return fmt.Errorf("no pending handoff for this delivery")
	}

	// Verify caller is involved in the handoff
	handoff := delivery.Custody.PendingHandoff
	if handoff.FromUserID != disputingUserID && handoff.ToUserID != disputingUserID {
		return fmt.Errorf("only parties involved in the handoff can dispute it")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)

	// Mark as disputed
	handoff.Status = "DISPUTED"
	handoff.DisputedAt = currentTime
	handoff.DisputeReason = reason

	// Add to history
	delivery.HandoffHistory = append(delivery.HandoffHistory, *handoff)

	// Clear pending handoff
	delivery.Custody.PendingHandoff = nil

	// Update delivery status
	switch delivery.DeliveryStatus {
	case StatusPendingPickup:
		delivery.DeliveryStatus = StatusDisputedPickup
	case StatusPendingTransitHandoff:
		delivery.DeliveryStatus = StatusDisputedTransitHandoff
	case StatusPendingDeliveryConfirmation:
		delivery.DeliveryStatus = StatusDisputedDelivery
	}

	delivery.UpdatedAt = currentTime

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	return ctx.GetStub().PutState(deliveryID, deliveryJSON)
}

// CancelHandoff cancels a pending handoff (only initiator can cancel)
func (c *DeliveryContract) CancelHandoff(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	cancellingUserID string,
) error {
	delivery, err := c.ReadDelivery(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Verify there's a pending handoff
	if delivery.Custody.PendingHandoff == nil {
		return fmt.Errorf("no pending handoff for this delivery")
	}

	// Verify caller is the initiator
	if delivery.Custody.PendingHandoff.FromUserID != cancellingUserID {
		return fmt.Errorf("only the handoff initiator can cancel it")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)

	// Clear pending handoff
	delivery.Custody.PendingHandoff = nil

	// Revert delivery status
	switch delivery.DeliveryStatus {
	case StatusPendingPickup:
		delivery.DeliveryStatus = StatusPendingShipping
	case StatusPendingTransitHandoff:
		delivery.DeliveryStatus = StatusInTransit
	case StatusPendingDeliveryConfirmation:
		delivery.DeliveryStatus = StatusInTransit
	}

	delivery.UpdatedAt = currentTime

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	return ctx.GetStub().PutState(deliveryID, deliveryJSON)
}

// DeleteDeliveryWithOwnership cancels a delivery with ownership verification
func (c *DeliveryContract) DeleteDeliveryWithOwnership(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	callerID string,
	callerRole string,
) error {
	delivery, err := c.ReadDelivery(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Only seller (creator) or admin can cancel
	if callerRole != string(RoleAdmin) {
		if delivery.Custody.SellerID != callerID {
			return fmt.Errorf("only the seller or admin can cancel this delivery")
		}
	}

	// Can only cancel if not yet picked up
	if delivery.DeliveryStatus != StatusPendingShipping {
		return fmt.Errorf("delivery can only be cancelled before pickup")
	}

	delivery.DeliveryStatus = StatusCancelled
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
			// Skip non-delivery entries
			continue
		}
		deliveries = append(deliveries, &delivery)
	}

	return deliveries, nil
}

// QueryDeliveriesByHolder returns all deliveries held by a specific user
func (c *DeliveryContract) QueryDeliveriesByHolder(
	ctx contractapi.TransactionContextInterface,
	holderID string,
) ([]*Delivery, error) {
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
			continue
		}

		if delivery.Custody.CurrentHolderID == holderID {
			deliveries = append(deliveries, &delivery)
		}
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
