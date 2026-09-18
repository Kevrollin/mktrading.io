import type { CaptchaProvider } from "@/lib/captcha/provider";

export const devCaptchaProvider: CaptchaProvider = {
  async verify() {
    return true;
  },
};
