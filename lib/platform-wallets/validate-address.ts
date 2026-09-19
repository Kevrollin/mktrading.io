import { Network, validate as validateBtcAddress } from "bitcoin-address-validation";

/**
 * Only BTC has real format/checksum validation right now — USDT/USDC can
 * live on multiple chains (Ethereum, Tron, ...) and this platform hasn't
 * picked one yet, so those just require a non-empty value until that's
 * decided. Pasting the wrong BTC address here would misdirect real
 * customer deposits, so that one is checked properly rather than with a
 * hand-rolled regex.
 */
export function isValidPlatformWalletAddress(currency: string, address: string): boolean {
  const trimmed = address.trim();
  if (!trimmed) return false;
  if (currency === "BTC") {
    return validateBtcAddress(trimmed, Network.mainnet);
  }
  return true;
}
