import { PrismaClient, StepType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Workflow 1: Expense Approval ───────────────────────────────────────────
  const expenseWorkflow = await prisma.workflow.create({
    data: {
      name: 'Expense Approval',
      description: 'Multi-level expense approval process based on amount and priority',
      version: 1,
      is_active: true,
      input_schema: {
        amount:     { type: 'number', required: true },
        country:    { type: 'string', required: true },
        department: { type: 'string', required: false },
        priority:   { type: 'string', required: true, allowed_values: ['High', 'Medium', 'Low'] },
      },
    },
  });

  const managerApproval = await prisma.step.create({
    data: {
      workflow_id: expenseWorkflow.id,
      name: 'Manager Approval',
      step_type: StepType.APPROVAL,
      order: 1,
      metadata: { assignee_email: 'manager@example.com', instructions: 'Review and approve expense request' },
    },
  });

  const financeNotification = await prisma.step.create({
    data: {
      workflow_id: expenseWorkflow.id,
      name: 'Finance Notification',
      step_type: StepType.NOTIFICATION,
      order: 2,
      metadata: { notification_channel: 'email', template: 'finance-alert', recipient: 'finance@example.com' },
    },
  });

  const ceoApproval = await prisma.step.create({
    data: {
      workflow_id: expenseWorkflow.id,
      name: 'CEO Approval',
      step_type: StepType.APPROVAL,
      order: 3,
      metadata: { assignee_email: 'ceo@example.com', instructions: 'Final approval for high-value expenses' },
    },
  });

  const taskRejection = await prisma.step.create({
    data: {
      workflow_id: expenseWorkflow.id,
      name: 'Task Rejection',
      step_type: StepType.TASK,
      order: 4,
      metadata: { action: 'reject', notify_requester: true },
    },
  });

  // Set start step
  await prisma.workflow.update({
    where: { id: expenseWorkflow.id },
    data: { start_step_id: managerApproval.id },
  });

  // Rules for Manager Approval step
  await prisma.rule.createMany({
    data: [
      {
        step_id: managerApproval.id,
        condition: "amount > 100 && country == 'US' && priority == 'High'",
        next_step_id: financeNotification.id,
        priority: 1,
      },
      {
        step_id: managerApproval.id,
        condition: "amount <= 100 || department == 'HR'",
        next_step_id: ceoApproval.id,
        priority: 2,
      },
      {
        step_id: managerApproval.id,
        condition: "priority == 'Low' && country != 'US'",
        next_step_id: taskRejection.id,
        priority: 3,
      },
      {
        step_id: managerApproval.id,
        condition: 'DEFAULT',
        next_step_id: taskRejection.id,
        priority: 4,
      },
    ],
  });

  // Rules for Finance Notification step
  await prisma.rule.createMany({
    data: [
      {
        step_id: financeNotification.id,
        condition: 'amount > 10000',
        next_step_id: ceoApproval.id,
        priority: 1,
      },
      {
        step_id: financeNotification.id,
        condition: 'DEFAULT',
        next_step_id: null,
        priority: 2,
      },
    ],
  });

  // ─── Workflow 2: Employee Onboarding ────────────────────────────────────────
  const onboardingWorkflow = await prisma.workflow.create({
    data: {
      name: 'Employee Onboarding',
      description: 'Standard onboarding process for new employees',
      version: 1,
      is_active: true,
      input_schema: {
        employee_name: { type: 'string', required: true },
        department:    { type: 'string', required: true },
        role:          { type: 'string', required: true },
        start_date:    { type: 'string', required: true },
      },
    },
  });

  const hrNotification = await prisma.step.create({
    data: {
      workflow_id: onboardingWorkflow.id,
      name: 'HR Notification',
      step_type: StepType.NOTIFICATION,
      order: 1,
      metadata: { notification_channel: 'email', template: 'new-hire-alert', recipient: 'hr@example.com' },
    },
  });

  const itSetup = await prisma.step.create({
    data: {
      workflow_id: onboardingWorkflow.id,
      name: 'IT Setup',
      step_type: StepType.TASK,
      order: 2,
      metadata: { action: 'provision_accounts', systems: ['email', 'slack', 'github'] },
    },
  });

  await prisma.workflow.update({
    where: { id: onboardingWorkflow.id },
    data: { start_step_id: hrNotification.id },
  });

  await prisma.rule.createMany({
    data: [
      {
        step_id: hrNotification.id,
        condition: 'DEFAULT',
        next_step_id: itSetup.id,
        priority: 1,
      },
      {
        step_id: itSetup.id,
        condition: 'DEFAULT',
        next_step_id: null,
        priority: 1,
      },
    ],
  });

  console.log('✅ Seed complete!');
  console.log(`   Workflow 1: Expense Approval (id: ${expenseWorkflow.id})`);
  console.log(`   Workflow 2: Employee Onboarding (id: ${onboardingWorkflow.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
