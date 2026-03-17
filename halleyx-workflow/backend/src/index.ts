import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { workflowRouter } from './routes/workflows';
import { stepRouter } from './routes/steps';
import { ruleRouter } from './routes/rules';
import { executionRouter } from './routes/executions';
import { authRouter } from './routes/auth';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth',      authRouter);
app.use('/api/workflows', workflowRouter);
app.use('/api',           stepRouter);
app.use('/api',           ruleRouter);
app.use('/api',           executionRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`🚀 Server running on http://localhost:${PORT}`));
export default app;
