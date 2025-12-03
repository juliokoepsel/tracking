package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hyperledger/fabric-chaincode-go/pkg/cid"
	"github.com/hyperledger/fabric-chaincode-go/pkg/statebased"
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
	StatusPendingPickupHandoff        DeliveryStatus = "PENDING_PICKUP_HANDOFF"
	StatusDisputedPickupHandoff       DeliveryStatus = "DISPUTED_PICKUP_HANDOFF"
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
type Delivery struct {
	DeliveryID           string            `json:"deliveryId"`
	OrderID              string            `json:"orderId"`
	SellerID             string            `json:"sellerId"`
	CustomerID           string            `json:"customerId"`
	PackageWeight        float64           `json:"packageWeight"`
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

// =====================================================
// Private Data Collection Structures
// =====================================================

// DeliveryPrivateDetails stores sensitive delivery information
// Collection: deliveryPrivateDetails (accessible to all orgs)
type DeliveryPrivateDetails struct {
	DeliveryID         string `json:"deliveryId"`
	RecipientName      string `json:"recipientName"`
	DeliveryStreet     string `json:"deliveryStreet"`
	DeliveryApartment  string `json:"deliveryApartment,omitempty"`
	DeliveryPostalCode string `json:"deliveryPostalCode"`
}

// Private Data Collection names
const (
	CollectionDeliveryPrivate = "deliveryPrivateDetails"
)

// CallerIdentity holds the extracted identity from the X.509 certificate
type CallerIdentity struct {
	ID          string   // User ID extracted from CN
	Role        UserRole // Role extracted from OU or attribute
	MSP         string   // MSP ID (organization)
	Affiliation string   // Full affiliation path (e.g., "sellers")
}

// getCallerIdentity extracts the caller's identity from the X.509 certificate
// This is the PROPER way to authenticate in Hyperledger Fabric - no string bypass!
func getCallerIdentity(ctx contractapi.TransactionContextInterface) (*CallerIdentity, error) {
	// Get the client identity from the transaction context
	clientIdentity := ctx.GetClientIdentity()

	// Get the MSP ID (organization)
	mspID, err := clientIdentity.GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("failed to get MSP ID: %v", err)
	}

	// Get the X.509 certificate
	cert, err := clientIdentity.GetX509Certificate()
	if err != nil {
		return nil, fmt.Errorf("failed to get X.509 certificate: %v", err)
	}

	// Extract user ID from Common Name (CN)
	userID := cert.Subject.CommonName
	if userID == "" {
		return nil, fmt.Errorf("certificate does not contain a Common Name (CN)")
	}

	// Extract role from Organizational Unit (OU) or attribute
	var role UserRole
	if len(cert.Subject.OrganizationalUnit) > 0 {
		ouValue := strings.ToUpper(cert.Subject.OrganizationalUnit[0])
		switch ouValue {
		case "CUSTOMER":
			role = RoleCustomer
		case "SELLER":
			role = RoleSeller
		case "DELIVERY_PERSON", "DELIVERYPERSON", "DELIVERY":
			role = RoleDeliveryPerson
		case "ADMIN":
			role = RoleAdmin
		default:
			// OU doesn't match a role, try attribute
			role = ""
		}
	}

	// If OU didn't provide a valid role, check the 'role' attribute
	if role == "" {
		roleAttr, found, err := clientIdentity.GetAttributeValue("role")
		if err != nil || !found {
			return nil, fmt.Errorf("cannot determine role: no valid OU and no role attribute found")
		}
		switch strings.ToUpper(roleAttr) {
		case "CUSTOMER":
			role = RoleCustomer
		case "SELLER":
			role = RoleSeller
		case "DELIVERY_PERSON", "DELIVERYPERSON", "DELIVERY":
			role = RoleDeliveryPerson
		case "ADMIN":
			role = RoleAdmin
		default:
			return nil, fmt.Errorf("invalid role attribute: %s", roleAttr)
		}
	}

	// Build affiliation from Organization field
	affiliation := ""
	if len(cert.Subject.Organization) > 0 {
		affiliation = cert.Subject.Organization[0]
	}

	return &CallerIdentity{
		ID:          userID,
		Role:        role,
		MSP:         mspID,
		Affiliation: affiliation,
	}, nil
}

// ============================================================================
// Input Validation Helpers
// ============================================================================

// ValidationError represents a validation failure
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation failed for %s: %s", e.Field, e.Message)
}

// validateDeliveryID checks if a delivery ID has the correct format (DEL-YYYYMMDD-XXXXXXXX)
func validateDeliveryID(deliveryID string) error {
	if len(deliveryID) == 0 {
		return &ValidationError{Field: "deliveryID", Message: "cannot be empty"}
	}
	if len(deliveryID) > 50 {
		return &ValidationError{Field: "deliveryID", Message: "exceeds maximum length of 50 characters"}
	}
	if !strings.HasPrefix(deliveryID, "DEL-") {
		return &ValidationError{Field: "deliveryID", Message: "must start with 'DEL-' prefix"}
	}
	// Format: DEL-YYYYMMDD-XXXXXXXX (21 chars total)
	if len(deliveryID) != 21 {
		return &ValidationError{Field: "deliveryID", Message: "must be in format DEL-YYYYMMDD-XXXXXXXX"}
	}
	return nil
}

