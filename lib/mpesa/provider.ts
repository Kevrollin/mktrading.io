import { devMpesaProvider } from "@/lib/mpesa/dev-provider";

export interface InitiateStkPushParams {
  userId: string;
  phone: string;
  amount: string;
  accountReference: string;
}

export interface InitiateStkPushResult {
  providerReference: string;
}

export interface MpesaProvider {
  initiateStkPush(params: InitiateStkPushParams): Promise<InitiateStkPushResult>;
}

/**
 * Dev mode must be loud about being dev mode: an unrecognized/unconfigured
 * provider throws loudly rather than silently no-op'ing (same convention
 * as getEmailProvider/getCaptchaProvider).
 *
 * A real Safaricom Daraja implementation needs more than new credentials
 * here — the real STK-push flow is synchronous-ack/async-callback (Daraja
 * calls back a webhook once the customer approves on their phone), while
 * the dev provider sidesteps that entirely by simulating the delay with a
 * timer (see lib/deposits/state-machine.ts's readyToConfirmAt). A real
 * provider would need a webhook route that calls the same confirmation
 * core the lazy-settlement path calls, not just this initiate() call.
 */
export function getMpesaProvider(): MpesaProvider {
  const providerName = process.env.MPESA_PROVIDER ?? "dev";
  switch (providerName) {
    case "dev":
      return devMpesaProvider;
    default:
      throw new Error(
        `Unknown or unconfigured MPESA_PROVIDER "${providerName}". No real Safaricom Daraja provider is implemented yet — set MPESA_PROVIDER=dev.`,
      );
  }
}
