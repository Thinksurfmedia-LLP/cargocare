/*
  Warnings:

  - A unique constraint covering the columns `[shipmentAssignmentId]` on the table `shipment_plans` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."shipment_plans" ADD COLUMN     "shipmentAssignmentId" TEXT;

-- CreateTable
CREATE TABLE "public"."shipment_assignments" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "assignBookingId" TEXT,
    "shipmentPlanId" TEXT,
    "pdfFilePath" TEXT,

    CONSTRAINT "shipment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipment_plans_shipmentAssignmentId_key" ON "public"."shipment_plans"("shipmentAssignmentId");

-- AddForeignKey
ALTER TABLE "public"."shipment_plans" ADD CONSTRAINT "shipment_plans_shipmentAssignmentId_fkey" FOREIGN KEY ("shipmentAssignmentId") REFERENCES "public"."shipment_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shipment_assignments" ADD CONSTRAINT "shipment_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
