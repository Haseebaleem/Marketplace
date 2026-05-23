import { Router } from "express";
import { prisma } from "../config/prisma";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch {
    dbConnected = false;
  }
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? "ok" : "degraded",
    dbConnected,
    timestamp: new Date().toISOString(),
  });
});
