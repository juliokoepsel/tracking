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

// Maps user role to Fabric organization
export const RoleToOrgMap: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'PlatformOrg',
  [UserRole.CUSTOMER]: 'PlatformOrg',
  [UserRole.SELLER]: 'SellersOrg',
  [UserRole.DELIVERY_PERSON]: 'LogisticsOrg',
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
  [UserRole.ADMIN]: 'PlatformOrgMSP',
  [UserRole.CUSTOMER]: 'PlatformOrgMSP',
  [UserRole.SELLER]: 'SellersOrgMSP',
  [UserRole.DELIVERY_PERSON]: 'LogisticsOrgMSP',
};
