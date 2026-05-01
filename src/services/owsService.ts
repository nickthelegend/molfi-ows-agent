import { 
  createWallet, 
  signMessage, 
  signTransaction, 
  signTypedData, 
  signAndSend,
  listWallets,
  getWallet,
} from '@open-wallet-standard/core';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { vaultService } from './vaultService';

const OWS_TEMP_ROOT = process.env.OWS_WALLETS_PATH || '/tmp/ows-wallets';

export class OWSService {
  constructor() {
    if (!fs.existsSync(OWS_TEMP_ROOT)) {
      fs.mkdirSync(OWS_TEMP_ROOT, { recursive: true });
    }
  }

  /**
   * Creates a new AI agent wallet and stores the encrypted blob in Vault.
   */
  async createWallet(name: string) {
    const agentId = uuidv4();
    const walletName = `${name}-${agentId}`;
    const passphrase = process.env.WALLET_ENCRYPTION_KEY || null;

    console.log(`[owsService] Starting createWallet for ${name}. AgentId: ${agentId}`);

    // 1. Create wallet using OWS SDK in temp storage
    try {
      console.log('[owsService] Calling OWS SDK createWallet...');
      const walletInfo = createWallet(walletName, passphrase, 12, OWS_TEMP_ROOT);
      console.log(`[owsService] OWS SDK created wallet: ${walletInfo.id}`);
      
      // 2. Read the encrypted blob
      const walletPath = path.join(OWS_TEMP_ROOT, 'wallets', `${walletInfo.id}.json`);
      console.log(`[owsService] Reading wallet blob from: ${walletPath}`);
      
      if (!fs.existsSync(walletPath)) {
         throw new Error(`Wallet file not found at ${walletPath}`);
      }

      const blob = fs.readFileSync(walletPath, 'utf8');
      console.log('[owsService] Wallet blob read successfully');

      // 3. Store blob and the OWS ID in HashiCorp Vault
      console.log('[owsService] Storing blob in Vault...');
      await vaultService.storeWalletBlob(agentId, {
        blob,
        owsId: walletInfo.id
      });
      console.log('[owsService] Vault storage successful');

      // 4. Securely delete the local temp file immediately
      console.log('[owsService] Cleaning up temp file...');
      await vaultService.cleanupTemp(agentId, walletInfo.id);

      const evmAccount = walletInfo.accounts.find(a => a.chainId.startsWith('eip155:'));
      const address = evmAccount ? evmAccount.address : 'unknown';
      
      console.log('[owsService] createWallet completed successfully for address:', address);
      return {
        agentId,
        address,
        walletName
      };
    } catch (err: any) {
      console.error('[owsService] Error in createWallet:', err);
      throw err;
    }
  }

  /**
   * Flexible signing request handler with Vault-backed persistence.
   */
  async signRequest(
    agentId: string,
    name: string,
    chain: string,
    type: 'message' | 'transaction' | 'typedData' | 'signAndSend',
    payload: any,
    rpcUrl?: string
  ) {
    const passphrase = process.env.WALLET_ENCRYPTION_KEY || null;
    const normalizedChain = chain === 'evm' ? 'ethereum' : chain;

    let owsId = '';
    try {
      // 1. Fetch data from Vault
      const data = await vaultService.getWalletData(agentId);
      owsId = data.owsId;

      // 2. Write to temp file for OWS SDK to load
      // The SDK expects /tmp/ows-wallets/wallets/{owsId}.json
      await vaultService.writeToTemp(agentId, data.blob, owsId);

      // 3. TODO: Perform policy checks
      console.log(`[ows] Signing ${type} for agent ${agentId} (OWS ID: ${owsId})`);

      // 4. Perform signing operation
      let result: any;
      switch (type) {
        case 'message':
          result = signMessage(owsId, normalizedChain, payload, passphrase, undefined, undefined, OWS_TEMP_ROOT);
          break;
        case 'transaction':
          result = signTransaction(owsId, normalizedChain, payload, passphrase, undefined, OWS_TEMP_ROOT);
          break;
        case 'typedData':
          const typedData = typeof payload === 'string' ? payload : JSON.stringify(payload);
          result = signTypedData(owsId, normalizedChain, typedData, passphrase, undefined, OWS_TEMP_ROOT);
          break;
        case 'signAndSend':
          if (!rpcUrl) throw new Error('rpcUrl required for signAndSend');
          result = signAndSend(owsId, normalizedChain, payload, passphrase, undefined, rpcUrl, OWS_TEMP_ROOT);
          break;
        default:
          throw new Error('Invalid sign type');
      }

      return {
        signature: result.signature,
        recoveryId: result.recoveryId,
        txHash: result.txHash || undefined,
      };
    } finally {
      // 5. CRITICAL: Always cleanup temp file
      if (owsId) {
        await vaultService.cleanupTemp(agentId, owsId);
      }
    }
  }

  /**
   * List agents (In a real app, this should query a DB, not Vault/Disk)
   */
  async listWallets() {
    // This is just a placeholder for the exercise
    return [];
  }
}

export const owsService = new OWSService();
