import { InstrumentForm } from "@/components/admin/instrument-form";
import { Container } from "@/components/ui/container";
import { requireSuperAdmin } from "@/lib/auth/rbac";
import { listInstruments } from "@/lib/trading/instruments-service";

export const dynamic = "force-dynamic";

export default async function AdminInstrumentsPage() {
  await requireSuperAdmin();

  const instruments = await listInstruments(false);

  return (
    <Container className="flex flex-col gap-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Instruments</h1>
        <p className="text-sm text-muted-foreground">
          Payout percentage, allowed durations, stake bounds, and active state per instrument.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        {instruments.map((instrument) => (
          // Keyed on updatedAt too, so a save-and-refresh remounts the
          // form with fresh defaultValues instead of showing stale
          // uncontrolled-input state after form.reset().
          <InstrumentForm
            key={`${instrument.id}-${instrument.updatedAt.toISOString()}`}
            instrument={{
              id: instrument.id,
              symbol: instrument.symbol,
              name: instrument.name,
              category: instrument.category,
              isActive: instrument.isActive,
              payoutPercent: instrument.payoutPercent,
              allowedDurationsSeconds: instrument.allowedDurationsSeconds,
              minStake: instrument.minStake,
              maxStake: instrument.maxStake,
            }}
          />
        ))}
      </div>
    </Container>
  );
}
