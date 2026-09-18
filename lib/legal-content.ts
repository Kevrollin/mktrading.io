export interface LegalSectionData {
  heading: string;
  paragraphs: string[];
  /** Jurisdiction-specific, licensing, or registration content pending qualified legal review. */
  isCompliancePlaceholder?: boolean;
}

export interface LegalDocument {
  title: string;
  status: string;
  intro: string[];
  sections: LegalSectionData[];
}

export const TERMS: LegalDocument = {
  title: "Terms of Service",
  status: "Draft — pending legal and compliance review",
  intro: [
    "These Terms of Service govern access to and use of the MKTrading platform. This draft is written in plain, professional language and is provided for review purposes ahead of a full legal and compliance sign-off before any real-money functionality launches.",
  ],
  sections: [
    {
      heading: "Acceptance of these terms",
      paragraphs: [
        "By creating an account or otherwise using MKTrading, you agree to these Terms of Service and to the Risk Disclosure and Privacy Policy referenced throughout this site. If you do not agree, you should not use the platform.",
      ],
    },
    {
      heading: "Eligibility",
      paragraphs: [
        "You must meet the minimum age required in your jurisdiction and be legally permitted to use a trading platform of this kind where you reside. MKTrading may restrict availability by country or region, and may require identity verification before enabling certain features.",
        "You may hold only one account. Information provided during registration and verification must be accurate and kept up to date.",
      ],
    },
    {
      heading: "Account registration and security",
      paragraphs: [
        "You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify MKTrading immediately if you suspect unauthorized access.",
      ],
    },
    {
      heading: "The nature of the service",
      paragraphs: [
        "MKTrading provides a platform for short-duration trading contracts on market and synthetic instruments. Trading involves a genuine risk of loss, including the loss of your full stake on a given contract. Nothing on this platform is personalized investment advice or a recommendation to trade.",
      ],
    },
    {
      heading: "Deposits and withdrawals",
      paragraphs: [
        "Deposit and withdrawal methods, limits, and processing times are described in-platform and may vary by payment method, jurisdiction, and verification status. Withdrawals are subject to identity verification and MKTrading's internal review and approval process before funds are released.",
      ],
    },
    {
      heading: "Prohibited conduct",
      paragraphs: [
        "You may not use the platform for fraud, market manipulation, money laundering, operating multiple accounts to evade limits, automated abuse of platform mechanics, or any activity that violates applicable law.",
      ],
    },
    {
      heading: "Suspension and termination",
      paragraphs: [
        "MKTrading may suspend, restrict, or close an account where required by law, where suspicious or prohibited activity is identified, or to protect the integrity of the platform. Where reasonably possible, you will be notified of the reason.",
      ],
    },
    {
      heading: "Limitation of liability",
      paragraphs: [
        "The platform and its content are provided on an \"as is\" and \"as available\" basis. To the fullest extent permitted by applicable law, MKTrading is not liable for indirect or consequential losses arising from use of the platform. Nothing in these terms limits liability that cannot be limited under applicable law.",
      ],
    },
    {
      heading: "Governing law and jurisdiction",
      paragraphs: [
        "The governing law, competent courts, applicable regulatory framework, and licensing basis for MKTrading's operation in each jurisdiction it serves will be specified here following jurisdiction-by-jurisdiction legal review. Company registration alone does not constitute financial, securities, payments, virtual-asset, or gambling authorization.",
      ],
      isCompliancePlaceholder: true,
    },
    {
      heading: "Changes to these terms",
      paragraphs: [
        "MKTrading may update these terms from time to time. Material changes will be communicated in-platform or by other reasonable means before they take effect.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        "Questions about these terms can be directed to the contact channels listed on the Contact page.",
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: "Privacy Policy",
  status: "Draft — pending legal and compliance review",
  intro: [
    "This Privacy Policy explains what information MKTrading currently collects through this public website, and how that will expand once account and trading features are introduced.",
  ],
  sections: [
    {
      heading: "What this site currently collects",
      paragraphs: [
        "In its current form, this public website stores a single piece of information in your browser: your light/dark theme preference, saved locally so the site remembers your choice on your next visit. This site does not run third-party analytics or advertising trackers.",
      ],
    },
    {
      heading: "What will change once accounts launch",
      paragraphs: [
        "When account registration, KYC verification, deposits, and trading go live, this policy will be expanded well ahead of that launch to cover identity documents, contact and financial information, transaction and trading activity, and device/security data — along with the lawful basis, retention period, and safeguards for each category.",
      ],
    },
    {
      heading: "Cookies and local storage",
      paragraphs: [
        "The only browser storage in use today is the local theme preference described above. It stays on your device and is never transmitted to MKTrading or shared with any third party.",
      ],
    },
    {
      heading: "Data sharing",
      paragraphs: [
        "MKTrading does not sell personal data. Once account features are active, any service providers involved in identity verification, payments, or infrastructure will be disclosed here, along with the purpose of each integration.",
      ],
    },
    {
      heading: "Data retention",
      paragraphs: [
        "Retention periods for account, verification, and transaction data will be defined per applicable jurisdiction and financial record-keeping requirements ahead of launch.",
      ],
      isCompliancePlaceholder: true,
    },
    {
      heading: "Your rights",
      paragraphs: [
        "Data-subject rights (such as access, correction, deletion, or portability requests) will be specified here in line with the data-protection law applicable in each jurisdiction MKTrading serves.",
      ],
      isCompliancePlaceholder: true,
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "This policy will be updated as functionality is added. Material changes will be communicated before they take effect.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        "Privacy-related questions can be directed to the contact channels listed on the Contact page.",
      ],
    },
  ],
};

export const RISK_DISCLOSURE: LegalDocument = {
  title: "Risk Disclosure",
  status: "Draft — pending legal and compliance review",
  intro: [
    "Trading on MKTrading involves a genuine risk of financial loss. This page explains that risk clearly and directly. Please read it in full before trading, alongside the Terms of Service and Responsible Trading pages.",
  ],
  sections: [
    {
      heading: "You can lose your full stake",
      paragraphs: [
        "Short-duration trading contracts settle to a fixed outcome. If a contract settles against you, you can lose the entire amount staked on that contract. Potential payout and maximum loss are always shown before you confirm a trade — but a shown maximum loss is still a real loss if it occurs.",
      ],
    },
    {
      heading: "No guarantee of profit",
      paragraphs: [
        "No statement on this platform should be read as a promise or guarantee of profit. Past price movement does not predict future results.",
      ],
    },
    {
      heading: "This is not investment advice",
      paragraphs: [
        "MKTrading does not provide personalized investment, financial, or trading advice. You are solely responsible for your own trading decisions and should seek independent professional advice if you are unsure.",
      ],
    },
    {
      heading: "Synthetic and indicative instruments",
      paragraphs: [
        "Some instruments offered on MKTrading may be synthetic or indicative instruments: prices generated to simulate market-like movement rather than sourced live from a real-world exchange. Where this is the case, MKTrading will clearly label the instrument as synthetic in-platform.",
      ],
    },
    {
      heading: "Trade only what you can afford to lose",
      paragraphs: [
        "Only trade with money you can afford to lose. Consider your personal financial circumstances carefully, and review the Responsible Trading page for tools to help manage your activity.",
      ],
    },
    {
      heading: "Jurisdiction-specific risk warnings",
      paragraphs: [
        "Additional risk warnings required in specific jurisdictions, and any restrictions on offering these contracts to residents of a given jurisdiction, will be added here following legal review for each market MKTrading serves.",
      ],
      isCompliancePlaceholder: true,
    },
  ],
};

export interface FeeScheduleItem {
  label: string;
  value: string;
  note?: string;
}

export const FEE_SCHEDULE: { intro: string[]; items: FeeScheduleItem[] } = {
  intro: [
    "The figures below are illustrative examples only, meant to show how fees will be presented. They are not current live pricing and are pending business and compliance finalization before launch.",
  ],
  items: [
    {
      label: "Mobile money deposit",
      value: "Example: no fee",
      note: "Placeholder — final pricing depends on the payment provider integrated for your region.",
    },
    {
      label: "Cryptocurrency deposit",
      value: "Example: no fee",
      note: "Network fees charged by the blockchain itself are separate and outside MKTrading's control.",
    },
    {
      label: "Withdrawal",
      value: "Example: flat fee or percentage, whichever applies",
      note: "Placeholder — exact figures will be published here before real-money withdrawals launch.",
    },
    {
      label: "Account inactivity",
      value: "Example: applied only after an extended period of inactivity",
      note: "Placeholder — exact threshold and amount pending finalization.",
    },
    {
      label: "Contract pricing",
      value: "Example: pricing may include a spread",
      note: "Placeholder — exact spread methodology will be published before launch.",
    },
  ],
};
