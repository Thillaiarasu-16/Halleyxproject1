-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EMPLOYEE', 'FINANCE_MANAGER', 'CEO');

-- AlterTable
ALTER TABLE "executions" ADD COLUMN     "parent_id" TEXT,
ADD COLUMN     "rejection_note" TEXT,
ADD COLUMN     "request_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "triggered_by_id" TEXT;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
