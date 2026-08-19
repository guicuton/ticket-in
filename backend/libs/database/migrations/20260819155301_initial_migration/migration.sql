-- CreateEnum
CREATE TYPE "TICKET_PRIORITY" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TICKET_STATE" AS ENUM ('NEW', 'IN_PROGRESS', 'ESCALATED', 'WAITING_FEEDBACK', 'RESOLVED');

-- CreateEnum
CREATE TYPE "LOGIN_ROLE" AS ENUM ('USER', 'MASTER', 'ADMIN');

-- CreateTable
CREATE TABLE "logins" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "password" VARCHAR(60) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "LOGIN_ROLE" NOT NULL DEFAULT 'USER',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logins_assigned_areas" (
    "area_id" TEXT NOT NULL,
    "login_id" TEXT NOT NULL,

    CONSTRAINT "logins_assigned_areas_pkey" PRIMARY KEY ("login_id","area_id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "alias" VARCHAR(100) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "area_id" TEXT,
    "requester_login_id" TEXT NOT NULL,
    "responser_login_id" TEXT,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TICKET_PRIORITY" NOT NULL DEFAULT 'NORMAL',
    "state" "TICKET_STATE" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "login_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "logins_username_key" ON "logins"("username");

-- CreateIndex
CREATE UNIQUE INDEX "logins_email_key" ON "logins"("email");

-- CreateIndex
CREATE INDEX "logins_username_idx" ON "logins"("username");

-- CreateIndex
CREATE INDEX "logins_email_idx" ON "logins"("email");

-- CreateIndex
CREATE INDEX "logins_assigned_areas_area_id_idx" ON "logins_assigned_areas"("area_id");

-- CreateIndex
CREATE INDEX "tickets_area_id_state_idx" ON "tickets"("area_id", "state");

-- CreateIndex
CREATE INDEX "tickets_area_id_priority_idx" ON "tickets"("area_id", "priority");

-- CreateIndex
CREATE INDEX "tickets_responser_login_id_state_idx" ON "tickets"("responser_login_id", "state");

-- CreateIndex
CREATE INDEX "tickets_responser_login_id_priority_idx" ON "tickets"("responser_login_id", "priority");

-- CreateIndex
CREATE INDEX "tickets_requester_login_id_idx" ON "tickets"("requester_login_id");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "logins_assigned_areas" ADD CONSTRAINT "logins_assigned_areas_login_id_fkey" FOREIGN KEY ("login_id") REFERENCES "logins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logins_assigned_areas" ADD CONSTRAINT "logins_assigned_areas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_responser_login_id_fkey" FOREIGN KEY ("responser_login_id") REFERENCES "logins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_login_id_fkey" FOREIGN KEY ("requester_login_id") REFERENCES "logins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_login_id_fkey" FOREIGN KEY ("login_id") REFERENCES "logins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
