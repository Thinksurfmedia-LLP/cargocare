-- AlterTable
ALTER TABLE "public"."shipment_assignments" ADD COLUMN     "isOrphaned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isViewOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orphanedAt" TIMESTAMP(3),
ADD COLUMN     "orphanedReason" TEXT;
