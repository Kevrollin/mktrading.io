import { devCaptchaProvider } from "@/lib/captcha/dev-provider";

export interface CaptchaProvider {
  verify(token: string | undefined): Promise<boolean>;
}

/** Dev mode must be loud about being dev mode: an unrecognized/unconfigured
 * provider throws loudly rather than silently no-op'ing. The honeypot
 * field and rate-limit checks around registration run for real regardless
 * of environment — only this swappable provider verdict is faked in dev. */
export function getCaptchaProvider(): CaptchaProvider {
  const providerName = process.env.CAPTCHA_PROVIDER ?? "dev";
  switch (providerName) {
    case "dev":
      return devCaptchaProvider;
    default:
      throw new Error(
        `Unknown or unconfigured CAPTCHA_PROVIDER "${providerName}". No real CAPTCHA provider is implemented yet — set CAPTCHA_PROVIDER=dev.`,
      );
  }
}
