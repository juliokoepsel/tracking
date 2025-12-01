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
	Length float64 `json:"length"` // in cm
	Width  float64 `json:"width"`  // in cm
	Height float64 `json:"height"` // in cm
}

// Location represents a simplified location (no PII)
type Location struct {
	City    string `json:"city"`
	State   string `json:"state"`
	Country string `json:"country"`
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

// PendingHandoff tracks a pending custody transfer
type PendingHandoff struct {
	FromUserID  string   `json:"fromUserId"`
	FromRole    UserRole `json:"fromRole"`
	ToUserID    string   `json:"toUserId"`
	ToRole      UserRole `json:"toRole"`
	InitiatedAt string   `json:"initiatedAt"`
}

// Delivery represents a package delivery record on the blockchain
// Simplified structure: no PII, no redundant history (use GetHistoryForKey)
type Delivery struct {
	DeliveryID           string            `json:"deliveryId"`
	OrderID              string            `json:"orderId"`       // Links to MongoDB Order
	SellerID             string            `json:"sellerId"`      // ID of the seller who created the delivery
	CustomerID           string            `json:"customerId"`    // ID of the customer who ordered
	PackageWeight        float64           `json:"packageWeight"` // in kg
	PackageDimensions    PackageDimensions `json:"packageDimensions"`
	DeliveryStatus       DeliveryStatus    `json:"deliveryStatus"`
	LastLocation         Location          `json:"lastLocation"`
	CurrentCustodianID   string            `json:"currentCustodianId"`
	CurrentCustodianRole UserRole          `json:"currentCustodianRole"`
	PendingHandoff       *PendingHandoff   `json:"pendingHandoff,omitempty" metadata:",optional"`
	UpdatedAt            string            `json:"updatedAt"`
}

// Event names for chaincode events
const (
	EventDeliveryCreated       = "DeliveryCreated"
	EventDeliveryStatusChanged = "DeliveryStatusChanged"
	EventHandoffInitiated      = "HandoffInitiated"
	EventHandoffConfirmed      = "HandoffConfirmed"
	EventHandoffDisputed       = "HandoffDisputed"
)

// DeliveryEvent is emitted when delivery status changes
type DeliveryEvent struct {
	DeliveryID string         `json:"deliveryId"`
	OrderID    string         `json:"orderId"`
	OldStatus  DeliveryStatus `json:"oldStatus,omitempty"`
	NewStatus  DeliveryStatus `json:"newStatus"`
	Timestamp  string         `json:"timestamp"`
}

// validateRole checks if the caller role is allowed for the operation
// ADMIN has NO access to write chaincode operations (except for read operations where explicitly allowed)
func validateRole(callerRole string, allowedRoles ...UserRole) error {
	role := UserRole(callerRole)

	for _, allowed := range allowedRoles {
		if role == allowed {
			return nil
		}
	}

	return fmt.Errorf("role %s is not authorized for this operation", callerRole)
}

// validateInvolvement checks if the caller is involved in the delivery
// A user is involved if they are: seller, customer, current custodian, or part of pending handoff
func validateInvolvement(delivery *Delivery, callerID string, callerRole string) error {
	// Admin can always read
	if UserRole(callerRole) == RoleAdmin {
		return nil
	}

	// Check if caller is seller, customer, or current custodian
	if delivery.SellerID == callerID ||
		delivery.CustomerID == callerID ||
		delivery.CurrentCustodianID == callerID {
		return nil
	}

	// Check if caller is involved in pending handoff
	if delivery.PendingHandoff != nil {
		if delivery.PendingHandoff.FromUserID == callerID ||
			delivery.PendingHandoff.ToUserID == callerID {
			return nil
		}
	}

	return fmt.Errorf("not authorized to access this delivery")
}

// emitEvent emits a chaincode event
func emitEvent(ctx contractapi.TransactionContextInterface, eventName string, payload interface{}) error {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal event payload: %v", err)
	}
	return ctx.GetStub().SetEvent(eventName, payloadBytes)
}

// InitLedger initializes the ledger (no sample data)
func (c *DeliveryContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	// No sample data - deliveries created via API
	return nil
}

