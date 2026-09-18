import { z } from "zod";
import { containsPersonalInfo, passwordSchema } from "@/lib/auth/password";

// Present on every form as a honeypot: real users never fill this in.
const honeypot = z
  .string()
  .max(0, "Leave this field empty.")
  .optional()
  .or(z.literal(""));

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(320),
    phone: z.string().trim().min(7).max(20),
    country: z.string().trim().length(2),
    password: passwordSchema,
    confirmPassword: z.string(),
    dateOfBirth: z.coerce.date(),
    termsAccepted: z.boolean().refine((value) => value === true, "You must accept the Terms of Service."),
    riskDisclosureAccepted: z
      .boolean()
      .refine((value) => value === true, "You must acknowledge the risk disclosure."),
    website: honeypot,
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", message: "Passwords do not match.", path: ["confirmPassword"] });
    }
    if (containsPersonalInfo(data.password, { email: data.email, fullName: data.fullName })) {
      ctx.addIssue({
        code: "custom",
        message: "Password must not contain your name or email.",
        path: ["password"],
      });
    }
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(320),
  password: z.string().min(1),
  website: honeypot,
});

// rememberDevice lives here, not on loginSchema: it's only actually
// relevant once an MFA challenge is presented, so that's where the "trust
// this device" checkbox belongs in the UI too.
export const mfaVerifySchema = z.object({
  code: z.string().trim().min(6).max(10),
  rememberDevice: z.boolean().optional().default(false),
});

// Same code shape, no rememberDevice — used by the account-management MFA
// endpoints (confirm enrollment, disable, regenerate backup codes), which
// aren't part of the login flow.
export const mfaCodeSchema = z.object({
  code: z.string().trim().min(6).max(10),
});

// Disabling MFA (or regenerating backup codes) is a security downgrade
// that must re-check something the bare session cookie doesn't already
// prove — either the current password or a valid MFA code, never a bare
// toggle.
export const stepUpSchema = z
  .object({
    password: z.string().min(1).optional(),
    code: z.string().trim().min(6).max(10).optional(),
  })
  .refine((data) => Boolean(data.password || data.code), {
    message: "Provide your current password or a verification code.",
    path: ["password"],
  });

export const passwordResetRequestSchema = z.object({
  identifier: z.string().trim().min(3).max(320),
  website: honeypot,
});

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().min(20),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match.",
    path: ["confirmNewPassword"],
  });
