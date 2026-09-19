const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Every TTL and rate-limit number for auth lives here, and nowhere else.
export const SESSION_IDLE_TIMEOUT_MS = 7 * DAY;
export const SESSION_ABSOLUTE_LIFETIME_MS = 30 * DAY;

export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * HOUR;
export const PASSWORD_RESET_TOKEN_TTL_MS = HOUR;
export const MFA_PENDING_COOKIE_TTL_MS = 10 * MINUTE;
export const TRUSTED_DEVICE_TTL_MS = 30 * DAY;

export const RATE_LIMITS = {
  loginPerIdentifier: { windowMs: 15 * MINUTE, limit: 5 },
  loginPerIdentifierHourly: { windowMs: HOUR, limit: 20 },
  loginPerIp: { windowMs: 5 * MINUTE, limit: 30 },
  registerPerIp: { windowMs: HOUR, limit: 5 },
  registerPerEmailDaily: { windowMs: DAY, limit: 3 },
  resendVerificationPerAccount: { windowMs: HOUR, limit: 3 },
  passwordResetRequestPerIdentifier: { windowMs: HOUR, limit: 3 },
  passwordResetRequestPerIp: { windowMs: HOUR, limit: 10 },
  mfaVerifyPerPendingLogin: { windowMs: 10 * MINUTE, limit: 5 },
  // Every admin wallet action (approve/reject/processing/complete/adjust)
  // requires a fresh MFA code — rate-limited the same way login MFA is.
  adminStepUpPerAdmin: { windowMs: 10 * MINUTE, limit: 10 },
  withdrawalRequestPerUser: { windowMs: HOUR, limit: 10 },
  // The live price chart polls roughly once a second per open chart.
  tradingPricePollPerUser: { windowMs: MINUTE, limit: 120 },
  tradePlacementPerUser: { windowMs: HOUR, limit: 60 },
} as const;

export const SESSION_COOKIE_NAME = "mktrading_session";
export const TRUSTED_DEVICE_COOKIE_NAME = "mktrading_device";
export const MFA_PENDING_COOKIE_NAME = "mktrading_mfa_pending";
export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

export const MIN_PASSWORD_LENGTH = 12;