// CreateDelivery creates a new delivery record on the ledger
// Only SELLER can create deliveries (when confirming an order)
func (c *DeliveryContract) CreateDelivery(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	orderID string,
	sellerID string,
	customerID string,
	packageWeight float64,
	dimensionLength float64,
	dimensionWidth float64,
	dimensionHeight float64,
	locationCity string,
	locationState string,
	locationCountry string,
	callerID string,
	callerRole string,
) error {
	// Validate role - only SELLER can create deliveries
	if err := validateRole(callerRole, RoleSeller); err != nil {
		return err
	}

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
		DeliveryID:    deliveryID,
		OrderID:       orderID,
		SellerID:      sellerID,
		CustomerID:    customerID,
		PackageWeight: packageWeight,
		PackageDimensions: PackageDimensions{
			Length: dimensionLength,
			Width:  dimensionWidth,
			Height: dimensionHeight,
		},
		DeliveryStatus: StatusPendingPickup,
		LastLocation: Location{
			City:    locationCity,
			State:   locationState,
			Country: locationCountry,
		},
		CurrentCustodianID:   callerID,
		CurrentCustodianRole: RoleSeller,
		UpdatedAt:            currentTime,
	}

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	err = ctx.GetStub().PutState(deliveryID, deliveryJSON)
	if err != nil {
		return fmt.Errorf("failed to put delivery to world state: %v", err)
	}

	// Emit event
	event := DeliveryEvent{
		DeliveryID: deliveryID,
		OrderID:    orderID,
		NewStatus:  StatusPendingPickup,
		Timestamp:  currentTime,
	}
	return emitEvent(ctx, EventDeliveryCreated, event)
}

// ReadDelivery retrieves a delivery from the ledger
// SELLER, CUSTOMER, DELIVERY_PERSON, and ADMIN can read deliveries (if involved, or admin)
func (c *DeliveryContract) ReadDelivery(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	callerID string,
	callerRole string,
) (*Delivery, error) {
	// Validate role - all roles can read (admin included for read operations)
	if err := validateRole(callerRole, RoleSeller, RoleCustomer, RoleDeliveryPerson, RoleAdmin); err != nil {
		return nil, err
	}

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

	// Validate involvement (admin bypasses this check)
	if err := validateInvolvement(&delivery, callerID, callerRole); err != nil {
		return nil, err
	}

	return &delivery, nil
}

