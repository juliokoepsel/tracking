import { Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';

export interface FabricIdentity {
  mspId: string;
  certificate: string;
  privateKey: string;
}

export interface ConnectionConfig {
  peerEndpoint: string;
  tlsCertPath: string;
  peerHostAlias: string;
}

export interface CAConfig {
  url: string;
  caName: string;
  tlsCACert: string;
}

export interface EnrollmentResult {
  certificate: string;
  privateKey: string;
}

/**
 * Creates a Fabric Gateway identity from certificate
 */
export function createIdentity(mspId: string, certificate: string): Identity {
  return {
    mspId,
    credentials: Buffer.from(certificate),
  };
}

/**
 * Creates a signer from private key
 */
export function createSigner(privateKeyPem: string): Signer {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}
