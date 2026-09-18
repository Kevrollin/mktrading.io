import type { NotificationType } from "@/lib/db/schema";
import { devEmailProvider } from "@/lib/email/dev-provider";

export interface SendEmailParams {
  userId: string;
  to: string;
  type: NotificationType;
  subject: string;
  body: string;
  link?: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<void>;
}

/** Dev mode must be loud about being dev mode: an unrecognized/unconfigured
 * provider throws loudly rather than silently no-op'ing. */
export function getEmailProvider(): EmailProvider {
  const providerName = process.env.EMAIL_PROVIDER ?? "dev";
  switch (providerName) {
    case "dev":
      return devEmailProvider;
    default:
      throw new Error(
        `Unknown or unconfigured EMAIL_PROVIDER "${providerName}". No real email provider is implemented yet — set EMAIL_PROVIDER=dev.`,
      );
  }
}
