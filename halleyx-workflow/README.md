# Halleyx — Workflow Engine

A full-stack workflow automation platform with role-based access control, multi-level approvals, email notifications, and async message queuing via RabbitMQ.

---

## Tech Stack

| Layer         | Technology                                        |
|---------------|---------------------------------------------------|
| Frontend      | React 18 + TypeScript + Tailwind CSS              |
| State         | TanStack Query (React Query v5)                   |
| Backend       | Node.js + Express + TypeScript                    |
| Database      | PostgreSQL + Prisma ORM                           |
| Message Queue | RabbitMQ (amqplib) with direct fallback           |
| Auth          | JWT (JSON Web Tokens)                             |
| Email         | Nodemailer (Ethereal for dev, SMTP for prod)      |
| Validation    | Zod                                               |
| Logging       | Winston                                           |
| DevOps        | Docker + Docker Compose                           |

---

## User Roles

| Role              | What they can do |
|-------------------|------------------|
| **Employee**      | Submit requests, view own audit log, resubmit rejected requests |
| **Finance Manager** | View all requests, approve/reject, escalate to CEO via rules |
| **CEO**           | Final approve/reject on escalated requests |

---

## Features

- **Workflow Builder** — create workflows with steps (Task, Approval, Notification) and priority-based rules
- **Rule Engine** — dynamic condition evaluation (`amount > 100 && country == 'US'`) at runtime
- **Multi-level Approvals** — execution pauses at approval steps, resumes after human action
- **Request Versioning** — rejected requests can be resubmitted; version increments (r1 → r2 → r3)
- **Email Notifications** — automatic emails when requests are submitted, approved, or rejected
- **RabbitMQ Queues** — async step execution and notification delivery via message queues
- **Role-based Audit Log** — employees see own requests; managers/CEO see all
- **JWT Authentication** — secure login with role-based route protection

---

## RabbitMQ Architecture

```
Employee submits request
        ↓
Backend publishes → [halleyx.execute_step] queue
        ↓
Worker processes steps
        ↓
Hits APPROVAL step → pauses execution
        ↓
Publishes → [halleyx.approval_notify] queue
        ↓
Worker sends email to Finance Manager / CEO
        ↓
Manager approves → publishes → [halleyx.execute_step] again
        ↓
Also publishes → [halleyx.decision_notify] queue
        ↓
Worker sends Approved/Rejected email to Employee
```

**Three queues:**
| Queue | Purpose |
|-------|---------|
| `halleyx.execute_step` | Async workflow step execution |
| `halleyx.approval_notify` | Email to approver when step is pending |
| `halleyx.decision_notify` | Email to employee after approve/reject |

> **Graceful fallback** — if RabbitMQ is unavailable, all operations run directly without queuing. The system works with or without RabbitMQ running.

---