// validateOrderID checks if an order ID is valid
func validateOrderID(orderID string) error {
	if len(orderID) == 0 {
		return &ValidationError{Field: "orderID", Message: "cannot be empty"}
	}
	if len(orderID) > 50 {
		return &ValidationError{Field: "orderID", Message: "exceeds maximum length of 50 characters"}
	}
	return nil
}

// validateUserID checks if a user ID is valid
func validateUserID(userID string, fieldName string) error {
	if len(userID) == 0 {
		return &ValidationError{Field: fieldName, Message: "cannot be empty"}
	}
	if len(userID) > 100 {
		return &ValidationError{Field: fieldName, Message: "exceeds maximum length of 100 characters"}
	}
	return nil
}

// validatePackageWeight checks if package weight is valid
func validatePackageWeight(weight float64) error {
	if weight <= 0 {
		return &ValidationError{Field: "packageWeight", Message: "must be greater than 0"}
	}
	if weight > 10000 { // 10 tons max
		return &ValidationError{Field: "packageWeight", Message: "exceeds maximum of 10000 kg"}
	}
	return nil
}

// validateDimension checks if a package dimension is valid
func validateDimension(value float64, fieldName string) error {
	if value <= 0 {
		return &ValidationError{Field: fieldName, Message: "must be greater than 0"}
	}
	if value > 1000 { // 10 meters max
		return &ValidationError{Field: fieldName, Message: "exceeds maximum of 1000 cm"}
	}
	return nil
}

// validateLocation checks if location fields are valid
func validateLocation(city, state, country string) error {
	if len(city) == 0 {
		return &ValidationError{Field: "city", Message: "cannot be empty"}
	}
	if len(city) > 100 {
		return &ValidationError{Field: "city", Message: "exceeds maximum length of 100 characters"}
	}
	if len(state) == 0 {
		return &ValidationError{Field: "state", Message: "cannot be empty"}
	}
	if len(state) > 100 {
		return &ValidationError{Field: "state", Message: "exceeds maximum length of 100 characters"}
	}
	if len(country) == 0 {
		return &ValidationError{Field: "country", Message: "cannot be empty"}
	}
	if len(country) > 100 {
		return &ValidationError{Field: "country", Message: "exceeds maximum length of 100 characters"}
	}
	return nil
}

// validateReason checks if a dispute reason is valid
func validateReason(reason string) error {
	if len(reason) == 0 {
		return &ValidationError{Field: "reason", Message: "cannot be empty"}
	}
	if len(reason) > 1000 {
		return &ValidationError{Field: "reason", Message: "exceeds maximum length of 1000 characters"}
	}
	return nil
}

// assertAttribute checks if a specific attribute exists with an expected value
func assertAttribute(ctx contractapi.TransactionContextInterface, attrName string, expectedValue string) error {
	err := cid.AssertAttributeValue(ctx.GetStub(), attrName, expectedValue)
	if err != nil {
		return fmt.Errorf("attribute assertion failed: %v", err)
	}
	return nil
}

// validateRole checks if the caller role is allowed for the operation
func validateRole(caller *CallerIdentity, allowedRoles ...UserRole) error {
	for _, allowed := range allowedRoles {
		if caller.Role == allowed {
			return nil
		}
	}
	return fmt.Errorf("role %s is not authorized for this operation", caller.Role)
}

