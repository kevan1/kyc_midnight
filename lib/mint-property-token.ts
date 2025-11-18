/**
 * Mint property tokens using Mesh SDK and Lace wallet
 * Integrates with the existing Lace wallet connection
 */

import { Transaction } from '@meshsdk/core';
import { connectLaceWallet as connectWallet, LaceWalletSession, getCachedSession } from './lace-wallet';
import * as fs from 'fs';
import * as path from 'path';

// Load configurations
const getConfigPath = (relativePath: string) => {
  // Try multiple possible locations
  const possiblePaths = [
    path.join(process.cwd(), 'contracts', 'real_estate_tokenization', relativePath),
    path.join(process.cwd(), '..', 'asset_tokenization', 'contracts', 'real_estate_tokenization', relativePath),
    path.join(process.cwd(), 'asset_tokenization', 'contracts', 'real_estate_tokenization', relativePath),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  throw new Error(`Configuration file not found: ${relativePath}`);
};

const propertyTokensPath = getConfigPath('deployment/property_tokens.json');
const propertyTokens = JSON.parse(fs.readFileSync(propertyTokensPath, 'utf-8'));

const redeemerPath = getConfigPath('deployment/redeemers/mint-initial.json');
const redeemerData = JSON.parse(fs.readFileSync(redeemerPath, 'utf-8'));

interface PropertyToken {
  property_id: string;
  policy_id: string;
  asset_name_hex: string;
  name: string;
  [key: string]: any;
}

/**
 * Create Mesh-compatible wallet adapter from Lace session
 */
function createMeshWalletAdapter(laceSession: LaceWalletSession) {
  return {
    getChangeAddress: async () => laceSession.address,
    getUtxos: async () => {
      // Lace wallet UTxO format - convert if needed
      // For now, return empty array - will be populated by wallet
      try {
        // Try to get UTxOs from Lace API if available
        if (laceSession.api.getUtxos) {
          return await laceSession.api.getUtxos();
        }
        // Fallback: return empty array (Mesh will fetch from provider)
        return [];
      } catch (error) {
        console.warn('Could not fetch UTxOs from Lace, using empty array');
        return [];
      }
    },
    getNetworkId: async () => laceSession.networkId,
    signTx: async (tx: string) => {
      // Sign transaction using Lace API
      if (laceSession.api.signTx) {
        return await laceSession.api.signTx(tx);
      }
      throw new Error('Lace API does not support signTx');
    },
    submitTx: async (tx: string) => {
      // Submit transaction using Lace API
      if (laceSession.api.submitTransaction) {
        return await laceSession.api.submitTransaction(tx);
      }
      throw new Error('Lace API does not support submitTransaction');
    },
  };
}

/**
 * Build mint transaction using Mesh SDK
 */
export async function buildMintTransaction(
  propertyId: string,
  laceSession?: LaceWalletSession
): Promise<{
  unsignedTx: string;
  propertyId: string;
  policyId: string;
  assetName: string;
  assetNameHex: string;
  totalSupply: number;
}> {
  // Use cached session if not provided
  if (!laceSession) {
    laceSession = getCachedSession();
    if (!laceSession) {
      laceSession = await connectWallet();
    }
  }

  const property = propertyTokens.find((p: PropertyToken) => p.property_id === propertyId);
  if (!property) {
    throw new Error(`Property ${propertyId} not found`);
  }

  const totalSupply = redeemerData.fields[0].int;
  const policyId = property.policy_id;
  const assetNameHex = property.asset_name_hex;
  const assetName = Buffer.from(assetNameHex, 'hex').toString('utf-8');

  console.log('='.repeat(60));
  console.log('BUILDING MINT TRANSACTION WITH MESH SDK');
  console.log('='.repeat(60));
  console.log();
  console.log(`Property ID: ${propertyId}`);
  console.log(`Property Name: ${property.name}`);
  console.log(`Policy ID: ${policyId}`);
  console.log(`Asset Name: '${assetName}'`);
  console.log(`Total Supply: ${totalSupply}`);
  console.log();

  // Load the policy script
  const scriptPath = getConfigPath(`build/token${propertyId}-policy.txe`);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Policy script not found: ${scriptPath}`);
  }

  const scriptData = JSON.parse(fs.readFileSync(scriptPath, 'utf-8'));
  const scriptCbor = scriptData.cborHex;

  console.log('✅ Policy script loaded');
  console.log(`   Script type: ${scriptData.type || 'unknown'}`);
  console.log();

  // Create Mesh wallet adapter
  const meshWallet = createMeshWalletAdapter(laceSession);

  // Create Mesh Transaction
  const tx = new Transaction({ initiator: meshWallet as any });

  // Get UTxOs and change address
  const utxos = await meshWallet.getUtxos();
  const changeAddress = await meshWallet.getChangeAddress();

  console.log(`Change Address: ${changeAddress}`);
  console.log(`Available UTxOs: ${utxos.length}`);
  console.log();

  // Add UTxOs as inputs (use first few UTxOs)
  const utxosToUse = utxos.slice(0, Math.min(utxos.length, 3));
  for (const utxo of utxosToUse) {
    // Handle different UTxO formats
    const txHash = utxo.txHash || utxo.tx_hash || utxo.txHashHex;
    const outputIndex = utxo.outputIndex || utxo.index || utxo.tx_index || 0;
    tx.setTxIn(txHash, outputIndex);
  }

  // Mint asset with Plutus script
  tx.mintAsset(scriptCbor, {
    assetName: assetNameHex,
    assetQuantity: totalSupply.toString(),
  });

  // Set redeemer for minting (Plutus V2/V3)
  tx.setMintPlutusDataV2(scriptCbor, redeemerData);

  // Add change output
  tx.setTxOut(changeAddress, []);

  // Build transaction
  console.log('Building transaction...');
  const unsignedTx = await tx.build();

  console.log('✅ Transaction built successfully');
  console.log();

  return {
    unsignedTx,
    propertyId,
    policyId,
    assetName,
    assetNameHex,
    totalSupply,
  };
}

/**
 * Sign and submit mint transaction
 */
export async function signAndSubmitMintTransaction(
  unsignedTx: string,
  laceSession?: LaceWalletSession
): Promise<string> {
  if (!laceSession) {
    laceSession = getCachedSession();
    if (!laceSession) {
      laceSession = await connectWallet();
    }
  }

  const meshWallet = createMeshWalletAdapter(laceSession);

  console.log('Signing transaction...');
  const signedTx = await meshWallet.signTx(unsignedTx);

  console.log('Submitting transaction...');
  const txHash = await meshWallet.submitTx(signedTx);

  console.log(`✅ Transaction submitted: ${txHash}`);
  return txHash;
}

/**
 * Complete mint flow: build, sign, and submit
 */
export async function mintPropertyToken(
  propertyId: string,
  laceSession?: LaceWalletSession
): Promise<{
  success: boolean;
  txHash: string;
  propertyId: string;
  policyId: string;
  assetName: string;
  totalSupply: number;
}> {
  try {
    console.log('='.repeat(60));
    console.log('MINTING PROPERTY TOKEN');
    console.log('='.repeat(60));
    console.log();

    // Build transaction
    const txData = await buildMintTransaction(propertyId, laceSession);

    // Sign and submit
    const txHash = await signAndSubmitMintTransaction(txData.unsignedTx, laceSession);

    return {
      success: true,
      txHash,
      propertyId: txData.propertyId,
      policyId: txData.policyId,
      assetName: txData.assetName,
      totalSupply: txData.totalSupply,
    };
  } catch (error) {
    console.error('❌ Error minting token:', error);
    throw error;
  }
}

/**
 * Get available properties
 */
export function getAvailableProperties(): PropertyToken[] {
  return propertyTokens;
}

/**
 * Get property by ID
 */
export function getPropertyById(propertyId: string): PropertyToken | undefined {
  return propertyTokens.find((p: PropertyToken) => p.property_id === propertyId);
}

