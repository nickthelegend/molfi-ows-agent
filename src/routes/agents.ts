import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { owsService } from '../services/owsService';
import { ensService } from '../services/ensService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only';

// Validation schemas
const createAgentSchema = z.object({
  name: z.string().min(3).max(20).regex(/^[a-z0-9-]+$/),
  policy: z.object({
    maxDailyUsd: z.number().optional(),
    allowedChains: z.array(z.string()).optional(),
  }).optional(),
});

const signRequestSchema = z.object({
  type: z.enum(['message', 'transaction', 'typedData', 'signAndSend']),
  chain: z.string().default('ethereum'),
  payload: z.any(),
  rpcUrl: z.string().url().optional(),
});

// Middleware to authenticate agent requests
const authenticateAgent = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { agentId: string; name: string };
    req.agent = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid agent token' });
  }
};

/**
 * POST /agents/create
 * Creates a new AI agent with its own OWS wallet.
 */
router.post('/create', async (req, res) => {
  try {
    const { name, policy } = createAgentSchema.parse(req.body);

    // 1. Create OWS Wallet
    const walletInfo = await owsService.createWallet(name);

    // 2. Optional: Create ENS Subdomain
    let ensName = null;
    if (process.env.ROOT_ENS_NAME) {
      const ensResult = await ensService.createSubdomain(name, walletInfo.address);
      if (ensResult) {
        ensName = ensResult.ensName;
      }
    }

    // 3. Generate Agent Token (JWT)
    const agentToken = jwt.sign(
      { agentId: walletInfo.agentId, name: name },
      JWT_SECRET,
      { expiresIn: '365d' } // Long-lived token for the agent
    );

    res.status(201).json({
      success: true,
      agentId: walletInfo.agentId,
      ensName,
      walletAddress: walletInfo.address,
      agentToken,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Agent creation failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /agents/:agentId/sign
 * Flexible signing for messages, transactions, or typed data.
 */
router.post('/:agentId/sign', authenticateAgent, async (req: any, res) => {
  try {
    const { agentId } = req.params;
    if (agentId !== req.agent.agentId) {
      return res.status(403).json({ error: 'Unauthorized: Agent ID mismatch' });
    }

    const { type, chain, payload, rpcUrl } = signRequestSchema.parse(req.body);

    const result = await owsService.signRequest(
      agentId,
      req.agent.name,
      chain,
      type,
      payload,
      rpcUrl
    );

    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Signing failed:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /agents
 * List all agents (public info).
 */
router.get('/', async (req, res) => {
  try {
    // In a real app, this would query a database.
    // Here we might list files in the wallet directory as a proxy.
    const agents = await owsService.listWallets();
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

export default router;
