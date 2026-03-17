# Halleyx — Workflow Engine

A full-stack workflow automation platform that lets users design workflows, define rules, execute processes, and track every step with role-based access control.

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18 + TypeScript + Tailwind CSS            |
| State      | TanStack Query (React Query v5)                 |
| Backend    | Node.js + Express + TypeScript                  |
| Database   | PostgreSQL + Prisma ORM                         |
| Queue      | Redis + BullMQ                                  |
| Auth       | JWT (JSON Web Tokens)                           |
| Email      | Nodemailer (Ethereal for dev, SMTP for prod)    |
| Validation | Zod                                             |
| Logging    | Winston                                         |
| DevOps     | Docker + Docker Compose                         |

---

## User Roles

| Role             | Permissions |
|------------------|-------------|
| **Employee**     | Submit requests, view own audit log, resubmit rejected requests |
| **Finance Manager** | View all requests, approve/reject, escalate to CEO |
| **CEO**          | View all requests, final approve/reject |

---

## Quick Start (Without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ running locally
- Redis 7+ (Memurai on Windows: https://www.memurai.com)

### 1. Clone the repository
```bash
git clone https://github.com/Thillaiarasu-16/Halleyxproject1.git
cd Halleyxproject1/halleyx-workflow
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run prisma:seed
npm run dev
```
Backend runs at → http://localhost:3000

### 3. Frontend setup (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at → http://localhost:5173

---

## Quick Start (Docker)

### Prerequisites
- Docker Desktop installed and running

```bash
git clone https://github.com/Thillaiarasu-16/Halleyxproject1.git
cd Halleyxproject1/halleyx-workflow
docker-compose up --build
```

Then in a second terminal:
```bash
docker exec halleyx_backend npx prisma migrate dev --name init
docker exec halleyx_backend npm run prisma:seed
```

Open → http://localhost:5173

---

## Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
DATABASE_URL="postgresql://halleyx:halleyx123@localhost:5432/halleyx_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-key"
PORT=3000
NODE_ENV=development

# Optional — real email (leave empty to use Ethereal test emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Halleyx Workflow" <your-email@gmail.com>
```

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
| GET | /api/auth/me | Get current user |

### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/workflows | Create workflow |
| GET | /api/workflows | List workflows (search + pagination) |
| GET | /api/workflows/:id | Get workflow with steps & rules |
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
| POST | /api/executions/:id/resubmit | Resubmit rejected request |
| POST | /api/executions/:id/cancel | Cancel execution |

> All endpoints except `/api/auth/login` and `/api/auth/register` require `Authorization: Bearer <token>` header.

---

## Rule Engine

Rules are evaluated in **priority order** (lowest number first). The first matching rule determines the next step.

### Supported operators
| Type | Operators |
|------|-----------|
| Comparison | `==`, `!=`, `<`, `>`, `<=`, `>=` |
| Logical | `&&` (AND), `\|\|` (OR) |
| Fallback | `DEFAULT` — always matches, used as catch-all |

### Example rule conditions
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

**Steps & Rules:**

| Step | Type | Rules |
|------|------|-------|
| Manager Approval | APPROVAL | amount > 100 && country == 'US' && priority == 'High' → Finance Notification |
| | | amount <= 100 \|\| department == 'HR' → CEO Approval |
| | | priority == 'Low' && country != 'US' → Task Rejection |
| | | DEFAULT → Task Rejection |
| Finance Notification | NOTIFICATION | amount > 10000 → CEO Approval |
| | | DEFAULT → End |
| CEO Approval | APPROVAL | DEFAULT → End |
| Task Rejection | TASK | DEFAULT → End |

---

### 2. Employee Onboarding

**Input Schema:**
```json
{
  "employee_name": { "type": "string", "required": true },
  "department":    { "type": "string", "required": true },
  "role":          { "type": "string", "required": true },
  "start_date":    { "type": "string", "required": true }
}
```

**Steps:** HR Notification → IT Setup

---

## Execution Example

### Step 1 — Employee submits request

**POST** `/api/workflows/workflow-expense-001/execute`

Headers:
```
Authorization: Bearer <employee_jwt_token>
```

Request body:
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
  "workflow_id": "workflow-expense-001",
  "workflow_version": 1,
  "request_version": 1,
  "status": "PENDING",
  "current_step_id": "step-manager-001",
  "triggered_by_id": "employee-uuid",
  "started_at": "2026-03-17T10:00:00Z"
}
```

---

### Step 2 — Execution pauses at Manager Approval

**GET** `/api/executions/exec-uuid-001`

Response:
```json
{
  "id": "exec-uuid-001",
  "status": "PENDING",
  "request_version": 1,
  "logs": [
    {
      "step_name": "Manager Approval",
      "step_type": "APPROVAL",
      "status": "awaiting_approval",
      "assignee_email": "manager@halleyx.com",
      "instructions": "Review and approve or reject this expense request.",
      "started_at": "2026-03-17T10:00:00Z",
      "ended_at": null,
      "approval_action": null,
      "approver": null
    }
  ]
}
```

---

### Step 3 — Finance Manager approves

**POST** `/api/executions/exec-uuid-001/approve`

Headers:
```
Authorization: Bearer <manager_jwt_token>
```

Request body:
```json
{
  "approver": "Bob Manager",
  "comment": "Approved — within budget for this quarter."
}
```

Response:
```json
{
  "message": "Approved — execution resumed"
}
```

---

### Step 4 — Execution completes (Finance Notification sent)

**GET** `/api/executions/exec-uuid-001`

Response:
```json
{
  "id": "exec-uuid-001",
  "status": "COMPLETED",
  "request_version": 1,
  "logs": [
    {
      "step_name": "Manager Approval",
      "step_type": "APPROVAL",
      "status": "awaiting_approval",
      "approval_action": "approved",
      "approver": "Bob Manager",
      "approval_comment": "Approved — within budget for this quarter.",
      "approved_at": "2026-03-17T10:05:00Z",
      "started_at": "2026-03-17T10:00:00Z"
    },
    {
      "step_name": "Finance Notification",
      "step_type": "NOTIFICATION",
      "status": "completed",
      "evaluated_rules": [
        { "rule": "amount > 10000", "result": false },
        { "rule": "DEFAULT", "result": true }
      ],
      "matched_rule": "DEFAULT",
      "selected_next_step": null,
      "notification_sent": true,
      "notification_channel": "email",
      "notification_recipient": "manager@halleyx.com",
      "started_at": "2026-03-17T10:05:01Z",
      "ended_at": "2026-03-17T10:05:02Z",
      "duration_ms": 1240
    }
  ],
  "ended_at": "2026-03-17T10:05:02Z"
}
```

---

### Step 5 — Rejection and resubmit flow

If the manager rejects:

**POST** `/api/executions/exec-uuid-001/reject`
```json
{
  "approver": "Bob Manager",
  "comment": "Amount exceeds department budget. Please reduce."
}
```

Employee resubmits with corrected data — **version increments to r2:**

**POST** `/api/executions/exec-uuid-001/resubmit`
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
  "status": "PENDING",
  "parent_id": "exec-uuid-001"
}
```

---

## Project Structure

```
halleyx-workflow/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts          # Login, register, me
│   │   │   ├── workflows.ts     # Workflow CRUD
│   │   │   ├── steps.ts         # Step CRUD
│   │   │   ├── rules.ts         # Rule CRUD
│   │   │   └── executions.ts    # Execution engine + approve/reject/resubmit
│   │   ├── services/
│   │   │   ├── ruleEngine.ts    # Priority-based condition evaluator
│   │   │   └── notificationService.ts  # Email via Nodemailer
│   │   ├── middleware/
│   │   │   └── auth.ts          # JWT auth + role guard
│   │   └── utils/
│   │       ├── prisma.ts        # Prisma client singleton
│   │       └── logger.ts        # Winston logger
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   └── seed.ts              # Demo users + sample workflows
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts        # Axios + auto auth header
│   │   │   └── hooks.ts         # React Query hooks
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # JWT auth state
│   │   ├── components/
│   │   │   └── ui.tsx           # StatusBadge, Spinner, PageHeader etc.
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx    # Login with demo accounts
│   │   │   ├── WorkflowList.tsx # Workflow list + Send Request / Execute
│   │   │   ├── WorkflowEditor.tsx  # Create/edit workflows, steps, rules
│   │   │   ├── ExecutionView.tsx   # Execution details + approve/reject/resubmit
│   │   │   └── AuditLog.tsx     # Role-filtered execution history
│   │   └── types/
│   │       └── index.ts         # Shared TypeScript interfaces
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Workflow Engine Design

