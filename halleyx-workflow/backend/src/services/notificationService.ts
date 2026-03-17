import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

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

// ─── Transporter singleton ────────────────────────────────────────────────────
let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    logger.info('📧 Using real SMTP transporter');
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    logger.info(`📧 Ethereal test inbox: ${testAccount.user}`);
    logger.info(`📬 View emails at: https://ethereal.email/login  user:${testAccount.user}  pass:${testAccount.pass}`);
  }
  return transporter;
}

// ─── HTML builder ─────────────────────────────────────────────────────────────
function buildHtml(params: {
  subject: string;
  body: string;
  data: Record<string, unknown>;
  execution_id: string;
  workflow_name: string;
  step_name: string;
  badge?: { label: string; color: string };
}): string {
  const dataRows = Object.entries(params.data)
    .map(([k, v]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:140px">${k}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:500">${v}</td>
      </tr>`)
    .join('');

  const badgeHtml = params.badge
    ? `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:${params.badge.color};color:white;margin-bottom:16px">${params.badge.label}</span>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#4f46e5;padding:24px 32px">
      <span style="color:white;font-size:18px;font-weight:600">⚡ Halleyx Workflow</span>
    </div>
    <div style="padding:28px 32px">
      ${badgeHtml}
      <h2 style="margin:0 0 6px;color:#111827;font-size:18px;font-weight:600">${params.subject}</h2>
      <p style="margin:0 0 4px;color:#6b7280;font-size:13px">
        Workflow: <strong style="color:#374151">${params.workflow_name}</strong>
        &nbsp;·&nbsp; Step: <strong style="color:#374151">${params.step_name}</strong>
      </p>
      <p style="margin:16px 0 20px;color:#374151;font-size:14px;line-height:1.6">${params.body}</p>
      <div style="background:#f9fafb;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:24px">
        <div style="padding:10px 12px;background:#f3f4f6;border-bottom:1px solid #e5e7eb">
          <span style="font-size:11px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em">Request Data</span>
        </div>
        <table style="width:100%;border-collapse:collapse">${dataRows}</table>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px">
        Execution: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:11px">${params.execution_id.slice(0, 8)}…</code>
      </p>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#9ca3af;font-size:12px">Automated notification from Halleyx Workflow Engine.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Core send function ───────────────────────────────────────────────────────
export async function sendEmailNotification(payload: NotificationPayload & {
  badge?: { label: string; color: string };
}): Promise<NotificationResult> {
  try {
    const transport = await getTransporter();
    const html = buildHtml({
      subject: payload.subject,
      body: payload.body,
      data: payload.data,
      execution_id: payload.execution_id,
      workflow_name: payload.workflow_name,
      step_name: payload.step_name,
      badge: payload.badge,
    });

    const info = await transport.sendMail({
      from: process.env.SMTP_FROM ?? '"Halleyx Workflow" <noreply@halleyx.com>',
      to: payload.recipient,
      subject: payload.subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      logger.info(`📬 Email → ${payload.recipient} | Preview: ${previewUrl}`);
    } else {
      logger.info(`📬 Email → ${payload.recipient} | ID: ${info.messageId}`);
    }

    return {
      success: true,
      message_id: info.messageId,
      preview_url: typeof previewUrl === 'string' ? previewUrl : undefined,
      recipient: payload.recipient,
      channel: 'email',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Email failed → ${payload.recipient}: ${error}`);
    return { success: false, recipient: payload.recipient, channel: 'email', error };
  }
}

// ─── Approval request email (Employee → Manager, or Manager → CEO) ────────────
export async function sendApprovalRequestEmail(params: {
  to: string;
  approverName: string;
  requesterName: string;
  workflowName: string;
  stepName: string;
  executionId: string;
  requestVersion: number;
  data: Record<string, unknown>;
}): Promise<void> {
  await sendEmailNotification({
    recipient: params.to,
    subject: `Action Required: ${params.workflowName} — ${params.stepName}`,
    body: `<strong>${params.requesterName}</strong> has submitted a request that requires your approval. Please review the details below and take action.`,
    step_name: params.stepName,
    workflow_name: params.workflowName,
    execution_id: params.executionId,
    data: {
      'Submitted by': params.requesterName,
      'Request version': `r${params.requestVersion}`,
      ...params.data,
    },
    badge: { label: '⏳ Awaiting Your Approval', color: '#d97706' },
  });
}

// ─── Approval decision email (Manager/CEO → Employee) ─────────────────────────
export async function sendApprovalDecisionEmail(params: {
  to: string;
  requesterName: string;
  approverName: string;
  action: 'approved' | 'rejected';
  workflowName: string;
  stepName: string;
  executionId: string;
  requestVersion: number;
  comment?: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const isApproved = params.action === 'approved';

  await sendEmailNotification({
    recipient: params.to,
    subject: `Request ${isApproved ? 'Approved ✅' : 'Rejected ❌'} — ${params.workflowName}`,
    body: isApproved
      ? `Your request has been <strong>approved</strong> by <strong>${params.approverName}</strong>.${params.comment ? ` Comment: "${params.comment}"` : ''} The workflow will continue to the next step.`
      : `Your request has been <strong>rejected</strong> by <strong>${params.approverName}</strong>.${params.comment ? ` Reason: "${params.comment}"` : ''} You can resubmit with corrections.`,
    step_name: params.stepName,
    workflow_name: params.workflowName,
    execution_id: params.executionId,
    data: {
      'Decision by': params.approverName,
      'Request version': `r${params.requestVersion}`,
      ...params.data,
    },
    badge: isApproved
      ? { label: '✅ Approved', color: '#16a34a' }
      : { label: '❌ Rejected', color: '#dc2626' },
  });
}

// ─── Workflow notification step handler ───────────────────────────────────────
export async function handleNotificationStep(
  stepMetadata: Record<string, unknown>,
  executionData: Record<string, unknown>,
  stepName: string,
  workflowName: string,
  executionId: string
): Promise<NotificationResult> {
  const channel   = (stepMetadata.notification_channel as string) ?? 'email';
  const recipient = (stepMetadata.recipient as string) ?? (stepMetadata.assignee_email as string) ?? 'admin@example.com';
  const template  = (stepMetadata.template as string) ?? 'default';

  const templates: Record<string, { subject: string; body: string }> = {
    'finance-alert': {
      subject: `Finance Alert: Expense requires review`,
      body: `A high-value expense has been submitted and requires finance review.`,
    },
    'new-hire-alert': {
      subject: `New Employee Onboarding: Action Required`,
      body: `A new employee has been added. Please complete onboarding tasks.`,
    },
    default: {
      subject: `Workflow Notification: ${stepName}`,
      body: `Automated notification from "${workflowName}" at step "${stepName}".`,
    },
  };

  const { subject, body } = templates[template] ?? templates['default'];

  if (channel === 'email') {
    return sendEmailNotification({
      recipient, subject, body,
      step_name: stepName,
      workflow_name: workflowName,
      execution_id: executionId,
      data: executionData,
    });
  }

  logger.warn(`Channel "${channel}" not yet implemented`);
  return { success: false, recipient, channel, error: `Channel "${channel}" not supported` };
}
