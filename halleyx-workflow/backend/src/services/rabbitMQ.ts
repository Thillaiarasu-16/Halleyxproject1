import amqplib, { Connection, Channel } from 'amqplib';
import { logger } from '../utils/logger';

// ─── Queue names ──────────────────────────────────────────────────────────────
export const QUEUES = {
  EXECUTE_STEP:    'halleyx.execute_step',
  APPROVAL_NOTIFY: 'halleyx.approval_notify',
  DECISION_NOTIFY: 'halleyx.decision_notify',
} as const;

// ─── Message types ────────────────────────────────────────────────────────────
export interface ExecuteStepMessage {
  executionId:  string;
  workflowId:   string;
  fromStepId:   string | null;
  data:         Record<string, unknown>;
  existingLogs: unknown[];
}

export interface ApprovalNotifyMessage {
  to:             string;
  approverName:   string;
  requesterName:  string;
  workflowName:   string;
  stepName:       string;
  executionId:    string;
  requestVersion: number;
  data:           Record<string, unknown>;
}

export interface DecisionNotifyMessage {
  to:             string;
  requesterName:  string;
  approverName:   string;
  action:         'approved' | 'rejected';
  workflowName:   string;
  stepName:       string;
  executionId:    string;
  requestVersion: number;
  comment?:       string;
  data:           Record<string, unknown>;
}

// ─── Singleton connection ─────────────────────────────────────────────────────
let connection: Connection | null = null;
let channel:    Channel    | null = null;

export async function getRabbitChannel(): Promise<Channel> {
  if (channel) return channel;

  const url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';

  try {
    connection = await amqplib.connect(url);
    channel    = await connection.createChannel();

    // Declare all queues as durable so messages survive broker restarts
    for (const q of Object.values(QUEUES)) {
      await channel.assertQueue(q, { durable: true });
    }

    logger.info(`🐇 RabbitMQ connected → ${url}`);

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', { err });
      connection = null;
      channel    = null;
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed — will reconnect on next use');
      connection = null;
      channel    = null;
    });

    return channel;
  } catch (err) {
    logger.warn(`RabbitMQ not available (${url}) — falling back to direct execution`);
    throw err;
  }
}

// ─── Publish a message to a queue ─────────────────────────────────────────────
export async function publishMessage(queue: string, payload: unknown): Promise<boolean> {
  try {
    const ch = await getRabbitChannel();
    const ok = ch.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: 'application/json' }
    );
    logger.info(`📤 Published → ${queue}`);
    return ok;
  } catch {
    logger.warn(`📤 RabbitMQ publish failed for ${queue} — running directly`);
    return false;
  }
}

// ─── Start all consumers ──────────────────────────────────────────────────────
export async function startConsumers(
  handlers: {
    onExecuteStep:    (msg: ExecuteStepMessage)    => Promise<void>;
    onApprovalNotify: (msg: ApprovalNotifyMessage) => Promise<void>;
    onDecisionNotify: (msg: DecisionNotifyMessage) => Promise<void>;
  }
): Promise<void> {
  try {
    const ch = await getRabbitChannel();

    // Only process one message at a time per consumer
    ch.prefetch(1);

    // ── Execute step consumer ─────────────────────────────────────────────────
    ch.consume(QUEUES.EXECUTE_STEP, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString()) as ExecuteStepMessage;
        logger.info(`📥 [${QUEUES.EXECUTE_STEP}] executionId=${payload.executionId}`);
        await handlers.onExecuteStep(payload);
        ch.ack(msg);
      } catch (err) {
        logger.error('Execute step consumer error', { err });
        ch.nack(msg, false, false); // discard — don't requeue infinite loop
      }
    });

    // ── Approval notify consumer ──────────────────────────────────────────────
    ch.consume(QUEUES.APPROVAL_NOTIFY, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString()) as ApprovalNotifyMessage;
        logger.info(`📥 [${QUEUES.APPROVAL_NOTIFY}] to=${payload.to}`);
        await handlers.onApprovalNotify(payload);
        ch.ack(msg);
      } catch (err) {
        logger.error('Approval notify consumer error', { err });
        ch.nack(msg, false, false);
      }
    });

    // ── Decision notify consumer ──────────────────────────────────────────────
    ch.consume(QUEUES.DECISION_NOTIFY, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString()) as DecisionNotifyMessage;
        logger.info(`📥 [${QUEUES.DECISION_NOTIFY}] to=${payload.to} action=${payload.action}`);
        await handlers.onDecisionNotify(payload);
        ch.ack(msg);
      } catch (err) {
        logger.error('Decision notify consumer error', { err });
        ch.nack(msg, false, false);
      }
    });

    logger.info('🐇 RabbitMQ consumers started for all queues');
  } catch {
    logger.warn('🐇 RabbitMQ consumers not started — running in direct mode');
  }
}
