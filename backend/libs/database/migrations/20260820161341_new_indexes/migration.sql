-- CreateIndex
CREATE INDEX "areas_alias_idx" ON "areas"("alias");

-- CreateIndex
CREATE INDEX "areas_created_at_idx" ON "areas"("created_at");

-- CreateIndex
CREATE INDEX "logins_role_idx" ON "logins"("role");

-- CreateIndex
CREATE INDEX "logins_created_at_idx" ON "logins"("created_at");

-- CreateIndex
CREATE INDEX "logins_updated_at_idx" ON "logins"("updated_at");

-- CreateIndex
CREATE INDEX "ticket_messages_login_id_created_at_idx" ON "ticket_messages"("login_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_messages_created_at_idx" ON "ticket_messages"("created_at");
