import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";
import { ensureDirs } from "./utils/images";

const app = createApp();

void ensureDirs().catch((err) => {
  logger.error("Failed to ensure upload directories", { err });
  process.exit(1);
});

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
