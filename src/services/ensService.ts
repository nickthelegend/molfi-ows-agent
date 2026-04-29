import { createWalletClient, createPublicClient, http, namehash, encodeFunctionData } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ENS NameWrapper contract address (Mainnet)
const NAME_WRAPPER_ADDRESS = '0xD4416b13d2b1df0632a7620241A35467406a46E2';

// Simplified NameWrapper ABI for registering a subdomain
const NAME_WRAPPER_ABI = [
  {
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'fuses', type: 'uint32' },
      { name: 'expiry', type: 'uint64' },
    ],
    name: 'setSubnodeRecord',
    outputs: [{ name: 'node', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export class ENSService {
  private signerAccount;
  private publicClient;
  private walletClient;

  constructor() {
    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL;

    if (privateKey && rpcUrl) {
      this.signerAccount = privateKeyToAccount(privateKey as `0x${string}`);
      this.publicClient = createPublicClient({
        chain: mainnet,
        transport: http(rpcUrl),
      });
      this.walletClient = createWalletClient({
        account: this.signerAccount,
        chain: mainnet,
        transport: http(rpcUrl),
      });
    }
  }

  /**
   * Registers a subdomain under the root ENS name.
   * Example: name.nivesh.eth
   */
  async createSubdomain(name: string, ownerAddress: string) {
    if (!this.walletClient || !process.env.ROOT_ENS_NAME) {
      console.warn('ENS service not configured. Skipping subdomain creation.');
      return null;
    }

    try {
      const rootNode = namehash(process.env.ROOT_ENS_NAME);
      const label = name.toLowerCase();
      const fullName = `${label}.${process.env.ROOT_ENS_NAME}`;

      console.log(`Creating ENS subdomain: ${fullName} for ${ownerAddress}`);

      // This is a simplified call to NameWrapper. In production, you'd handle gas, nonces, etc.
      const hash = await this.walletClient.writeContract({
        address: NAME_WRAPPER_ADDRESS,
        abi: NAME_WRAPPER_ABI,
        functionName: 'setSubnodeRecord',
        args: [
          rootNode,
          label,
          ownerAddress as `0x${string}`,
          0, // Fuses
          BigInt(2147483647), // Distant future expiry
        ],
      });

      return {
        ensName: fullName,
        transactionHash: hash,
      };
    } catch (error) {
      console.error('Error creating ENS subdomain:', error);
      return null;
    }
  }
}

export const ensService = new ENSService();
