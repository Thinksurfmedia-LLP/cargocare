-- CreateEnum
CREATE TYPE "public"."IndividualUnmappingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."individual_equipment_unmapping_requests" (
    "id" TEXT NOT NULL,
    "shipmentPlanId" TEXT NOT NULL,
    "equipmentIndex" INTEGER NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "linerBookingNumber" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "public"."IndividualUnmappingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "approvalReason" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_equipment_unmapping_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."individual_equipment_unmapping_requests" ADD CONSTRAINT "individual_equipment_unmapping_requests_shipmentPlanId_fkey" FOREIGN KEY ("shipmentPlanId") REFERENCES "public"."shipment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."individual_equipment_unmapping_requests" ADD CONSTRAINT "individual_equipment_unmapping_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."individual_equipment_unmapping_requests" ADD CONSTRAINT "individual_equipment_unmapping_requests_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."individual_equipment_unmapping_requests" ADD CONSTRAINT "individual_equipment_unmapping_requests_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
