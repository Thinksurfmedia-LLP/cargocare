-- DropForeignKey
ALTER TABLE "public"."shipment_plans" DROP CONSTRAINT "shipment_plans_salesPersonId_fkey";

-- CreateTable
CREATE TABLE "public"."sales_persons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_persons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_persons_name_key" ON "public"."sales_persons"("name");

-- AddForeignKey
ALTER TABLE "public"."shipment_plans" ADD CONSTRAINT "shipment_plans_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "public"."sales_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
