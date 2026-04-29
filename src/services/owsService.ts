import { 
  createWallet, 
  signMessage, 
  signTransaction, 
  signTypedData, 
  signAndSend,
  getWallet, 
  listWallets 
} from '@open-wallet-standard/core';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const WALLETS_PATH = process.env.OWS_WALLETS_PATH || path.join(process.env.HOME || '/root', '.ows', 'wallets');

export class OWSService {
  constructor() {
    const owsRoot = path.join(process.env.HOME || '/root', '.ows');
    if (!fs.existsSync(owsRoot)) {
      fs.mkdirSync(owsRoot, { recursive: true });
    }
  }

  /**
   * Creates a new OWS wallet for an agent.
   */
  async createWallet(name: string) {
    const agentId = uuidv4();
    const walletName = `${name}-${agentId}`;
    const passphrase = process.env.WALLET_ENCRYPTION_KEY || null;
    
    // Create the wallet
    const walletInfo = createWallet(walletName, passphrase);
    console.log('[ows] Wallet created:', JSON.stringify(walletInfo, null, 2));

    // Get the address for EVM (check chainId)
    const evmAccount = walletInfo.accounts.find(a => a.chainId.startsWith('eip155:'));
    const address = evmAccount ? evmAccount.address : 'unknown';
    
    return {
      agentId,
      address,
      walletName
    };
  }

  /**
   * Signs a message using the agent's wallet.
   */
  async signMessage(agentId: string, name: string, message: string) {
    const walletName = `${name}-${agentId}`;
    const passphrase = process.env.WALLET_ENCRYPTION_KEY || null;
    const result = signMessage(walletName, 'ethereum', message, passphrase);
    return result.signature;
  }

  /**
   * Signs a transaction using the agent's wallet.
   */
  async signTransaction(agentId: string, name: string, chain: string, txHex: string) {
    const walletName = `${name}-${agentId}`;
    const passphrase = process.env.WALLET_ENCRYPTION_KEY || null;
    const result = signTransaction(walletName, 'ethereum', txHex, passphrase);
    return result.signature;
  }

  /**
   * Flexible signing request handler.
   */
  async signRequest(
    agentId: string,
    name: string,
    chain: string,
    type: 'message' | 'transaction' | 'typedData' | 'signAndSend',
    payload: any,
    rpcUrl?: string
  ) {
    const walletName = `${name}-${agentId}`;
    const passphrase = process.env.WALLET_ENCRYPTION_KEY || null;
    
    // Convert generic 'evm' to 'ethereum' for OWS SDK if needed
    const normalizedChain = chain === 'evm' ? 'ethereum' : chain;

    let result: any;

    switch (type) {
      case 'message':
        result = signMessage(walletName, normalizedChain, payload, passphrase);
        break;

      case 'transaction':
        result = signTransaction(walletName, normalizedChain, payload, passphrase);
        break;

      case 'typedData':
        // payload should be a JSON string or object
        const typedData = typeof payload === 'string' ? payload : JSON.stringify(payload);
        result = signTypedData(walletName, normalizedChain, typedData, passphrase);
        break;

      case 'signAndSend':
        if (!rpcUrl) throw new Error('rpcUrl required for signAndSend');
        result = signAndSend(walletName, normalizedChain, payload, passphrase, undefined, rpcUrl);
        break;

      default:
        throw new Error('Invalid sign type');
    }

    return {
      signature: result.signature,
      recoveryId: result.recoveryId,
      txHash: result.txHash || undefined,
    };
  }

  /**
   * Lists all agents.
   */
  async listWallets() {
    const wallets = listWallets();
    return wallets.map(w => ({
      name: w.name,
      address: w.accounts.find(a => a.chainId.startsWith('eip155:'))?.address
    }));
  }
}

export const owsService = new OWSService();
