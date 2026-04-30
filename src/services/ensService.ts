import { namehash, encodeFunctionData } from 'viem';
import { owsService } from './owsService';

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
  /**
   * Registers a subdomain under the root ENS name using OWS master agent.
   */
  async createSubdomain(name: string, ownerAddress: string) {
    const rootEns = process.env.ROOT_ENS_NAME;
    const masterAgentId = process.env.MASTER_AGENT_ID;
    const rpcUrl = process.env.RPC_URL;

    if (!rootEns || !masterAgentId || !rpcUrl) {
      console.warn('ENS service missing configuration (ROOT_ENS_NAME, MASTER_AGENT_ID, or RPC_URL). Skipping.');
      return null;
    }

    try {
      // Slugify: lowercase, replace spaces with hyphens, strip special chars
      const label = name.toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      
      const rootNode = namehash(rootEns);
      const fullName = `${label}.${rootEns}`;

      console.log(`[ens] Creating subdomain: ${fullName} for ${ownerAddress}`);

      // 1. Build the transaction calldata
      const data = encodeFunctionData({
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

      // 2. Build the OWS signAndSend payload
      const payload = {
        to: NAME_WRAPPER_ADDRESS,
        data,
        value: '0x0',
      };

      // 3. Request OWS to sign and send from Master Agent
      // Note: We use 'master' as name since it's the deployer
      const result = await owsService.signRequest(
        masterAgentId,
        'master',
        'ethereum',
        'signAndSend',
        payload,
        rpcUrl
      );

      console.log(`[ens] Subdomain transaction sent: ${result.txHash}`);

      return {
        ensName: fullName,
        transactionHash: result.txHash,
      };
    } catch (error) {
      console.error('[ens] Error creating subdomain:', error);
      return null;
    }
  }
}

export const ensService = new ENSService();
