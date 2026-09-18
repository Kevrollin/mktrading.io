import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import type { EmailProvider, SendEmailParams } from "@/lib/email/provider";

/** Logs to the console AND writes into the notifications row already
 * being inserted, so a verification/reset link can be retrieved two
 * independent ways during development without a real mailbox: the
 * terminal, or the /dev/inbox page. */
export const devEmailProvider: EmailProvider = {
  async send(params: SendEmailParams) {
    console.log(
      `[dev email] to=${params.to} subject="${params.subject}"${params.link ? ` link=${params.link}` : ""}`,
    );

    await db.insert(notifications).values({
      userId: params.userId,
      type: params.type,
      payload: {
        to: params.to,
        subject: params.subject,
        body: params.body,
        link: params.link ?? null,
      },
    });
  },
};
