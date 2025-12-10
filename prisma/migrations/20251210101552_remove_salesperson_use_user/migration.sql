/*
  Warnings:

  - You are about to drop the `sales_persons` table. If the table is not empty, all the data it contains will be lost.
  - salesPersonId will be migrated to reference users table instead.

*/
-- DropForeignKey
ALTER TABLE "public"."shipment_plans" DROP CONSTRAINT "shipment_plans_salesPersonId_fkey";

-- Migrate salesPersonId: Update to matching user id by name, or set to NULL if no match
UPDATE "public"."shipment_plans" sp
SET "salesPersonId" = (
    SELECT u.id 
    FROM "public"."users" u 
    INNER JOIN "public"."sales_persons" s ON u.name = s.name 
    WHERE s.id = sp."salesPersonId"
)
WHERE sp."salesPersonId" IS NOT NULL;

-- Set any remaining salesPersonId values to NULL (where no matching user was found)
UPDATE "public"."shipment_plans" sp
SET "salesPersonId" = NULL
WHERE sp."salesPersonId" IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM "public"."users" u WHERE u.id = sp."salesPersonId"
  );

-- DropTable
DROP TABLE "public"."sales_persons";

-- AddForeignKey
ALTER TABLE "public"."shipment_plans" ADD CONSTRAINT "shipment_plans_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