1. **Request submitted** — Employee POSTs to `/execute`. Execution record created with status `IN_PROGRESS`.
2. **Step processing** — Engine processes each step sequentially starting from `start_step_id`.
3. **APPROVAL step** — Execution pauses (`PENDING`). Waits for Finance Manager or CEO to approve/reject via UI.
4. **NOTIFICATION step** — Sends email via Nodemailer and continues to next step.
5. **TASK step** — Evaluates rules and moves to next step.
6. **Rule matching** — Rules evaluated in priority order. First matching condition determines `next_step_id`. `DEFAULT` is the fallback.
7. **Rejection flow** — Employee receives rejection note and can resubmit with corrected data. Version increments (r1 → r2 → r3).
8. **Loop protection** — `MAX_ITERATIONS = 20` prevents infinite loops.
9. **Completion** — When no next step exists, execution marked `COMPLETED`.

---

## Evaluation Criteria

| Criteria | Weight | Status |
|----------|--------|--------|
| Backend / APIs — Workflow, Steps, Rules CRUD + Execution | 20% | ✅ Complete |
| Rule Engine — Dynamic rules, branching, error handling | 20% | ✅ Complete |
| Workflow Execution — Step execution, approvals, notifications, logging | 20% | ✅ Complete |
| Frontend / UI — Workflow editor, step/rule editor, execution view | 15% | ✅ Complete |
| Demo Video — Shows workflow creation, rules, execution, logs | 10% | ⬜ Record |
| Code Quality — Readable, modular, maintainable | 5% | ✅ Complete |
| Documentation — README, setup instructions, sample workflows | 5% | ✅ Complete |
| Bonus — Extra features, advanced UI, automated tests | 5% | ✅ Role-based auth, versioning, email notifications |