// validateInvolvement checks if the caller is involved in the delivery
func validateInvolvement(delivery *Delivery, caller *CallerIdentity) error {
	// Admin can always read
	if caller.Role == RoleAdmin {
		return nil
	}

	// Check if caller is seller, customer, or current custodian
	if delivery.SellerID == caller.ID ||
		delivery.CustomerID == caller.ID ||
		delivery.CurrentCustodianID == caller.ID {
		return nil
	}

	// Check if caller is involved in pending handoff
	if delivery.PendingHandoff != nil {
		if delivery.PendingHandoff.FromUserID == caller.ID ||
			delivery.PendingHandoff.ToUserID == caller.ID {
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

// ============================================================================
// State-Based Endorsement Policy (Per-Key Endorsement)
// ============================================================================

// MSP ID constants for endorsement policies
const (
	MSPPlatform  = "PlatformOrgMSP"
	MSPSellers   = "SellersOrgMSP"
	MSPLogistics = "LogisticsOrgMSP"
)

// roleToMSP maps user roles to their MSP IDs
var roleToMSP = map[UserRole]string{
	RoleAdmin:          MSPPlatform,
	RoleCustomer:       MSPPlatform,
	RoleSeller:         MSPSellers,
	RoleDeliveryPerson: MSPLogistics,
}

// setDeliveryEndorsementPolicy sets a state-based endorsement policy for a delivery
// The policy requires endorsement from the current custodian's organization
// This ensures that custody changes must be endorsed by the party releasing custody
func setDeliveryEndorsementPolicy(ctx contractapi.TransactionContextInterface, deliveryID string, custodianRole UserRole) error {
	// Get the MSP for the current custodian
	custodianMSP, ok := roleToMSP[custodianRole]
	if !ok {
		return fmt.Errorf("unknown custodian role: %s", custodianRole)
	}

	// Create a state-based endorsement policy
	// Policy: OR(custodianMSP.member, PlatformMSP.admin)
	// This means: Either the custodian's org endorses, or Platform admin can override
	ep, err := statebased.NewStateEP(nil)
	if err != nil {
		return fmt.Errorf("failed to create state endorsement policy: %v", err)
	}

	// Add the current custodian's org as required endorser
	err = ep.AddOrgs(statebased.RoleTypeMember, custodianMSP)
	if err != nil {
		return fmt.Errorf("failed to add org to endorsement policy: %v", err)
	}

	// Serialize the policy
	policyBytes, err := ep.Policy()
	if err != nil {
		return fmt.Errorf("failed to serialize endorsement policy: %v", err)
	}

	// Set the state validation parameter (endorsement policy) for this key
	err = ctx.GetStub().SetStateValidationParameter(deliveryID, policyBytes)
	if err != nil {
		return fmt.Errorf("failed to set state validation parameter: %v", err)
	}

	return nil
}

// ============================================================================
// Composite Key Index Management
// ============================================================================

// Composite key prefixes for efficient queries
const (
	IndexSellerDelivery    = "seller~deliveryId"
	IndexCustomerDelivery  = "customer~deliveryId"
	IndexCustodianDelivery = "custodian~deliveryId"
	IndexStatusDelivery    = "status~deliveryId"
	IndexOrderDelivery     = "order~deliveryId"
)

// createDeliveryIndexes creates all composite key indexes for a delivery
func createDeliveryIndexes(ctx contractapi.TransactionContextInterface, delivery *Delivery) error {
	stub := ctx.GetStub()

	// Index by seller
	sellerKey, err := stub.CreateCompositeKey(IndexSellerDelivery, []string{delivery.SellerID, delivery.DeliveryID})
	if err != nil {
		return fmt.Errorf("failed to create seller composite key: %v", err)
	}
	if err := stub.PutState(sellerKey, []byte{0x00}); err != nil {
		return fmt.Errorf("failed to put seller index: %v", err)
	}

	// Index by customer
	customerKey, err := stub.CreateCompositeKey(IndexCustomerDelivery, []string{delivery.CustomerID, delivery.DeliveryID})
	if err != nil {
		return fmt.Errorf("failed to create customer composite key: %v", err)
	}
	if err := stub.PutState(customerKey, []byte{0x00}); err != nil {
		return fmt.Errorf("failed to put customer index: %v", err)
	}

	// Index by current custodian
	custodianKey, err := stub.CreateCompositeKey(IndexCustodianDelivery, []string{delivery.CurrentCustodianID, delivery.DeliveryID})
	if err != nil {
		return fmt.Errorf("failed to create custodian composite key: %v", err)
	}
	if err := stub.PutState(custodianKey, []byte{0x00}); err != nil {
		return fmt.Errorf("failed to put custodian index: %v", err)
	}

	// Index by status
	statusKey, err := stub.CreateCompositeKey(IndexStatusDelivery, []string{string(delivery.DeliveryStatus), delivery.DeliveryID})
	if err != nil {
		return fmt.Errorf("failed to create status composite key: %v", err)
	}
	if err := stub.PutState(statusKey, []byte{0x00}); err != nil {
		return fmt.Errorf("failed to put status index: %v", err)
	}

	// Index by order
	orderKey, err := stub.CreateCompositeKey(IndexOrderDelivery, []string{delivery.OrderID, delivery.DeliveryID})
	if err != nil {
		return fmt.Errorf("failed to create order composite key: %v", err)
	}
	if err := stub.PutState(orderKey, []byte{0x00}); err != nil {
		return fmt.Errorf("failed to put order index: %v", err)
	}

	return nil
}

// updateCustodianIndex updates the custodian index when custody changes
func updateCustodianIndex(ctx contractapi.TransactionContextInterface, delivery *Delivery, oldCustodianID, newCustodianID string) error {
	stub := ctx.GetStub()

	// Delete old custodian index
	oldKey, err := stub.CreateCompositeKey(IndexCustodianDelivery, []string{oldCustodianID, delivery.DeliveryID})
	if err != nil {
		return fmt.Errorf("failed to create old custodian composite key: %v", err)
	}
	if err := stub.DelState(oldKey); err != nil {
		return fmt.Errorf("failed to delete old custodian index: %v", err)
	}

	// Create new custodian index
	newKey, err := stub.CreateCompositeKey(IndexCustodianDelivery, []string{newCustodianID, delivery.DeliveryID})
	if err != nil {
		return fmt.Errorf("failed to create new custodian composite key: %v", err)
	}
	if err := stub.PutState(newKey, []byte{0x00}); err != nil {
		return fmt.Errorf("failed to put new custodian index: %v", err)
	}

	return nil
}

// updateStatusIndex updates the status index when status changes
func updateStatusIndex(ctx contractapi.TransactionContextInterface, deliveryID string, oldStatus, newStatus DeliveryStatus) error {
	stub := ctx.GetStub()

	// Delete old status index
	oldKey, err := stub.CreateCompositeKey(IndexStatusDelivery, []string{string(oldStatus), deliveryID})
	if err != nil {
		return fmt.Errorf("failed to create old status composite key: %v", err)
	}
	if err := stub.DelState(oldKey); err != nil {
		return fmt.Errorf("failed to delete old status index: %v", err)
	}

	// Create new status index
	newKey, err := stub.CreateCompositeKey(IndexStatusDelivery, []string{string(newStatus), deliveryID})
	if err != nil {
		return fmt.Errorf("failed to create new status composite key: %v", err)
	}
	if err := stub.PutState(newKey, []byte{0x00}); err != nil {
		return fmt.Errorf("failed to put new status index: %v", err)
	}

	return nil
}

// queryByCompositeKey executes a composite key query and returns matching delivery IDs
func queryByCompositeKey(ctx contractapi.TransactionContextInterface, indexName string, attributes []string) ([]string, error) {
	resultsIterator, err := ctx.GetStub().GetStateByPartialCompositeKey(indexName, attributes)
	if err != nil {
		return nil, fmt.Errorf("failed to get state by partial composite key: %v", err)
	}
	defer resultsIterator.Close()

	var deliveryIDs []string
	for resultsIterator.HasNext() {
		responseRange, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate results: %v", err)
		}

		// Extract the delivery ID from the composite key
		_, compositeKeyParts, err := ctx.GetStub().SplitCompositeKey(responseRange.Key)
		if err != nil {
			return nil, fmt.Errorf("failed to split composite key: %v", err)
		}

		// The delivery ID is the last part of the composite key
		if len(compositeKeyParts) >= 2 {
			deliveryIDs = append(deliveryIDs, compositeKeyParts[len(compositeKeyParts)-1])
		}
	}

	return deliveryIDs, nil
}

// InitLedger initializes the ledger (no sample data)
func (c *DeliveryContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	return nil
}

// CreateDelivery creates a new delivery record on the ledger
// Only SELLER can create deliveries (when confirming an order)
// The caller identity is extracted from the X.509 certificate - no parameters needed!
func (c *DeliveryContract) CreateDelivery(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	orderID string,
	customerID string,
	packageWeight float64,
	dimensionLength float64,
	dimensionWidth float64,
	dimensionHeight float64,
	locationCity string,
	locationState string,
	locationCountry string,
) error {
	// ========== INPUT VALIDATION ==========
	if err := validateDeliveryID(deliveryID); err != nil {
		return err
	}
	if err := validateOrderID(orderID); err != nil {
		return err
	}
	if err := validateUserID(customerID, "customerID"); err != nil {
		return err
	}
	if err := validatePackageWeight(packageWeight); err != nil {
		return err
	}
	if err := validateDimension(dimensionLength, "dimensionLength"); err != nil {
		return err
	}
	if err := validateDimension(dimensionWidth, "dimensionWidth"); err != nil {
		return err
	}
	if err := validateDimension(dimensionHeight, "dimensionHeight"); err != nil {
		return err
	}
	if err := validateLocation(locationCity, locationState, locationCountry); err != nil {
		return err
	}

	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role - only SELLER can create deliveries
	if err := validateRole(caller, RoleSeller); err != nil {
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
		SellerID:      caller.ID, // Seller ID comes from the certificate!
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
		CurrentCustodianID:   caller.ID,
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

	// Set state-based endorsement policy
	// The seller's org (SellersOrgMSP) must endorse any state changes
	// This ensures custody changes require the current custodian's endorsement
	if err := setDeliveryEndorsementPolicy(ctx, deliveryID, RoleSeller); err != nil {
		return fmt.Errorf("failed to set endorsement policy: %v", err)
	}

	// Create composite key indexes for efficient queries
	if err := createDeliveryIndexes(ctx, &delivery); err != nil {
		return fmt.Errorf("failed to create delivery indexes: %v", err)
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
// All roles can read deliveries they are involved with; admin can read any
func (c *DeliveryContract) ReadDelivery(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
) (*Delivery, error) {
	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role - all roles can read
	if err := validateRole(caller, RoleSeller, RoleCustomer, RoleDeliveryPerson, RoleAdmin); err != nil {
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
	if err := validateInvolvement(&delivery, caller); err != nil {
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
) error {
	// ========== INPUT VALIDATION ==========
	if err := validateDeliveryID(deliveryID); err != nil {
		return err
	}
	if err := validateLocation(city, state, country); err != nil {
		return err
	}

	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role - only DELIVERY_PERSON can update location
	if err := validateRole(caller, RoleDeliveryPerson); err != nil {
		return err
	}

	delivery, err := c.readDeliveryInternal(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Must be current custodian
	if delivery.CurrentCustodianID != caller.ID {
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
) error {
	// ========== INPUT VALIDATION ==========
	if err := validateDeliveryID(deliveryID); err != nil {
		return err
	}
	if err := validateUserID(toUserID, "toUserID"); err != nil {
		return err
	}

	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate caller role
	if err := validateRole(caller, RoleSeller, RoleDeliveryPerson); err != nil {
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

	// Sellers can only hand off to delivery persons (not directly to customers)
	if caller.Role == RoleSeller && targetRole == RoleCustomer {
		return fmt.Errorf("sellers can only hand off to delivery persons")
	}

	// Verify caller is current custodian
	if delivery.CurrentCustodianID != caller.ID {
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
		FromUserID:  caller.ID,
		FromRole:    caller.Role,
		ToUserID:    toUserID,
		ToRole:      targetRole,
		InitiatedAt: currentTime,
	}

	// Update delivery status based on handoff type
	oldStatus := delivery.DeliveryStatus
	switch targetRole {
	case RoleDeliveryPerson:
		if delivery.DeliveryStatus == StatusPendingPickup {
			delivery.DeliveryStatus = StatusPendingPickupHandoff
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

	// Update status index and emit event if status changed
	if oldStatus != delivery.DeliveryStatus {
		if err := updateStatusIndex(ctx, deliveryID, oldStatus, delivery.DeliveryStatus); err != nil {
			return fmt.Errorf("failed to update status index: %v", err)
		}
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
		"fromUserId": caller.ID,
		"toUserId":   toUserID,
		"timestamp":  currentTime,
	})
}

// ConfirmHandoff confirms a pending custody transfer (receiver confirms)
// DELIVERY_PERSON or CUSTOMER can confirm handoffs
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
) error {
	// ========== INPUT VALIDATION ==========
	if err := validateDeliveryID(deliveryID); err != nil {
		return err
	}
	if err := validateLocation(city, state, country); err != nil {
		return err
	}
	if err := validatePackageWeight(packageWeight); err != nil {
		return err
	}
	if err := validateDimension(dimensionLength, "dimensionLength"); err != nil {
		return err
	}
	if err := validateDimension(dimensionWidth, "dimensionWidth"); err != nil {
		return err
	}
	if err := validateDimension(dimensionHeight, "dimensionHeight"); err != nil {
		return err
	}

	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role
	if err := validateRole(caller, RoleDeliveryPerson, RoleCustomer); err != nil {
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
	if delivery.PendingHandoff.ToUserID != caller.ID {
		return fmt.Errorf("only the intended recipient can confirm the handoff")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)

	// Update custody
	handoff := delivery.PendingHandoff
	oldStatus := delivery.DeliveryStatus
	oldCustodian := delivery.CurrentCustodianID

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

	// Update state-based endorsement policy to reflect new custodian
	// The new custodian's org must endorse any future state changes
	if err := setDeliveryEndorsementPolicy(ctx, deliveryID, delivery.CurrentCustodianRole); err != nil {
		return fmt.Errorf("failed to update endorsement policy: %v", err)
	}

	// Update composite key indexes
	if err := updateCustodianIndex(ctx, delivery, oldCustodian, delivery.CurrentCustodianID); err != nil {
		return fmt.Errorf("failed to update custodian index: %v", err)
	}
	if oldStatus != delivery.DeliveryStatus {
		if err := updateStatusIndex(ctx, deliveryID, oldStatus, delivery.DeliveryStatus); err != nil {
			return fmt.Errorf("failed to update status index: %v", err)
		}
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
) error {
	// ========== INPUT VALIDATION ==========
	if err := validateDeliveryID(deliveryID); err != nil {
		return err
	}
	if err := validateReason(reason); err != nil {
		return err
	}

	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role
	if err := validateRole(caller, RoleDeliveryPerson, RoleCustomer); err != nil {
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
	if delivery.PendingHandoff.ToUserID != caller.ID {
		return fmt.Errorf("only the intended recipient can dispute the handoff")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)
	oldStatus := delivery.DeliveryStatus

	// Clear pending handoff
	delivery.PendingHandoff = nil

	// Update delivery status to disputed
	switch delivery.DeliveryStatus {
	case StatusPendingPickupHandoff:
		delivery.DeliveryStatus = StatusDisputedPickupHandoff
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

	// Update status index
	if err := updateStatusIndex(ctx, deliveryID, oldStatus, delivery.DeliveryStatus); err != nil {
		return fmt.Errorf("failed to update status index: %v", err)
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
		"disputedBy": caller.ID,
		"reason":     reason,
		"timestamp":  currentTime,
	})
}

// CancelHandoff cancels a pending handoff (only initiator can cancel)
// SELLER or DELIVERY_PERSON can cancel their own handoffs
func (c *DeliveryContract) CancelHandoff(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
) error {
	// ========== INPUT VALIDATION ==========
	if err := validateDeliveryID(deliveryID); err != nil {
		return err
	}

	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role
	if err := validateRole(caller, RoleSeller, RoleDeliveryPerson); err != nil {
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
	if delivery.PendingHandoff.FromUserID != caller.ID {
		return fmt.Errorf("only the handoff initiator can cancel it")
	}

	currentTime := time.Now().UTC().Format(time.RFC3339)
	oldStatus := delivery.DeliveryStatus

	// Clear pending handoff
	delivery.PendingHandoff = nil

	// Revert delivery status
	switch delivery.DeliveryStatus {
	case StatusPendingPickupHandoff:
		delivery.DeliveryStatus = StatusPendingPickup
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

	// Update status index and emit event if status changed
	if oldStatus != delivery.DeliveryStatus {
		if err := updateStatusIndex(ctx, deliveryID, oldStatus, delivery.DeliveryStatus); err != nil {
			return fmt.Errorf("failed to update status index: %v", err)
		}
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
) error {
	// ========== INPUT VALIDATION ==========
	if err := validateDeliveryID(deliveryID); err != nil {
		return err
	}

	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role - only CUSTOMER can cancel
	if err := validateRole(caller, RoleCustomer); err != nil {
		return err
	}

	delivery, err := c.readDeliveryInternal(ctx, deliveryID)
	if err != nil {
		return err
	}

	// Verify caller is the customer for this delivery
	if delivery.CustomerID != caller.ID {
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

	// Update status index
	if err := updateStatusIndex(ctx, deliveryID, oldStatus, delivery.DeliveryStatus); err != nil {
		return fmt.Errorf("failed to update status index: %v", err)
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

// QueryDeliveriesByCustodian returns all deliveries where the user is involved
// Uses composite key indexes for efficient O(log n) lookups instead of full table scans
func (c *DeliveryContract) QueryDeliveriesByCustodian(
	ctx contractapi.TransactionContextInterface,
	custodianID string,
) ([]*Delivery, error) {
	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role
	if err := validateRole(caller, RoleSeller, RoleDeliveryPerson, RoleCustomer, RoleAdmin); err != nil {
		return nil, err
	}

	isAdmin := caller.Role == RoleAdmin

	// Non-admin users can only query their own deliveries
	if !isAdmin && custodianID != caller.ID {
		return nil, fmt.Errorf("can only query your own deliveries")
	}

	deliveryMap := make(map[string]*Delivery)

	// Helper function to fetch deliveries by composite key index
	fetchByIndex := func(indexName string, indexKey string) error {
		iterator, err := ctx.GetStub().GetStateByPartialCompositeKey(indexName, []string{indexKey})
		if err != nil {
			return fmt.Errorf("failed to get state by composite key %s: %v", indexName, err)
		}
		defer iterator.Close()

		for iterator.HasNext() {
			response, err := iterator.Next()
			if err != nil {
				return fmt.Errorf("failed to iterate composite key results: %v", err)
			}

			// Extract deliveryID from composite key
			_, compositeKeyParts, err := ctx.GetStub().SplitCompositeKey(response.Key)
			if err != nil {
				return fmt.Errorf("failed to split composite key: %v", err)
			}
			if len(compositeKeyParts) < 2 {
				continue
			}
			deliveryID := compositeKeyParts[1]

			// Skip if already fetched
			if _, exists := deliveryMap[deliveryID]; exists {
				continue
			}

			// Fetch the actual delivery
			deliveryBytes, err := ctx.GetStub().GetState(deliveryID)
			if err != nil {
				return fmt.Errorf("failed to get delivery %s: %v", deliveryID, err)
			}
			if deliveryBytes == nil {
				continue
			}

			var delivery Delivery
			if err := json.Unmarshal(deliveryBytes, &delivery); err != nil {
				continue
			}
			deliveryMap[deliveryID] = &delivery
		}
		return nil
	}

	// Determine which indexes to query based on role
	switch caller.Role {
	case RoleAdmin:
		if custodianID != "" {
			// Admin filtering by specific custodian
			if err := fetchByIndex(IndexCustodianDelivery, custodianID); err != nil {
				return nil, err
			}
		} else {
			// Admin wants all deliveries - fall back to range query
			iterator, err := ctx.GetStub().GetStateByRange("", "")
			if err != nil {
				return nil, fmt.Errorf("failed to get all deliveries: %v", err)
			}
			defer iterator.Close()

			for iterator.HasNext() {
				response, err := iterator.Next()
				if err != nil {
					return nil, fmt.Errorf("failed to iterate results: %v", err)
				}
				// Skip composite key entries (they have null bytes)
				if len(response.Key) > 0 && response.Key[0] == 0x00 {
					continue
				}
				var delivery Delivery
				if err := json.Unmarshal(response.Value, &delivery); err != nil {
					continue
				}
				deliveryMap[delivery.DeliveryID] = &delivery
			}
		}

	case RoleCustomer:
		// Customers see deliveries where they are the customer
		if err := fetchByIndex(IndexCustomerDelivery, caller.ID); err != nil {
			return nil, err
		}

	case RoleSeller:
		// Sellers see deliveries where they are the seller
		if err := fetchByIndex(IndexSellerDelivery, caller.ID); err != nil {
			return nil, err
		}

	case RoleDeliveryPerson:
		// Delivery persons see deliveries where they are current custodian
		if err := fetchByIndex(IndexCustodianDelivery, caller.ID); err != nil {
			return nil, err
		}
		// Also fetch deliveries where they are the pending handoff target
		// Uses CouchDB rich query since we don't have a composite key index for this
		pendingQuery := fmt.Sprintf(`{
			"selector": {
				"pendingHandoff.toUserId": "%s"
			}
		}`, caller.ID)
		pendingIterator, err := ctx.GetStub().GetQueryResult(pendingQuery)
		if err == nil {
			defer pendingIterator.Close()
			for pendingIterator.HasNext() {
				response, err := pendingIterator.Next()
				if err != nil {
					break
				}
				var delivery Delivery
				if err := json.Unmarshal(response.Value, &delivery); err != nil {
					continue
				}
				if delivery.DeliveryID != "" {
					deliveryMap[delivery.DeliveryID] = &delivery
				}
			}
		}
	}

	// Convert map to slice
	deliveries := make([]*Delivery, 0, len(deliveryMap))
	for _, delivery := range deliveryMap {
		deliveries = append(deliveries, delivery)
	}

	return deliveries, nil
}

// QueryDeliveriesByStatus returns deliveries by status for the caller
// Uses composite key index for efficient O(log n) lookups
func (c *DeliveryContract) QueryDeliveriesByStatus(
	ctx contractapi.TransactionContextInterface,
	status string,
) ([]*Delivery, error) {
	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role
	if err := validateRole(caller, RoleSeller, RoleDeliveryPerson, RoleCustomer, RoleAdmin); err != nil {
		return nil, err
	}

	isAdmin := caller.Role == RoleAdmin

	// Use composite key index for status lookup
	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey(IndexStatusDelivery, []string{status})
	if err != nil {
		return nil, fmt.Errorf("failed to get deliveries by status: %v", err)
	}
	defer iterator.Close()

	var deliveries []*Delivery
	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate status index: %v", err)
		}

		// Extract deliveryID from composite key
		_, compositeKeyParts, err := ctx.GetStub().SplitCompositeKey(response.Key)
		if err != nil {
			return nil, fmt.Errorf("failed to split composite key: %v", err)
		}
		if len(compositeKeyParts) < 2 {
			continue
		}
		deliveryID := compositeKeyParts[1]

		// Fetch the actual delivery
		deliveryBytes, err := ctx.GetStub().GetState(deliveryID)
		if err != nil {
			return nil, fmt.Errorf("failed to get delivery %s: %v", deliveryID, err)
		}
		if deliveryBytes == nil {
			continue
		}

		var delivery Delivery
		if err := json.Unmarshal(deliveryBytes, &delivery); err != nil {
			continue
		}

		// Admin sees all, others must be involved
		if isAdmin {
			deliveries = append(deliveries, &delivery)
		} else if validateInvolvement(&delivery, caller) == nil {
			deliveries = append(deliveries, &delivery)
		}
	}

	return deliveries, nil
}

// GetDeliveryHistory returns the complete history of a delivery
func (c *DeliveryContract) GetDeliveryHistory(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
) ([]map[string]interface{}, error) {
	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role - only seller, customer, and admin can view history
	if err := validateRole(caller, RoleSeller, RoleCustomer, RoleAdmin); err != nil {
		return nil, fmt.Errorf("only seller, customer, or admin can view delivery history")
	}

	// First, read current delivery to check involvement
	delivery, err := c.readDeliveryInternal(ctx, deliveryID)
	if err != nil {
		return nil, err
	}

	// Validate caller is the seller, customer, or admin
	if caller.Role != RoleAdmin {
		if delivery.SellerID != caller.ID && delivery.CustomerID != caller.ID {
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

// QueryDeliveriesRich performs a CouchDB rich query using a selector
// Only available when using CouchDB as the state database
// Admin-only function for advanced queries
func (c *DeliveryContract) QueryDeliveriesRich(
	ctx contractapi.TransactionContextInterface,
	queryString string,
) ([]*Delivery, error) {
	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Rich queries are admin-only due to potential performance impact
	if err := validateRole(caller, RoleAdmin); err != nil {
		return nil, fmt.Errorf("rich queries are admin-only: %v", err)
	}

	// Validate query string is not empty
	if queryString == "" {
		return nil, fmt.Errorf("query string cannot be empty")
	}

	// Execute the rich query
	iterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to execute rich query: %v", err)
	}
	defer iterator.Close()

	var deliveries []*Delivery
	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate query results: %v", err)
		}

		var delivery Delivery
		if err := json.Unmarshal(response.Value, &delivery); err != nil {
			// Skip entries that don't unmarshal to Delivery (like composite key entries)
			continue
		}

		// Basic validation that this is a delivery record
		if delivery.DeliveryID == "" {
			continue
		}

		deliveries = append(deliveries, &delivery)
	}

	return deliveries, nil
}

// QueryDeliveriesByDateRange queries deliveries created within a date range
// Uses CouchDB rich query - requires CouchDB as state database
func (c *DeliveryContract) QueryDeliveriesByDateRange(
	ctx contractapi.TransactionContextInterface,
	startDate string, // ISO 8601 format: "2024-01-01T00:00:00Z"
	endDate string, // ISO 8601 format: "2024-12-31T23:59:59Z"
) ([]*Delivery, error) {
	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Validate role
	if err := validateRole(caller, RoleSeller, RoleDeliveryPerson, RoleCustomer, RoleAdmin); err != nil {
		return nil, err
	}

	// Validate dates
	if startDate == "" || endDate == "" {
		return nil, fmt.Errorf("both startDate and endDate are required")
	}

	// Build CouchDB selector query
	queryString := fmt.Sprintf(`{
		"selector": {
			"createdAt": {
				"$gte": "%s",
				"$lte": "%s"
			},
			"deliveryID": {"$gt": null}
		},
		"sort": [{"createdAt": "desc"}],
		"use_index": ["_design/indexCreatedAtDoc", "indexCreatedAt"]
	}`, startDate, endDate)

	// Execute the query
	iterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to execute date range query: %v", err)
	}
	defer iterator.Close()

	isAdmin := caller.Role == RoleAdmin
	var deliveries []*Delivery

	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate query results: %v", err)
		}

		var delivery Delivery
		if err := json.Unmarshal(response.Value, &delivery); err != nil {
			continue
		}

		// Admin sees all, others must be involved
		if isAdmin {
			deliveries = append(deliveries, &delivery)
		} else if validateInvolvement(&delivery, caller) == nil {
			deliveries = append(deliveries, &delivery)
		}
	}

	return deliveries, nil
}

// QueryDeliveriesByLocation queries deliveries being delivered to a specific city/region
// Uses CouchDB rich query - requires CouchDB as state database
func (c *DeliveryContract) QueryDeliveriesByLocation(
	ctx contractapi.TransactionContextInterface,
	city string,
	state string,
) ([]*Delivery, error) {
	// Extract caller identity from X.509 certificate
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Only admin and delivery persons can query by location
	if err := validateRole(caller, RoleDeliveryPerson, RoleAdmin); err != nil {
		return nil, fmt.Errorf("only delivery persons and admin can query by location")
	}

	// Build selector based on provided filters
	var selectorParts []string
	selectorParts = append(selectorParts, `"deliveryID": {"$gt": null}`)

	if city != "" {
		selectorParts = append(selectorParts, fmt.Sprintf(`"deliveryAddress.city": "%s"`, city))
	}
	if state != "" {
		selectorParts = append(selectorParts, fmt.Sprintf(`"deliveryAddress.state": "%s"`, state))
	}

	if city == "" && state == "" {
		return nil, fmt.Errorf("at least one of city or state is required")
	}

	queryString := fmt.Sprintf(`{
		"selector": {
			%s
		}
	}`, strings.Join(selectorParts, ", "))

	// Execute the query
	iterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to execute location query: %v", err)
	}
	defer iterator.Close()

	isAdmin := caller.Role == RoleAdmin
	var deliveries []*Delivery

	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate query results: %v", err)
		}

		var delivery Delivery
		if err := json.Unmarshal(response.Value, &delivery); err != nil {
			continue
		}

		// Admin sees all, delivery persons see all in their area
		if isAdmin || caller.Role == RoleDeliveryPerson {
			deliveries = append(deliveries, &delivery)
		}
	}

	return deliveries, nil
}

// GetCallerInfo returns the caller's identity information (for debugging/verification)
// This is useful for the API to verify that the identity is being properly extracted
func (c *DeliveryContract) GetCallerInfo(ctx contractapi.TransactionContextInterface) (*CallerIdentity, error) {
	return getCallerIdentity(ctx)
}

// =====================================================
// Private Data Collection Functions
// =====================================================

// SetDeliveryPrivateDetails stores sensitive delivery information in private data collection
// Only accessible by PlatformOrg and SellersOrg members
func (c *DeliveryContract) SetDeliveryPrivateDetails(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
) error {
	// Extract caller identity
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return fmt.Errorf("failed to get caller identity: %v", err)
	}

	// Only PlatformOrg and SellersOrg can set private details
	if caller.MSP != "PlatformOrgMSP" && caller.MSP != "SellersOrgMSP" {
		return fmt.Errorf("only PlatformOrg and SellersOrg can set delivery private details")
	}

	// Verify delivery exists
	deliveryBytes, err := ctx.GetStub().GetState(deliveryID)
	if err != nil {
		return fmt.Errorf("failed to get delivery: %v", err)
	}
	if deliveryBytes == nil {
		return fmt.Errorf("delivery %s does not exist", deliveryID)
	}

	// Get private data from transient map
	transientMap, err := ctx.GetStub().GetTransient()
	if err != nil {
		return fmt.Errorf("failed to get transient data: %v", err)
	}

	privateDataJSON, exists := transientMap["privateDetails"]
	if !exists {
		return fmt.Errorf("privateDetails not found in transient data")
	}

	// Parse and validate the private details
	var privateDetails DeliveryPrivateDetails
	if err := json.Unmarshal(privateDataJSON, &privateDetails); err != nil {
		return fmt.Errorf("failed to parse private details: %v", err)
	}

	// Set the delivery ID
	privateDetails.DeliveryID = deliveryID

	// Store in private data collection
	privateDetailsBytes, err := json.Marshal(privateDetails)
	if err != nil {
		return fmt.Errorf("failed to marshal private details: %v", err)
	}

	if err := ctx.GetStub().PutPrivateData(CollectionDeliveryPrivate, deliveryID, privateDetailsBytes); err != nil {
		return fmt.Errorf("failed to store private details: %v", err)
	}

	return nil
}

// GetDeliveryPrivateDetails retrieves sensitive delivery information from private data collection
func (c *DeliveryContract) GetDeliveryPrivateDetails(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
) (*DeliveryPrivateDetails, error) {
	// Extract caller identity
	caller, err := getCallerIdentity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get caller identity: %v", err)
	}

	// All orgs can read private details (they need delivery address)
	if caller.MSP != "PlatformOrgMSP" && caller.MSP != "SellersOrgMSP" && caller.MSP != "LogisticsOrgMSP" {
		return nil, fmt.Errorf("only PlatformOrg, SellersOrg, and LogisticsOrg can read delivery private details")
	}

	privateDetailsBytes, err := ctx.GetStub().GetPrivateData(CollectionDeliveryPrivate, deliveryID)
	if err != nil {
		return nil, fmt.Errorf("failed to get private details: %v", err)
	}
	if privateDetailsBytes == nil {
		return nil, fmt.Errorf("private details not found for delivery %s", deliveryID)
	}

	var privateDetails DeliveryPrivateDetails
	if err := json.Unmarshal(privateDetailsBytes, &privateDetails); err != nil {
		return nil, fmt.Errorf("failed to parse private details: %v", err)
	}

	return &privateDetails, nil
}

// VerifyDeliveryPrivateDataHash verifies that a hash matches the stored private data
// This allows LogisticsOrg to verify data without seeing the content
func (c *DeliveryContract) VerifyDeliveryPrivateDataHash(
	ctx contractapi.TransactionContextInterface,
	deliveryID string,
	expectedHash string,
) (bool, error) {
	hashBytes, err := ctx.GetStub().GetPrivateDataHash(CollectionDeliveryPrivate, deliveryID)
	if err != nil {
		return false, fmt.Errorf("failed to get private data hash: %v", err)
	}
	if hashBytes == nil {
		return false, fmt.Errorf("no private data found for delivery %s", deliveryID)
	}

	// Compare hashes
	actualHash := fmt.Sprintf("%x", hashBytes)
	return actualHash == expectedHash, nil
}
