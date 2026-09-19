"use client";

import { useState } from "react";
import { InstrumentPicker } from "@/components/trading/instrument-picker";
import { OpenTradesPanel } from "@/components/trading/open-trades-panel";
import { PriceChart } from "@/components/trading/price-chart";
import { TradeTicketForm } from "@/components/trading/trade-ticket-form";
import type { CurrencyBalance } from "@/lib/ledger/balances";
import type { InstrumentRow } from "@/lib/trading/instruments-service";

export function TradingDesk({
  instruments,
  balances,
}: {
  instruments: InstrumentRow[];
  balances: CurrencyBalance[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(instruments[0]?.id ?? null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const selectedInstrument = instruments.find((instrument) => instrument.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <InstrumentPicker instruments={instruments} selectedId={selectedId} onSelect={setSelectedId} />
      {selectedInstrument ? <PriceChart key={selectedInstrument.id} instrumentId={selectedInstrument.id} /> : null}
      <TradeTicketForm
        instrument={selectedInstrument}
        balances={balances}
        onPlaced={() => setRefreshSignal((value) => value + 1)}
      />
      <OpenTradesPanel instruments={instruments} refreshSignal={refreshSignal} />
    </div>
  );
}
