import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import agentRoutes from './routes/agents';

const app = express();
const port = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);

// Routes
app.use('/agents', agentRoutes);

import { vaultService } from './services/vaultService';

// Health Check
app.get('/health', async (req, res) => {
  const vaultHealthy = await vaultService.checkHealth();
  res.json({ 
    status: vaultHealthy ? 'ok' : 'degraded', 
    vault: vaultHealthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString() 
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Molfi AI Agent OWS Backend',
    version: '1.0.0',
    docs: 'Refer to README.md for API usage'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
  console.log(`[ows]: Wallets path is ${process.env.OWS_WALLETS_PATH || 'default'}`);
});
