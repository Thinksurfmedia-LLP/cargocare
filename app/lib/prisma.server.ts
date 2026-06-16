import { PrismaClient } from "@prisma/client";

declare global {
  var __db__: PrismaClient;
}

function trimStringFields(data: unknown): unknown {
  if (typeof data === "string") return data.trim();
  if (Array.isArray(data)) return data.map(trimStringFields);
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, trimStringFields(v)])
    );
  }
  return data;
}

function createPrismaClient() {
  const client = new PrismaClient();
  client.$use(async (params, next) => {
    if (params.action === "create" || params.action === "update" || params.action === "upsert") {
      if (params.args?.data) {
        params.args.data = trimStringFields(params.args.data) as typeof params.args.data;
      }
    }
    return next(params);
  });
  return client;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = createPrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = createPrismaClient();
  }
  prisma = global.__db__;
  prisma.$connect();
}

export { prisma };
