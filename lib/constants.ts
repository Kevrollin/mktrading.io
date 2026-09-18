import { Activity, FileCheck, Lock, ShieldCheck, UserCheck, Users } from "lucide-react";
import type { FooterLinkGroup, NavLink } from "@/types/nav";
import type { SecurityItem } from "@/types/security";

export const SITE_NAME = "MKTrading";
export const SITE_TAGLINE = "Trade with clarity.";
export const SITE_DESCRIPTION =
  "MKTrading is a digital trading platform built around transparent pricing, clear risk information, and a focused trading experience.";
// Overridable via env (staging, previews, ...); the app's own trusted
// base URL — used for links in emails, so this must never be derived
// from a request's Host header (host-header injection risk).
export const SITE_URL =
  process.env.SITE_URL ?? (process.env.NODE_ENV === "production" ? "https://mktradingv1.com" : "http://localhost:3000");

export const PRIMARY_NAV: NavLink[] = [
  { label: "Markets", href: "/markets" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Security", href: "/security" },
  { label: "Responsible trading", href: "/responsible-trading" },
];

export const LOGIN_LINK: NavLink = { label: "Login", href: "/login" };
export const REGISTER_LINK: NavLink = { label: "Create account", href: "/register" };

export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    heading: "Platform",
    links: [
      { label: "Markets", href: "/markets" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Fees", href: "/fees" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Risk Disclosure", href: "/risk-disclosure" },
      { label: "Responsible Trading", href: "/responsible-trading" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Security", href: "/security" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const CONTACT_EMAILS = {
  support: "support@mktradingv1.com",
  compliance: "compliance@mktradingv1.com",
};

export const SECURITY_ITEMS: SecurityItem[] = [
  {
    icon: ShieldCheck,
    title: "Account protection",
    description:
      "Strong password hashing and optional multi-factor authentication are designed into the account system from the start.",
  },
  {
    icon: UserCheck,
    title: "Identity verification (KYC)",
    description:
      "Verification is required before withdrawals, using a configurable KYC provider integration rather than a self-declared check.",
  },
  {
    icon: Activity,
    title: "Transaction monitoring",
    description:
      "Deposits, trades, and withdrawals are designed to be independently reconciled rather than trusted from client input alone.",
  },
  {
    icon: Lock,
    title: "Secure wallet infrastructure",
    description:
      "User balances are derived from an internal ledger, not a balance column any client request can move directly.",
  },
  {
    icon: Users,
    title: "Multi-administrator approval",
    description:
      "Withdrawals are designed to require independent sign-off from multiple authorized administrators before funds move.",
  },
  {
    icon: FileCheck,
    title: "Full auditability",
    description:
      "Every financial and administrative action is designed to leave an immutable, traceable record.",
  },
];
