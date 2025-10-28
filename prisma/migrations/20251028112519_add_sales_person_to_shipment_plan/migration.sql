-- AlterTable
ALTER TABLE "public"."shipment_plans" ADD COLUMN     "salesPersonId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."shipment_plans" ADD CONSTRAINT "shipment_plans_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
