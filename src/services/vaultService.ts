import vault from 'node-vault';
import fs from 'fs';
import path from 'path';

export class VaultService {
  private client: vault.client;
  private readonly secretPath = 'secret/data/ows-wallets';

  constructor() {
    this.client = vault({
      apiVersion: 'v1',
      endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
      token: process.env.VAULT_TOKEN || 'root',
    });
  }

  /**
   * Checks connectivity to Vault.
   */
  async checkHealth() {
    try {
      await this.client.health();
      return true;
    } catch (error) {
      console.error('[vault] Health check failed:', error);
      return false;
    }
  }

  /**
   * Stores encrypted wallet data in Vault KV v2.
   */
  async storeWalletBlob(agentId: string, data: { blob: string, owsId: string }) {
    console.log(`[vaultService] storeWalletBlob for agent: ${agentId} to path: ${this.secretPath}`);
    try {
      console.log(`[vaultService] Calling Vault client.write to: ${process.env.VAULT_ADDR || 'http://127.0.0.1:8200'}`);
      await this.client.write(`${this.secretPath}/${agentId}`, {
        data,
      });
      console.log(`[vaultService] Successfully stored data for agent ${agentId}`);
    } catch (error: any) {
      console.error(`[vaultService] Failed to store data for agent ${agentId} ERROR:`, error);
      if (error.stack) console.error('[vaultService] Stack Trace:', error.stack);
      throw error;
    }
  }

  /**
   * Retrieves wallet data from Vault.
   */
  async getWalletData(agentId: string): Promise<{ blob: string, owsId: string }> {
    try {
      const response = await this.client.read(`${this.secretPath}/${agentId}`);
      return response.data.data;
    } catch (error) {
      console.error(`[vault] Failed to read data for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Writes the wallet blob to a temporary file in /tmp/ows-wallets/wallets/{owsId}.json
   */
  async writeToTemp(agentId: string, blob: string, owsId: string): Promise<string> {
    const tempDir = path.join(process.env.OWS_WALLETS_PATH || '/tmp/ows-wallets', 'wallets');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(tempDir, `${owsId}.json`);
    fs.writeFileSync(tempPath, blob);
    
    // Security: set restrictive permissions
    fs.chmodSync(tempPath, 0o600);
    
    return tempPath;
  }

  /**
   * Deletes a temporary wallet file from disk.
   */
  async cleanupTemp(agentId: string, owsId: string) {
    const tempDir = path.join(process.env.OWS_WALLETS_PATH || '/tmp/ows-wallets', 'wallets');
    const tempPath = path.join(tempDir, `${owsId}.json`);
    
    if (fs.existsSync(tempPath)) {
      try {
        // Zero-fill or overwrite before deleting could be added for extra security
        fs.unlinkSync(tempPath);
        console.log(`[vault] Cleaned up temp file for agent ${agentId}`);
      } catch (error) {
        console.error(`[vault] Cleanup failed for agent ${agentId}:`, error);
      }
    }
  }

  /**
   * Deletes a wallet from Vault.
   */
  async deleteWallet(agentId: string) {
    try {
      await this.client.delete(`${this.secretPath}/${agentId}`);
      console.log(`[vault] Deleted wallet from Vault for agent ${agentId}`);
    } catch (error) {
      console.error(`[vault] Failed to delete wallet from Vault:`, error);
    }
  }
}

export const vaultService = new VaultService();