## Quick Start (Without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ running locally
- Redis 7+ (Memurai on Windows: https://www.memurai.com)
- RabbitMQ (optional — https://www.rabbitmq.com/download.html)

### 1. Clone the repository
```bash
git clone https://github.com/Thillaiarasu-16/Halleyxproject1.git
cd Halleyxproject1/halleyx-workflow
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env       # edit with your DB credentials
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run prisma:seed
npm run dev
```
Backend → http://localhost:3000

### 3. Frontend setup (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Frontend → http://localhost:5173

---

## Quick Start (Docker)

### Prerequisites
- Docker Desktop installed and running

```bash
git clone https://github.com/Thillaiarasu-16/Halleyxproject1.git
cd Halleyxproject1/halleyx-workflow
docker-compose up --build
```

In a second terminal:
```bash
docker exec halleyx_backend npx prisma migrate dev --name init
docker exec halleyx_backend npm run prisma:seed
```

Open → http://localhost:5173

RabbitMQ Management UI → http://localhost:15672 (user: `halleyx` / pass: `halleyx123`)

---

## Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
# Database
DATABASE_URL="postgresql://halleyx:halleyx123@localhost:5432/halleyx_db"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
JWT_SECRET="your-super-secret-key"
PORT=3000
NODE_ENV=development

# RabbitMQ (optional — system falls back to direct mode if not set)
RABBITMQ_URL=amqp://localhost:5672

# Email — leave empty to use Ethereal test emails (visible at ethereal.email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-digit-app-password
SMTP_FROM="Halleyx Workflow" <your-gmail@gmail.com>
```

> For Gmail SMTP: Go to `myaccount.google.com/apppasswords` → create an App Password → use the 16-character code as `SMTP_PASS`.

---

## Demo Accounts (after seeding)

| Email | Password | Role |
|-------|----------|------|
| employee@halleyx.com | password123 | Employee |
| manager@halleyx.com | password123 | Finance Manager |
| ceo@halleyx.com | password123 | CEO |

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login → returns JWT token |
| GET | /api/auth/me | Get current user info |

> All other endpoints require `Authorization: Bearer <token>` header.

### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/workflows | Create workflow |
| GET | /api/workflows | List workflows (search + pagination) |
| GET | /api/workflows/:id | Get workflow with steps and rules |
| PUT | /api/workflows/:id | Update workflow (bumps version) |
| DELETE | /api/workflows/:id | Delete workflow |

### Steps
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/workflows/:workflow_id/steps | Add step |
| GET | /api/workflows/:workflow_id/steps | List steps |
| PUT | /api/steps/:id | Update step |
| DELETE | /api/steps/:id | Delete step |

### Rules
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/steps/:step_id/rules | Add rule |
| GET | /api/steps/:step_id/rules | List rules |
| PUT | /api/rules/:id | Update rule |
| DELETE | /api/rules/:id | Delete rule |

### Executions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/workflows/:workflow_id/execute | Start execution |
| GET | /api/executions | List executions (role-filtered) |
| GET | /api/executions/:id | Get execution + logs |
| POST | /api/executions/:id/approve | Approve pending step |
| POST | /api/executions/:id/reject | Reject pending step |
| POST | /api/executions/:id/resubmit | Resubmit rejected request (version++) |
| POST | /api/executions/:id/cancel | Cancel execution |

---

## Rule Engine

Rules are evaluated in **priority order** (lowest number first). First matching rule wins.

### Supported operators
| Type | Operators |
|------|-----------|
| Comparison | `==`, `!=`, `<`, `>`, `<=`, `>=` |
| Logical | `&&` (AND), `\|\|` (OR) |
| Fallback | `DEFAULT` — always matches, used as catch-all |

### Example conditions
```
amount > 100 && country == 'US' && priority == 'High'
amount <= 100 || department == 'HR'
priority == 'Low' && country != 'US'
DEFAULT
```

---

## Sample Workflows

### 1. Expense Approval

**Input Schema:**
```json
{
  "amount":     { "type": "number", "required": true },
  "country":    { "type": "string", "required": true },
  "department": { "type": "string", "required": false },
  "priority":   { "type": "string", "required": true, "allowed_values": ["High", "Medium", "Low"] }
}
```

**Steps and Rules:**

| Step | Type | Priority | Condition | Next Step |
|------|------|----------|-----------|-----------|
| Manager Approval | APPROVAL | 1 | `amount > 100 && country == 'US' && priority == 'High'` | Finance Notification |
| | | 2 | `amount <= 100 \|\| department == 'HR'` | CEO Approval |
| | | 3 | `priority == 'Low' && country != 'US'` | Task Rejection |
| | | 4 | `DEFAULT` | Task Rejection |
| Finance Notification | NOTIFICATION | 1 | `amount > 10000` | CEO Approval |
| | | 2 | `DEFAULT` | End |
| CEO Approval | APPROVAL | 1 | `DEFAULT` | End |
| Task Rejection | TASK | 1 | `DEFAULT` | End |

### 2. Employee Onboarding

**Input:** `employee_name`, `department`, `role`, `start_date`

**Steps:** HR Notification → IT Setup

---

## Execution Example

### Full flow — Employee submits, Manager approves

**Step 1 — Employee submits**

`POST /api/workflows/workflow-expense-001/execute`
```json
{
  "data": {
    "amount": 250,
    "country": "US",
    "department": "Finance",
    "priority": "High"
  }
}
```

Response:
```json
{
  "id": "exec-uuid-001",
  "status": "IN_PROGRESS",
  "request_version": 1,
  "started_at": "2026-03-17T10:00:00Z"
}
```

→ RabbitMQ publishes to `halleyx.execute_step`

→ Worker processes → hits Manager Approval → pauses

→ Email sent to `manager@halleyx.com` via `halleyx.approval_notify` queue

---

**Step 2 — Execution paused**

`GET /api/executions/exec-uuid-001`
```json
{
  "status": "PENDING",
  "logs": [{
    "step_name": "Manager Approval",
    "step_type": "APPROVAL",
    "status": "awaiting_approval",
    "assignee_email": "manager@halleyx.com",
    "approval_action": null
  }]
}
```

---

**Step 3 — Manager approves**

`POST /api/executions/exec-uuid-001/approve`
```json
{
  "approver": "Bob Manager",
  "comment": "Approved — within budget."
}
```

→ RabbitMQ publishes to `halleyx.execute_step` to resume

→ Employee receives approval email via `halleyx.decision_notify` queue

---

**Step 4 — Execution completes**

```json
{
  "status": "COMPLETED",
  "logs": [
    {
      "step_name": "Manager Approval",
      "status": "awaiting_approval",
      "approval_action": "approved",
      "approver": "Bob Manager",
      "approved_at": "2026-03-17T10:05:00Z"
    },
    {
      "step_name": "Finance Notification",
      "status": "completed",
      "notification_sent": true,
      "notification_recipient": "manager@halleyx.com",
      "evaluated_rules": [
        { "rule": "amount > 10000", "result": false },
        { "rule": "DEFAULT", "result": true }
      ],
      "matched_rule": "DEFAULT",
      "duration_ms": 1240
    }
  ]
}
```

---

### Rejection and resubmit flow

Manager rejects:
```json
{ "approver": "Bob Manager", "comment": "Amount exceeds budget. Please reduce." }
```

Employee resubmits with corrections — **version becomes r2:**

`POST /api/executions/exec-uuid-001/resubmit`
```json
{
  "data": {
    "amount": 80,
    "country": "US",
    "department": "Finance",
    "priority": "Low"
  }
}
```

Response:
```json
{
  "id": "exec-uuid-002",
  "request_version": 2,
  "status": "IN_PROGRESS",
  "parent_id": "exec-uuid-001"
}
```

---

## Email Notifications

| Event | Recipient | Subject |
|-------|-----------|---------|
| Request submitted → reaches approval step | Finance Manager | `Action Required: Expense Approval — Manager Approval` |
| Request escalated → reaches CEO step | CEO | `Action Required: Expense Approval — CEO Approval` |
| Manager approves | Employee | `Request Approved ✅ — Expense Approval` |
| Manager rejects | Employee | `Request Rejected ❌ — Expense Approval` |
| CEO approves | Employee | `Request Approved ✅ — Expense Approval` |
| CEO rejects | Employee | `Request Rejected ❌ — Expense Approval` |

> During development, emails are sent to **Ethereal** (fake inbox). Check the backend terminal for a preview URL like `https://ethereal.email/message/xxxx`.

---

## Project Structure

```
halleyx-workflow/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts              # Login, register, me
│   │   │   ├── workflows.ts         # Workflow CRUD
│   │   │   ├── steps.ts             # Step CRUD
│   │   │   ├── rules.ts             # Rule CRUD
│   │   │   └── executions.ts        # Execution engine + approve/reject/resubmit
│   │   ├── services/
│   │   │   ├── ruleEngine.ts        # Priority-based condition evaluator
│   │   │   ├── notificationService.ts  # Email via Nodemailer
│   │   │   └── rabbitMQ.ts          # RabbitMQ connection, publish, consumers
│   │   ├── middleware/
│   │   │   └── auth.ts              # JWT auth + role guard
│   │   └── utils/
│   │       ├── prisma.ts            # Prisma client singleton
│   │       └── logger.ts            # Winston logger
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema
│   │   └── seed.ts                  # Demo users + sample workflows
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts            # Axios + auto auth token header
│   │   │   └── hooks.ts             # React Query hooks
│   │   ├── context/
│   │   │   └── AuthContext.tsx      # JWT auth state + login/logout
│   │   ├── components/
│   │   │   └── ui.tsx               # StatusBadge, Spinner, PageHeader etc.
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx        # Login with demo accounts
│   │   │   ├── WorkflowList.tsx     # Workflows + Send Request / Execute
│   │   │   ├── WorkflowEditor.tsx   # Create/edit workflows, steps, rules
│   │   │   ├── ExecutionView.tsx    # Execution details + approve/reject/resubmit
│   │   │   └── AuditLog.tsx         # Role-filtered execution history
│   │   └── types/
│   │       └── index.ts             # Shared TypeScript interfaces
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Workflow Engine Design

1. **Request submitted** — Employee POSTs to `/execute`. Execution record created.
2. **Published to RabbitMQ** — `halleyx.execute_step` queue receives the job.
3. **Worker picks up** — processes steps sequentially from `start_step_id`.
4. **APPROVAL step** — execution pauses (`PENDING`). Email sent to assignee via `halleyx.approval_notify`.
5. **NOTIFICATION step** — email sent via Nodemailer, continues to next step.
6. **TASK step** — evaluates rules, moves to next step.
7. **Rule matching** — rules evaluated in priority order. First match wins. `DEFAULT` is the fallback.
8. **Approve/Reject** — manager action resumes or ends execution. Employee notified via `halleyx.decision_notify`.
9. **Rejection + resubmit** — employee corrects data and resubmits. Version increments (r1 → r2 → r3).
10. **Loop protection** — `MAX_ITERATIONS = 20` prevents infinite loops.
11. **Completion** — when no next step exists, execution marked `COMPLETED`.

---

## Evaluation Criteria

| Criteria | Weight | Status |
|----------|--------|--------|
| Backend / APIs — Workflow, Steps, Rules CRUD + Execution | 20% | ✅ Complete |
| Rule Engine — Dynamic rules, priority, error handling | 20% | ✅ Complete |
| Workflow Execution — Steps, approvals, notifications, logging | 20% | ✅ Complete |
| Frontend / UI — Workflow editor, step/rule editor, execution view | 15% | ✅ Complete |
| Demo Video — Shows workflow creation, rules, execution, logs | 10% | ✅ Record |
| Code Quality — Readable, modular, maintainable | 5% | ✅ Complete |
| Documentation — README, setup, sample workflows | 5% | ✅ Complete |
| Bonus — Extra features, advanced UI, automated tests | 5% | ✅ Role-based auth, versioning, email notifications, RabbitMQ |

## Demo video
  Link : 