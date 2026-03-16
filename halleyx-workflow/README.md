# Halleyx — Workflow Engine

A full-stack workflow automation platform that lets users design workflows, define rules, execute processes, and track every step.

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18 + TypeScript + Tailwind CSS            |
| State      | TanStack Query (React Query)                    |
| Backend    | Node.js + Express + TypeScript                  |
| Database   | PostgreSQL + Prisma ORM                         |
| Queue      | Redis + BullMQ                                  |
| Validation | Zod                                             |
| Logging    | Winston                                         |
| DevOps     | Docker + Docker Compose                         |

---

## Quick Start (Docker — Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Git](https://git-scm.com/)

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/halleyx-workflow.git
cd halleyx-workflow
```

### 2. Start all services
```bash
docker-compose up --build
```

### 3. Run database migrations + seed data
Open a new terminal while Docker is running:
```bash
docker exec halleyx_backend npx prisma migrate dev --name init
docker exec halleyx_backend npm run prisma:seed
```

### 4. Open the app
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Health check:** http://localhost:3000/health

---

## Local Development (Without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ running locally
- Redis 7+ running locally

### Backend setup
```bash
cd backend
cp .env.example .env        # edit DATABASE_URL and REDIS_URL if needed
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev                  # starts on http://localhost:3000
```

### Frontend setup
```bash
cd frontend
npm install
npm run dev                  # starts on http://localhost:5173
```

---

## API Reference

### Workflows
| Method | Endpoint              | Description                          |
|--------|-----------------------|--------------------------------------|
| POST   | /api/workflows        | Create workflow                      |
| GET    | /api/workflows        | List workflows (search + pagination) |
| GET    | /api/workflows/:id    | Get workflow with steps & rules      |
| PUT    | /api/workflows/:id    | Update workflow (bumps version)      |
| DELETE | /api/workflows/:id    | Delete workflow                      |

### Steps
| Method | Endpoint                          | Description          |
|--------|-----------------------------------|----------------------|
| POST   | /api/workflows/:workflow_id/steps | Add step             |
| GET    | /api/workflows/:workflow_id/steps | List steps           |
| PUT    | /api/steps/:id                    | Update step          |
| DELETE | /api/steps/:id                    | Delete step          |

### Rules
| Method | Endpoint                   | Description   |
|--------|----------------------------|---------------|
| POST   | /api/steps/:step_id/rules  | Add rule      |
| GET    | /api/steps/:step_id/rules  | List rules    |
| PUT    | /api/rules/:id             | Update rule   |
| DELETE | /api/rules/:id             | Delete rule   |

### Executions
| Method | Endpoint                              | Description               |
|--------|---------------------------------------|---------------------------|
| POST   | /api/workflows/:workflow_id/execute   | Start execution           |
| GET    | /api/executions/:id                   | Get execution + logs      |
| GET    | /api/executions                       | List all executions       |
| POST   | /api/executions/:id/cancel            | Cancel execution          |

---

## Rule Engine

Rules are evaluated in **priority order** (lowest number first). The first matching rule determines the next step.

### Supported operators
- Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `&&` (AND), `||` (OR)
- Special: `DEFAULT` — always matches, used as a fallback catch-all

### Example rule conditions
```
amount > 100 && country == 'US' && priority == 'High'
amount <= 100 || department == 'HR'
priority == 'Low' && country != 'US'
DEFAULT
```

---

## Sample Workflows (included in seed data)

### 1. Expense Approval
- **Input:** `amount (number)`, `country (string)`, `department (string)`, `priority (High|Medium|Low)`
- **Steps:** Manager Approval → Finance Notification → CEO Approval / Task Rejection
- **Rules:** Routes based on amount, country, and priority

### 2. Employee Onboarding
- **Input:** `employee_name`, `department`, `role`, `start_date`
- **Steps:** HR Notification → IT Setup

### Sample execution input
```json
{
  "data": {
    "amount": 250,
    "country": "US",
    "department": "Finance",
    "priority": "High"
  },
  "triggered_by": "user123"
}
```

---

## Project Structure

```
halleyx-workflow/
├── backend/
│   ├── src/
│   │   ├── routes/         # Express route handlers
│   │   ├── services/       # Business logic & rule engine
│   │   ├── utils/          # Logger, Prisma client
│   │   └── index.ts        # App entry point
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── seed.ts         # Sample data
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios client + React Query hooks
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # WorkflowList, WorkflowEditor, ExecutionView, AuditLog
│   │   ├── types/          # TypeScript interfaces
│   │   └── App.tsx         # Routing
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Workflow Engine Design

1. **Execution starts** — a POST to `/execute` creates an Execution record with status `IN_PROGRESS` and begins processing from the workflow's `start_step_id`.

2. **Step processing** — for each step, the rule engine evaluates all rules in priority order against the execution's input data.

3. **Rule matching** — the first rule whose condition evaluates to `true` determines `next_step_id`. If `next_step_id` is null, the workflow ends.

4. **Logging** — every step evaluation (condition string, result, matched rule, timing) is appended to the execution's `logs` array.

5. **Loop protection** — a `MAX_ITERATIONS` guard (default 20) prevents infinite loops.

6. **Completion** — once no next step exists or the iteration limit is reached, the execution is marked `COMPLETED`.