// UpdateLocation updates the last known location of a delivery
// Only the current DELIVERY_PERSON custodian can update location
func (c *DeliveryContract) UpdateLocation(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	city string,
	state string,
	country string,
	callerID string,
	callerRole string,
) error {
	// Validate role - only DELIVERY_PERSON can update location
	if err := validateRole(callerRole, RoleDeliveryPerson); err != nil {
		return err
	}

	delivery, err := c.readDeliveryInternal(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Must be current custodian
	if delivery.CurrentCustodianID != callerID {
		return fmt.Errorf("only the current custodian can update location")
	}

	// Must be in transit
	if delivery.DeliveryStatus != StatusInTransit {
		return fmt.Errorf("can only update location when in transit")
	}

	delivery.LastLocation = Location{
		City:    city,
		State:   state,
		Country: country,
	}
	delivery.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	return ctx.GetStub().PutState(deliveryID, deliveryJSON)
}

// InitiateHandoff starts a custody transfer (current custodian initiates)
// SELLER or DELIVERY_PERSON can initiate handoffs
func (c *DeliveryContract) InitiateHandoff(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	toUserID string,
	toRole string,
	callerID string,
	callerRole string,
) error {
	// Validate caller role
	if err := validateRole(callerRole, RoleSeller, RoleDeliveryPerson); err != nil {
		return err
	}

	// Validate target role
	targetRole := UserRole(toRole)
	if targetRole != RoleDeliveryPerson && targetRole != RoleCustomer {
		return fmt.Errorf("can only hand off to DELIVERY_PERSON or CUSTOMER")
	}

	delivery, err := c.readDeliveryInternal(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Verify caller is current custodian
	if delivery.CurrentCustodianID != callerID {
		return fmt.Errorf("only the current custodian can initiate a handoff")
	}

	// Check if there's already a pending handoff
	if delivery.PendingHandoff != nil {
		return fmt.Errorf("there is already a pending handoff for this delivery")
	}

	// Validate status allows handoff
	validStatuses := map[DeliveryStatus]bool{
		StatusPendingPickup: true,
		StatusInTransit:     true,
	}
	if !validStatuses[delivery.DeliveryStatus] {
		return fmt.Errorf("cannot initiate handoff in current status: %s", delivery.DeliveryStatus)
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)

	// Create pending handoff
	delivery.PendingHandoff = &PendingHandoff{
		FromUserID:  callerID,
		FromRole:    UserRole(callerRole),
		ToUserID:    toUserID,
		ToRole:      targetRole,
		InitiatedAt: currentTime,
	}

	// Update delivery status based on handoff type
	oldStatus := delivery.DeliveryStatus
	switch targetRole {
	case RoleDeliveryPerson:
		if delivery.DeliveryStatus == StatusPendingPickup {
			// Keep as PENDING_PICKUP - driver needs to accept
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

	err = ctx.GetStub().PutState(deliveryID, deliveryJSON)
	if err != nil {
		return err
	}

	// Emit event if status changed
	if oldStatus != delivery.DeliveryStatus {
		event := DeliveryEvent{
			DeliveryID: deliveryID,
			OrderID:    delivery.OrderID,
			OldStatus:  oldStatus,
			NewStatus:  delivery.DeliveryStatus,
			Timestamp:  currentTime,
		}
		return emitEvent(ctx, EventDeliveryStatusChanged, event)
	}

	// Emit handoff initiated event
	return emitEvent(ctx, EventHandoffInitiated, map[string]string{
		"deliveryId": deliveryID,
		"fromUserId": callerID,
		"toUserId":   toUserID,
		"timestamp":  currentTime,
	})
}

// ConfirmHandoff confirms a pending custody transfer (receiver confirms)
// DELIVERY_PERSON or CUSTOMER can confirm handoffs
// Location and package dimensions are required for tracking
func (c *DeliveryContract) ConfirmHandoff(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	city string,
	state string,
	country string,
	packageWeight float64,
	dimensionLength float64,
	dimensionWidth float64,
	dimensionHeight float64,
	callerID string,
	callerRole string,
) error {
	// Validate role
	if err := validateRole(callerRole, RoleDeliveryPerson, RoleCustomer); err != nil {
		return err
	}

	delivery, err := c.readDeliveryInternal(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Verify there's a pending handoff
	if delivery.PendingHandoff == nil {
		return fmt.Errorf("no pending handoff for this delivery")
	}

	// Verify caller is the intended recipient
	if delivery.PendingHandoff.ToUserID != callerID {
		return fmt.Errorf("only the intended recipient can confirm the handoff")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)

	// Update custody
	handoff := delivery.PendingHandoff
	oldStatus := delivery.DeliveryStatus

	delivery.CurrentCustodianID = handoff.ToUserID
	delivery.CurrentCustodianRole = handoff.ToRole

	// Clear pending handoff
	delivery.PendingHandoff = nil

	// Update location
	delivery.LastLocation = Location{
		City:    city,
		State:   state,
		Country: country,
	}

	// Update package dimensions and weight
	delivery.PackageWeight = packageWeight
	delivery.PackageDimensions = PackageDimensions{
		Length: dimensionLength,
		Width:  dimensionWidth,
		Height: dimensionHeight,
	}

	// Update delivery status based on new holder
	switch handoff.ToRole {
	case RoleDeliveryPerson:
		delivery.DeliveryStatus = StatusInTransit
	case RoleCustomer:
		delivery.DeliveryStatus = StatusConfirmedDelivery
	}

	delivery.UpdatedAt = currentTime

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	err = ctx.GetStub().PutState(deliveryID, deliveryJSON)
	if err != nil {
		return err
	}

	// Emit status change event
	event := DeliveryEvent{
		DeliveryID: deliveryID,
		OrderID:    delivery.OrderID,
		OldStatus:  oldStatus,
		NewStatus:  delivery.DeliveryStatus,
		Timestamp:  currentTime,
	}
	return emitEvent(ctx, EventDeliveryStatusChanged, event)
}

// DisputeHandoff disputes a pending custody transfer
// The intended recipient (DELIVERY_PERSON or CUSTOMER) can dispute
func (c *DeliveryContract) DisputeHandoff(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	reason string,
	callerID string,
	callerRole string,
) error {
	// Validate role
	if err := validateRole(callerRole, RoleDeliveryPerson, RoleCustomer); err != nil {
		return err
	}

	delivery, err := c.readDeliveryInternal(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Verify there's a pending handoff
	if delivery.PendingHandoff == nil {
		return fmt.Errorf("no pending handoff for this delivery")
	}

	// Verify caller is the intended recipient
	if delivery.PendingHandoff.ToUserID != callerID {
		return fmt.Errorf("only the intended recipient can dispute the handoff")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)
	oldStatus := delivery.DeliveryStatus

	// Clear pending handoff
	delivery.PendingHandoff = nil

	// Update delivery status to disputed
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

	err = ctx.GetStub().PutState(deliveryID, deliveryJSON)
	if err != nil {
		return err
	}

	// Emit dispute event
	event := DeliveryEvent{
		DeliveryID: deliveryID,
		OrderID:    delivery.OrderID,
		OldStatus:  oldStatus,
		NewStatus:  delivery.DeliveryStatus,
		Timestamp:  currentTime,
	}
	if err := emitEvent(ctx, EventDeliveryStatusChanged, event); err != nil {
		return err
	}

	return emitEvent(ctx, EventHandoffDisputed, map[string]string{
		"deliveryId": deliveryID,
		"disputedBy": callerID,
		"reason":     reason,
		"timestamp":  currentTime,
	})
}

// CancelHandoff cancels a pending handoff (only initiator can cancel)
// SELLER or DELIVERY_PERSON can cancel their own handoffs
func (c *DeliveryContract) CancelHandoff(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	callerID string,
	callerRole string,
) error {
	// Validate role
	if err := validateRole(callerRole, RoleSeller, RoleDeliveryPerson); err != nil {
		return err
	}

	delivery, err := c.readDeliveryInternal(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Verify there's a pending handoff
	if delivery.PendingHandoff == nil {
		return fmt.Errorf("no pending handoff for this delivery")
	}

	// Verify caller is the initiator
	if delivery.PendingHandoff.FromUserID != callerID {
		return fmt.Errorf("only the handoff initiator can cancel it")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)
	oldStatus := delivery.DeliveryStatus

	// Clear pending handoff
	delivery.PendingHandoff = nil

	// Revert delivery status
	switch delivery.DeliveryStatus {
	case StatusPendingPickup:
		// Keep as PENDING_PICKUP
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

	err = ctx.GetStub().PutState(deliveryID, deliveryJSON)
	if err != nil {
		return err
	}

	// Emit event if status changed
	if oldStatus != delivery.DeliveryStatus {
		event := DeliveryEvent{
			DeliveryID: deliveryID,
			OrderID:    delivery.OrderID,
			OldStatus:  oldStatus,
			NewStatus:  delivery.DeliveryStatus,
			Timestamp:  currentTime,
		}
		return emitEvent(ctx, EventDeliveryStatusChanged, event)
	}

	return nil
}

// CancelDelivery cancels a delivery (only customer can cancel, before pickup)
// Only CUSTOMER can cancel their own delivery
func (c *DeliveryContract) CancelDelivery(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	callerID string,
	callerRole string,
) error {
	// Validate role - only CUSTOMER can cancel
	if err := validateRole(callerRole, RoleCustomer); err != nil {
		return err
	}

	delivery, err := c.readDeliveryInternal(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Verify caller is the customer for this delivery
	if delivery.CustomerID != callerID {
		return fmt.Errorf("only the customer can cancel this delivery")
	}

	// Can only cancel if still pending pickup (not yet picked up)
	if delivery.DeliveryStatus != StatusPendingPickup {
		return fmt.Errorf("delivery can only be cancelled before pickup")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)
	oldStatus := delivery.DeliveryStatus

	delivery.DeliveryStatus = StatusCancelled
	delivery.UpdatedAt = currentTime

	deliveryJSON, err := json.Marshal(delivery)
	if err != nil {
		return fmt.Errorf("failed to marshal delivery: %v", err)
	}

	err = ctx.GetStub().PutState(deliveryID, deliveryJSON)
	if err != nil {
		return err
	}

	// Emit event
	event := DeliveryEvent{
		DeliveryID: deliveryID,
		OrderID:    delivery.OrderID,
		OldStatus:  oldStatus,
		NewStatus:  StatusCancelled,
		Timestamp:  currentTime,
	}
	return emitEvent(ctx, EventDeliveryStatusChanged, event)
}

// QueryDeliveriesByCustodian returns all deliveries held by a specific user
// The caller can only query their own deliveries, or admin sees all
func (c *DeliveryContract) QueryDeliveriesByCustodian(
	ctx contractapi.TransactionContextInterface,
	custodianID string,
	callerID string,
	callerRole string,
) ([]*Delivery, error) {
	// Validate role - include admin for read access
	if err := validateRole(callerRole, RoleSeller, RoleDeliveryPerson, RoleAdmin); err != nil {
		return nil, err
	}

	isAdmin := UserRole(callerRole) == RoleAdmin

	// Non-admin users can only query their own deliveries
	if !isAdmin && custodianID != callerID {
		return nil, fmt.Errorf("can only query your own deliveries")
	}

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

		// Admin sees all deliveries matching custodian, others only see their own
		if isAdmin {
			if delivery.CurrentCustodianID == custodianID {
				deliveries = append(deliveries, &delivery)
			}
		} else {
			// For non-admin, also check involvement
			if delivery.CurrentCustodianID == custodianID {
				if validateInvolvement(&delivery, callerID, callerRole) == nil {
					deliveries = append(deliveries, &delivery)
				}
			}
		}
	}

	return deliveries, nil
}

// QueryDeliveriesByStatus returns deliveries by status for the caller
// Only returns deliveries where caller is involved, or admin sees all
func (c *DeliveryContract) QueryDeliveriesByStatus(
	ctx contractapi.TransactionContextInterface,
	status string,
	callerID string,
	callerRole string,
) ([]*Delivery, error) {
	// Validate role - include admin for read access
	if err := validateRole(callerRole, RoleSeller, RoleDeliveryPerson, RoleCustomer, RoleAdmin); err != nil {
		return nil, err
	}

	isAdmin := UserRole(callerRole) == RoleAdmin

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

		// Filter by status
		if string(delivery.DeliveryStatus) != status {
			continue
		}

		// Admin sees all, others must be involved
		if isAdmin {
			deliveries = append(deliveries, &delivery)
		} else if validateInvolvement(&delivery, callerID, callerRole) == nil {
			deliveries = append(deliveries, &delivery)
		}
	}

	return deliveries, nil
}

// GetDeliveryHistory returns the complete history of a delivery using blockchain's built-in history
// Only SELLER, CUSTOMER, and ADMIN can view the full history
func (c *DeliveryContract) GetDeliveryHistory(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	callerID string,
	callerRole string,
) ([]map[string]interface{}, error) {
	// Validate role - only seller, customer, and admin can view history
	if err := validateRole(callerRole, RoleSeller, RoleCustomer, RoleAdmin); err != nil {
		return nil, fmt.Errorf("only seller, customer, or admin can view delivery history")
	}

	// First, read current delivery to check involvement
	delivery, err := c.readDeliveryInternal(ctx, deliveryID)
	if err != nil {
		return nil, err
	}

	// Validate caller is the seller, customer, or admin
	if UserRole(callerRole) != RoleAdmin {
		if delivery.SellerID != callerID && delivery.CustomerID != callerID {
			return nil, fmt.Errorf("only the seller or customer of this delivery can view its history")
		}
	}

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

		var historyDelivery Delivery
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &historyDelivery)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal delivery: %v", err)
			}
		}

		record := map[string]interface{}{
			"txId":      response.TxId,
			"timestamp": response.Timestamp,
			"isDelete":  response.IsDelete,
			"delivery":  historyDelivery,
		}
		history = append(history, record)
	}

	return history, nil
}

// DeliveryExists checks if a delivery exists in the world state
func (c *DeliveryContract) DeliveryExists(ctx contractapi.TransactionContextInterface, deliveryID string) (bool, error) {
	deliveryJSON, err := ctx.GetStub().GetState(deliveryID)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return deliveryJSON != nil, nil
}

// readDeliveryInternal is an internal helper that doesn't check roles
func (c *DeliveryContract) readDeliveryInternal(ctx contractapi.TransactionContextInterface, deliveryID string) (*Delivery, error) {
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
