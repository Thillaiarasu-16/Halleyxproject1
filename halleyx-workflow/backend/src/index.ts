import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { workflowRouter } from './routes/workflows';
import { stepRouter } from './routes/steps';
import { ruleRouter } from './routes/rules';
import { executionRouter } from './routes/executions';
import { authRouter } from './routes/auth';
import { logger } from './utils/logger';
import { startConsumers } from './services/rabbitMQ';
import { sendApprovalRequestEmail, sendApprovalDecisionEmail } from './services/notificationService';
import { resumeExecutionFromQueue } from './routes/executions';

dotenv.config();

const app  = express();
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

app.listen(PORT, async () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);

  // Start RabbitMQ consumers (graceful fallback if RabbitMQ is not running)
  await startConsumers({
    onExecuteStep: async (msg) => {
      await resumeExecutionFromQueue(
        msg.executionId,
        msg.workflowId,
        msg.fromStepId,
        msg.data,
        msg.existingLogs
      );
    },
    onApprovalNotify: async (msg) => {
      await sendApprovalRequestEmail(msg);
    },
    onDecisionNotify: async (msg) => {
      await sendApprovalDecisionEmail(msg);
    },
  });
});

export default app;
