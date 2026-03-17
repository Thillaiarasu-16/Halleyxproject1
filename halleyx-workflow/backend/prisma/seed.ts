import { PrismaClient, StepType, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Users ────────────────────────────────────────────────────────────────
  const hash = async (p: string) => bcrypt.hash(p, 10);

  const employee = await prisma.user.upsert({
    where: { email: 'employee@halleyx.com' },
    update: {},
    create: { name: 'Alice Employee', email: 'employee@halleyx.com', password: await hash('password123'), role: UserRole.EMPLOYEE },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@halleyx.com' },
    update: {},
    create: { name: 'Bob Manager', email: 'manager@halleyx.com', password: await hash('password123'), role: UserRole.FINANCE_MANAGER },
  });

  const ceo = await prisma.user.upsert({
    where: { email: 'ceo@halleyx.com' },
    update: {},
    create: { name: 'Carol CEO', email: 'ceo@halleyx.com', password: await hash('password123'), role: UserRole.CEO },
  });

  console.log('✅ Users created:');
  console.log(`   Employee: employee@halleyx.com / password123`);
  console.log(`   Manager:  manager@halleyx.com  / password123`);
  console.log(`   CEO:      ceo@halleyx.com      / password123`);

  // ─── Workflow 1: Expense Approval ─────────────────────────────────────────
  const expenseWorkflow = await prisma.workflow.upsert({
    where: { id: 'workflow-expense-001' },
    update: {},
    create: {
      id: 'workflow-expense-001',
      name: 'Expense Approval',
      description: 'Multi-level expense approval based on amount and priority',
      version: 1, is_active: true,
      input_schema: {
        amount:     { type: 'number', required: true },
        country:    { type: 'string', required: true },
        department: { type: 'string', required: false },
        priority:   { type: 'string', required: true, allowed_values: ['High', 'Medium', 'Low'] },
      },
    },
  });

  const managerApproval = await prisma.step.upsert({
    where: { id: 'step-manager-001' },
    update: {},
    create: {
      id: 'step-manager-001', workflow_id: expenseWorkflow.id,
      name: 'Manager Approval', step_type: StepType.APPROVAL, order: 1,
      metadata: { assignee_email: 'manager@halleyx.com', instructions: 'Review and approve or reject this expense request.' },
    },
  });

  const financeNotification = await prisma.step.upsert({
    where: { id: 'step-finance-notif-001' },
    update: {},
    create: {
      id: 'step-finance-notif-001', workflow_id: expenseWorkflow.id,
      name: 'Finance Notification', step_type: StepType.NOTIFICATION, order: 2,
      metadata: { notification_channel: 'email', template: 'finance-alert', recipient: 'manager@halleyx.com' },
    },
  });

  const ceoApproval = await prisma.step.upsert({
    where: { id: 'step-ceo-001' },
    update: {},
    create: {
      id: 'step-ceo-001', workflow_id: expenseWorkflow.id,
      name: 'CEO Approval', step_type: StepType.APPROVAL, order: 3,
      metadata: { assignee_email: 'ceo@halleyx.com', instructions: 'Final approval for high-value expense.' },
    },
  });

  const taskRejection = await prisma.step.upsert({
    where: { id: 'step-reject-001' },
    update: {},
    create: {
      id: 'step-reject-001', workflow_id: expenseWorkflow.id,
      name: 'Task Rejection', step_type: StepType.TASK, order: 4,
      metadata: { action: 'reject', notify_requester: true },
    },
  });

  await prisma.workflow.update({
    where: { id: expenseWorkflow.id },
    data: { start_step_id: managerApproval.id },
  });

  // Rules
  await prisma.rule.deleteMany({ where: { step_id: { in: [managerApproval.id, financeNotification.id, ceoApproval.id, taskRejection.id] } } });

  await prisma.rule.createMany({ data: [
    { step_id: managerApproval.id,      condition: "amount > 100 && country == 'US' && priority == 'High'", next_step_id: financeNotification.id, priority: 1 },
    { step_id: managerApproval.id,      condition: "amount <= 100 || department == 'HR'",                   next_step_id: ceoApproval.id,          priority: 2 },
    { step_id: managerApproval.id,      condition: "priority == 'Low' && country != 'US'",                  next_step_id: taskRejection.id,        priority: 3 },
    { step_id: managerApproval.id,      condition: 'DEFAULT',                                               next_step_id: taskRejection.id,        priority: 4 },
    { step_id: financeNotification.id,  condition: 'amount > 10000',                                        next_step_id: ceoApproval.id,          priority: 1 },
    { step_id: financeNotification.id,  condition: 'DEFAULT',                                               next_step_id: null,                    priority: 2 },
  ]});

  // ─── Workflow 2: Employee Onboarding ──────────────────────────────────────
  const onboardingWorkflow = await prisma.workflow.upsert({
    where: { id: 'workflow-onboard-001' },
    update: {},
    create: {
      id: 'workflow-onboard-001',
      name: 'Employee Onboarding', description: 'Standard onboarding process',
      version: 1, is_active: true,
      input_schema: {
        employee_name: { type: 'string', required: true },
        department:    { type: 'string', required: true },
        role:          { type: 'string', required: true },
        start_date:    { type: 'string', required: true },
      },
    },
  });

  const hrNotif = await prisma.step.upsert({
    where: { id: 'step-hr-notif-001' },
    update: {},
    create: {
      id: 'step-hr-notif-001', workflow_id: onboardingWorkflow.id,
      name: 'HR Notification', step_type: StepType.NOTIFICATION, order: 1,
      metadata: { notification_channel: 'email', template: 'new-hire-alert', recipient: 'manager@halleyx.com' },
    },
  });

  const itSetup = await prisma.step.upsert({
    where: { id: 'step-it-001' },
    update: {},
    create: {
      id: 'step-it-001', workflow_id: onboardingWorkflow.id,
      name: 'IT Setup', step_type: StepType.TASK, order: 2,
      metadata: { action: 'provision_accounts', systems: ['email', 'slack', 'github'] },
    },
  });

  await prisma.workflow.update({ where: { id: onboardingWorkflow.id }, data: { start_step_id: hrNotif.id } });

  await prisma.rule.deleteMany({ where: { step_id: { in: [hrNotif.id, itSetup.id] } } });
  await prisma.rule.createMany({ data: [
    { step_id: hrNotif.id,  condition: 'DEFAULT', next_step_id: itSetup.id, priority: 1 },
    { step_id: itSetup.id,  condition: 'DEFAULT', next_step_id: null,       priority: 1 },
  ]});

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
