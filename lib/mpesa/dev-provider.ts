import type { InitiateStkPushParams, InitiateStkPushResult, MpesaProvider } from "@/lib/mpesa/provider";

/** Always "succeeds" immediately with a fake reference — the simulated
 * STK-push approval delay lives in the state machine (readyToConfirmAt),
 * not here, since a real Daraja call itself is fast; it's the customer
 * approving the prompt on their phone that takes time. */
export const devMpesaProvider: MpesaProvider = {
  async initiateStkPush(params: InitiateStkPushParams): Promise<InitiateStkPushResult> {
    console.log(
      `[dev mpesa] STK push simulated: phone=${params.phone} amount=${params.amount} ref=${params.accountReference}`,
    );
    return { providerReference: `DEV-${crypto.randomUUID()}` };
  },
};
