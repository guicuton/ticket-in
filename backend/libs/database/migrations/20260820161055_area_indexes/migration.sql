-- CreateIndex
CREATE INDEX "tickets_subject_idx" ON "tickets"("subject");

-- CreateIndex
CREATE INDEX "tickets_priority_idx" ON "tickets"("priority");

-- CreateIndex
CREATE INDEX "tickets_state_idx" ON "tickets"("state");

-- CreateIndex
CREATE INDEX "tickets_created_at_idx" ON "tickets"("created_at");

-- CreateIndex
CREATE INDEX "tickets_updated_at_idx" ON "tickets"("updated_at");

-- CreateIndex
CREATE INDEX "tickets_area_id_created_at_idx" ON "tickets"("area_id", "created_at");

-- CreateIndex
CREATE INDEX "tickets_area_id_updated_at_idx" ON "tickets"("area_id", "updated_at");

-- CreateIndex
CREATE INDEX "tickets_area_id_subject_idx" ON "tickets"("area_id", "subject");
