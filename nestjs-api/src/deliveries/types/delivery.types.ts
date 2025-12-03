import { DeliveryStatus, UserRole } from '../../common/enums';

export interface PackageDimensions {
  length: number;
  width: number;
  height: number;
}

export interface Location {
  city: string;
  state: string;
  country: string;
}

export interface PendingHandoff {
  fromUserId: string;
  fromRole: UserRole;
  toUserId: string;
  toRole: UserRole;
  initiatedAt: string;
}

export interface Delivery {
  deliveryId: string;
  orderId: string;
  sellerId: string;
  customerId: string;
  packageWeight: number;
  packageDimensions: PackageDimensions;
  deliveryStatus: DeliveryStatus;
  lastLocation: Location;
  currentCustodianId: string;
  currentCustodianRole: UserRole;
  pendingHandoff?: PendingHandoff;
  updatedAt: string;
}

export interface DeliveryHistoryRecord {
  txId: string;
  timestamp: any;
  isDelete: boolean;
  delivery: Delivery;
}
