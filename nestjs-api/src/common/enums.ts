export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  SELLER = 'SELLER',
  DELIVERY_PERSON = 'DELIVERY_PERSON',
  ADMIN = 'ADMIN',
}

export enum DeliveryStatus {
  PENDING_PICKUP = 'PENDING_PICKUP',
  PENDING_PICKUP_HANDOFF = 'PENDING_PICKUP_HANDOFF',
  DISPUTED_PICKUP_HANDOFF = 'DISPUTED_PICKUP_HANDOFF',
  IN_TRANSIT = 'IN_TRANSIT',
  PENDING_TRANSIT_HANDOFF = 'PENDING_TRANSIT_HANDOFF',
  DISPUTED_TRANSIT_HANDOFF = 'DISPUTED_TRANSIT_HANDOFF',
  PENDING_DELIVERY_CONFIRMATION = 'PENDING_DELIVERY_CONFIRMATION',
  CONFIRMED_DELIVERY = 'CONFIRMED_DELIVERY',
  DISPUTED_DELIVERY = 'DISPUTED_DELIVERY',
  CANCELLED = 'CANCELLED',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

// Organization names
export enum FabricOrg {
  PLATFORM = 'PlatformOrg',
  SELLERS = 'SellersOrg',
  LOGISTICS = 'LogisticsOrg',
}

// MSP IDs
export enum FabricMSP {
  PLATFORM = 'PlatformOrgMSP',
  SELLERS = 'SellersOrgMSP',
  LOGISTICS = 'LogisticsOrgMSP',
}

// Maps user role to Fabric organization
// In decentralized mode, this is used to determine which org's API a user should use
export const RoleToOrgMap: Record<UserRole, string> = {
  [UserRole.ADMIN]: FabricOrg.PLATFORM,
  [UserRole.CUSTOMER]: FabricOrg.PLATFORM,
  [UserRole.SELLER]: FabricOrg.SELLERS,
  [UserRole.DELIVERY_PERSON]: FabricOrg.LOGISTICS,
};

// Maps user role to Fabric CA
export const RoleToCAMap: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'ca.platform.example.com',
  [UserRole.CUSTOMER]: 'ca.platform.example.com',
  [UserRole.SELLER]: 'ca.sellers.example.com',
  [UserRole.DELIVERY_PERSON]: 'ca.logistics.example.com',
};

// Maps user role to MSP ID
export const RoleToMSPMap: Record<UserRole, string> = {
  [UserRole.ADMIN]: FabricMSP.PLATFORM,
  [UserRole.CUSTOMER]: FabricMSP.PLATFORM,
  [UserRole.SELLER]: FabricMSP.SELLERS,
  [UserRole.DELIVERY_PERSON]: FabricMSP.LOGISTICS,
};

// Maps org name to MSP ID
export const OrgToMSPMap: Record<string, string> = {
  [FabricOrg.PLATFORM]: FabricMSP.PLATFORM,
  [FabricOrg.SELLERS]: FabricMSP.SELLERS,
  [FabricOrg.LOGISTICS]: FabricMSP.LOGISTICS,
};

// Maps MSP ID to org name
export const MSPToOrgMap: Record<string, string> = {
  [FabricMSP.PLATFORM]: FabricOrg.PLATFORM,
  [FabricMSP.SELLERS]: FabricOrg.SELLERS,
  [FabricMSP.LOGISTICS]: FabricOrg.LOGISTICS,
};

// Roles allowed for each organization
// Used to validate that users are registering with the correct org's API
export const OrgAllowedRoles: Record<string, UserRole[]> = {
  [FabricOrg.PLATFORM]: [UserRole.ADMIN, UserRole.CUSTOMER],
  [FabricOrg.SELLERS]: [UserRole.SELLER],
  [FabricOrg.LOGISTICS]: [UserRole.DELIVERY_PERSON],
};
