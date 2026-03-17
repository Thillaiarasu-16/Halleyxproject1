import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface NotificationPayload {
  recipient: string;
  subject: string;
  body: string;
  step_name: string;
  workflow_name: string;
  execution_id: string;
  data: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  message_id?: string;
  preview_url?: string;
  recipient: string;
  channel: string;
  error?: string;
}

// ─── Transporter (lazy singleton) ────────────────────────────────────────────
let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  // Use real SMTP if configured in .env, otherwise use Ethereal (fake inbox)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    logger.info('📧 Using real SMTP transporter');
  } else {
    // Auto-create a free Ethereal test account — emails visible at ethereal.email
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info(`📧 Using Ethereal test inbox: ${testAccount.user}`);
    logger.info(`📬 View emails at: https://ethereal.email/login (user: ${testAccount.user} / pass: ${testAccount.pass})`);
  }

  return transporter;
}

// ─── Build email HTML from template ──────────────────────────────────────────
function buildEmailHtml(payload: NotificationPayload): string {
  const dataRows = Object.entries(payload.data)
    .map(([k, v]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:140px">${k}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:500">${v}</td>
      </tr>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">

    <!-- Header -->
    <div style="background:#4f46e5;padding:24px 32px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center">
          <span style="color:white;font-size:16px">⚡</span>
        </div>
        <span style="color:white;font-size:18px;font-weight:600">Halleyx Workflow</span>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">
      <h2 style="margin:0 0 6px;color:#111827;font-size:18px;font-weight:600">${payload.subject}</h2>
      <p style="margin:0 0 20px;color:#6b7280;font-size:14px">
        Workflow: <strong style="color:#374151">${payload.workflow_name}</strong> &nbsp;·&nbsp;
        Step: <strong style="color:#374151">${payload.step_name}</strong>
      </p>

      <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6">${payload.body}</p>

      <!-- Data table -->
      <div style="background:#f9fafb;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:24px">
        <div style="padding:10px 12px;background:#f3f4f6;border-bottom:1px solid #e5e7eb">
          <span style="font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em">Execution Data</span>
        </div>
        <table style="width:100%;border-collapse:collapse">
          ${dataRows}
        </table>
      </div>

      <!-- Footer info -->
      <p style="margin:0;color:#9ca3af;font-size:12px">
        Execution ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:11px">${payload.execution_id.slice(0, 8)}…</code>
      </p>
    </div>

    <!-- Bottom bar -->
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#9ca3af;font-size:12px">
        This is an automated notification from Halleyx Workflow Engine.
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Send email notification ──────────────────────────────────────────────────
export async function sendEmailNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  try {
    const transport = await getTransporter();

    const info = await transport.sendMail({
      from: process.env.SMTP_FROM ?? '"Halleyx Workflow" <noreply@halleyx.com>',
      to: payload.recipient,
      subject: payload.subject,
      text: `${payload.body}\n\nWorkflow: ${payload.workflow_name}\nStep: ${payload.step_name}\nExecution: ${payload.execution_id}`,
      html: buildEmailHtml(payload),
    });

    // Ethereal gives a preview URL so you can view the email in browser
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

    if (previewUrl) {
      logger.info(`📬 Email sent! Preview: ${previewUrl}`);
    } else {
      logger.info(`📬 Email sent to ${payload.recipient} — Message ID: ${info.messageId}`);
    }

    return {
      success: true,
      message_id: info.messageId,
      preview_url: previewUrl || undefined,
      recipient: payload.recipient,
      channel: 'email',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Failed to send notification email: ${error}`);
    return {
      success: false,
      recipient: payload.recipient,
      channel: 'email',
      error,
    };
  }
}

// ─── Main handler called by execution engine ──────────────────────────────────
export async function handleNotificationStep(
  stepMetadata: Record<string, unknown>,
  executionData: Record<string, unknown>,
  stepName: string,
  workflowName: string,
  executionId: string
): Promise<NotificationResult> {
  const channel = (stepMetadata.notification_channel as string) ?? 'email';
  const recipient = (stepMetadata.recipient as string) ?? (stepMetadata.assignee_email as string) ?? 'admin@example.com';
  const template = (stepMetadata.template as string) ?? 'default';

  // Build subject and body based on template
  const templates: Record<string, { subject: string; body: string }> = {
    'finance-alert': {
      subject: `Finance Alert: Expense requires review`,
      body: `A high-value expense request has been submitted and requires your review. Please check the details below and take appropriate action.`,
    },
    'new-hire-alert': {
      subject: `New Employee Onboarding: Action Required`,
      body: `A new employee has been added to the system. Please complete the onboarding tasks for this team member.`,
    },
    default: {
      subject: `Workflow Notification: ${stepName}`,
      body: `This is an automated notification from the "${workflowName}" workflow at step "${stepName}".`,
    },
  };

  const { subject, body } = templates[template] ?? templates['default'];

  if (channel === 'email') {
    return sendEmailNotification({
      recipient,
      subject,
      body,
      step_name: stepName,
      workflow_name: workflowName,
      execution_id: executionId,
      data: executionData,
    });
  }

  // Future: handle 'slack', 'sms', etc.
  logger.warn(`Notification channel "${channel}" not yet implemented`);
  return { success: false, recipient, channel, error: `Channel "${channel}" not supported` };
}
