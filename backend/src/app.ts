import express from "express";
import cors from "cors";
import helmet from "helmet";
import { corsOrigins } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
