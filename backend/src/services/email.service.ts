import { prisma } from "../config/prisma";
import { logger } from "../config/logger";

export interface EmailEnqueueInput {
  to: string;
  subject: string;
  body: string;
}

/**
 * Enqueue an email for later delivery. The actual sending happens via a
 * background processor (Phase 4) that reads PENDING rows and dispatches
 * through Nodemailer/Mailtrap.
 */
export const enqueueEmail = async (input: EmailEnqueueInput): Promise<void> => {
  try {
    await prisma.emailQueue.create({ data: input });
  } catch (err) {
    // Enqueueing must not break the originating request — log and continue.
    logger.error("Failed to enqueue email", {
      err: err instanceof Error ? err.message : err,
      to: input.to,
      subject: input.subject,
    });
  }
};

export const welcomeEmail = (name: string, role: string): EmailEnqueueInput => ({
  to: "", // caller fills in `to`
  subject: "Welcome to Marketplace",
  body: `Hi ${name},

Welcome to Marketplace! Your account has been created as a ${role.toLowerCase()}.

You can sign in any time at the dashboard. If you didn't sign up, please ignore this message.

— The Marketplace team`,
});
