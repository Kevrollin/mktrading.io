import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { CtaSection } from "@/components/marketing/cta-section";
import { PageHero } from "@/components/marketing/page-hero";
import { StepFlow, type Step } from "@/components/marketing/step-flow";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "How it works",
  description: "The full path from creating an MKTrading account to settling your first trade.",
  path: "/how-it-works",
});

const STEPS: Step[] = [
  {
    title: "Create and verify your account",
    description:
      "Register with your details and complete identity verification (KYC) before funding or withdrawing. Verification requirements depend on your jurisdiction.",
  },
  {
    title: "Fund your account",
    description:
      "Deposit using mobile money or cryptocurrency. Deposits are independently confirmed before your balance updates — never assumed from a client-side success message.",
  },
  {
    title: "Choose a market",
    description:
      "Browse available instruments, review recent price movement, and check whether the market is currently open.",
  },
  {
    title: "Review contract details",
    description:
      "Pick a contract type and direction, then review the exact stake, potential payout, maximum loss, and expiry before you commit to anything.",
  },
  {
    title: "Place your trade",
    description:
      "Confirm the trade. The entry price, timestamp, and contract terms are all recorded server-side at the moment of execution.",
  },
  {
    title: "Track settlement",
    description:
      "Watch the countdown to expiry. Settlement uses the platform's authoritative pricing — never a price computed only in your browser.",
  },
  {
    title: "Withdraw eligible funds",
    description:
      "Request a withdrawal once funds are available. Withdrawals follow an internal, multi-administrator approval process before any funds move.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="From account to settlement"
        description="Every step is designed to be visible, verifiable, and reversible where it matters most — before you commit funds."
      />
      <Container className="py-12">
        <div className="max-w-2xl">
          <StepFlow steps={STEPS} />
        </div>
      </Container>
      <CtaSection
        title="Ready to see it in action?"
        subtitle="Account registration and trading launch in the next milestone."
      />
    </>
  );
}
