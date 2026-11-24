'use client';

import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { naira } from "@/lib/orderMath";
import Card from "@/components/ui/Card";
import ChartTooltip from "@/components/ui/ChartTooltip";
import FilterPills from "@/components/ui/FilterPills";
import SectionHeader from "@/components/ui/SectionHeader";
import StatTile from "@/components/ui/StatTile";
import { CardSkeleton } from "@/components/ui/Skeleton";

// The brand's dark orange: the one mark colour for every chart here. Checked
// with the dataviz validator against the page surface - the lighter brand
// peach (#EE9A5A) falls below the 3:1 mark contrast, this passes it.
const MARK = "#D9702F";
const GRID = "#e8e4df";
const AXIS = "#8a8279";

export const PERIODS = [
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "365", label: "Last 12 months" },
  { key: "0", label: "All time" },
];

const compact = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sign}₦${+(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${sign}₦${+(a / 1_000).toFixed(a >= 10_000 ? 0 : 1)}K`;
  return `${sign}₦${a}`;
};
// A loss reads "-₦650", not "₦-650".
const money = (v: unknown) => {
  const n = Number(v);
  return n < 0 ? `-${naira(-n)}` : naira(n);
};
const wk = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
const pct = (v: string | null | undefined) => (v == null ? "—" : `${v}%`);
const minutesLabel = (m: number | null) => {
  if (m == null) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60 ? `${m % 60} min` : ""}`.trim();
};

// ▲/▼ + words, never colour alone.
function Delta({ value, label = "vs previous period" }: { value: string | null | undefined; label?: string }) {
  if (value == null) return null;
  const n = Number(value);
  const up = n > 0;
  const flat = n === 0;
  return (
    <span className={"inline-flex items-center gap-1 text-sm font-semibold " + (flat ? "text-muted" : up ? "text-brand-green" : "text-red-600")}>
      <span aria-hidden>{flat ? "–" : up ? "▲" : "▼"}</span>
      {flat ? "No change" : `${Math.abs(n)}% ${up ? "up" : "down"}`}
      <span className="font-normal text-faint">{label}</span>
    </span>
  );
}

function WeeklyChart({ title, subtitle, rows, field, money: isMoney }: { title: string; subtitle: string; rows: any[]; field: string; money: boolean }) {
  const data = rows.map((r) => ({ week: wk(r.week_start), value: Number(r[field]) }));
  const latest = data[data.length - 1]?.value ?? 0;
  const fmt = (v: number) => (isMoney ? money(v) : String(v));
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-ink">{title}</p>
          <p className="text-xs text-faint">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-extrabold tabular-nums text-ink">{fmt(latest)}</p>
          <p className="text-xs text-faint">this week</p>
        </div>
      </div>
      <div className="h-44" role="img" aria-label={`${title}, last 12 weeks. This week: ${fmt(latest)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={isMoney ? 52 : 30} allowDecimals={false}
              tickFormatter={(v: number) => (isMoney ? compact(v) : String(v))} />
            <Tooltip cursor={{ fill: "rgba(33,26,20,0.04)" }} content={<ChartTooltip formatter={(v: any) => [fmt(Number(v)), ""]} />} />
            <Bar dataKey="value" fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function WeeklyTable({ rows, financials }: { rows: any[]; financials: boolean }) {
  return (
    <Card className="overflow-x-auto !p-0">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
            <th className="px-4 py-3 font-semibold">Week starting</th>
            <th className="px-4 py-3 text-right font-semibold">Orders</th>
            <th className="px-4 py-3 text-right font-semibold">Goods sold</th>
            {financials && <th className="px-4 py-3 text-right font-semibold">Revenue</th>}
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.week_start} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 text-ink/80">{wk(r.week_start)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.orders}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{naira(r.goods_sold)}</td>
              {financials && <td className="px-4 py-2.5 text-right tabular-nums">{money(r.revenue)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const DEFINITIONS: [string, string][] = [
  ["Completed order", "An order that was delivered and confirmed, counted on the day it was delivered. Every figure on this page uses completed orders, because that's when the money is settled and everyone is paid."],
  ["Goods sold", "The value of what customers' orders actually bought in the markets. It is the volume moving through Qyka, not Qyka's income."],
  ["Revenue", "What Qyka keeps from a completed order after paying the agent, the rider and the hub: the service-fee margin plus whatever the delivery fee leaves."],
  ["Take rate", "Revenue as a share of goods sold."],
  ["Repeat customers", "Of the customers served in the period, the share who have completed two or more orders with Qyka."],
  ["Delivery time", "The median time from an order being placed to it being delivered."],
  ["Completion rate", "Of the orders placed in the period that reached an outcome, the share that were delivered. The rest were cancelled or went unpaid. Orders still in progress are left out."],
];

export default function CompanyOverview({
  data, loading, period, onPeriod, intro,
}: {
  data: any | null;
  loading?: boolean;
  period: string;
  onPeriod: (key: string) => void;
  intro?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  if (!data) return <CardSkeleton />;
  const h = data.headline;
  const fin = data.financials_included;
  const vs = data.vs_previous_period;

  return (
    // Refetching keeps the frame: the previous numbers stay, dimmed.
    <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
      {intro}
      <FilterPills options={PERIODS} value={period} onChange={onPeriod} />

      <Card className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-faint">Goods sold</p>
        <p className="mt-1 font-display text-5xl font-extrabold tabular-nums tracking-tight text-ink sm:text-6xl">{naira(h.goods_sold)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Delta value={vs.goods_sold_percent} label="goods sold vs previous period" />
          {fin && <Delta value={vs.revenue_percent} label="revenue" />}
          <span className="text-sm text-muted">across {h.orders_completed} completed order{h.orders_completed === 1 ? "" : "s"}</span>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Orders completed" value={h.orders_completed} />
        {fin && <StatTile label="Revenue" value={money(h.revenue)} tone={Number(h.revenue) < 0 ? "ink" : "green"} />}
        {fin && <StatTile label="Take rate" value={pct(h.take_rate_percent)} />}
        <StatTile label="Average order" value={h.avg_order_value ? naira(h.avg_order_value) : "—"} />
        <StatTile label="Customers served" value={h.customers_served} />
        <StatTile label="Repeat customers" value={pct(h.repeat_customer_rate_percent)} />
        <StatTile label="Median delivery time" value={minutesLabel(h.median_delivery_minutes)} />
        <StatTile label="Completion rate" value={pct(data.reliability.completion_rate_percent)} />
        <StatTile label={h.ratings_count ? `Average rating · ${h.ratings_count} rating${h.ratings_count === 1 ? "" : "s"}` : "Average rating"} value={h.avg_rating != null ? `${h.avg_rating} / 5` : "—"} />
        <StatTile label="Registered customers" value={h.registered_customers} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionHeader icon="chart" title="Last 12 weeks" subtitle="Always the most recent twelve weeks, whatever period is selected above." className="!mb-0" />
        <button type="button" onClick={() => setAsTable((v) => !v)} className="text-sm font-semibold text-brand-orange-dark hover:underline">
          {asTable ? "Show charts" : "Show as table"}
        </button>
      </div>
      {asTable ? (
        <div className="mb-8"><WeeklyTable rows={data.weekly} financials={fin} /></div>
      ) : (
        <div className="mb-8 grid gap-3 lg:grid-cols-2">
          <WeeklyChart title="Goods sold" subtitle="Value of completed orders, per week" rows={data.weekly} field="goods_sold" money />
          <WeeklyChart title="Orders completed" subtitle="Delivered and confirmed, per week" rows={data.weekly} field="orders" money={false} />
          {fin && <WeeklyChart title="Revenue" subtitle="What Qyka keeps after paying agents, riders and hubs" rows={data.weekly} field="revenue" money />}
        </div>
      )}

      <SectionHeader icon="store" title="By market" subtitle="Completed orders in the selected period." className="mb-3" />
      <Card className="mb-8 overflow-x-auto !p-0">
        {data.markets.length === 0 ? (
          <p className="p-5 text-sm text-muted">No completed orders in this period yet.</p>
        ) : (
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
                <th className="px-4 py-3 font-semibold">Market</th>
                <th className="px-4 py-3 text-right font-semibold">Orders</th>
                <th className="px-4 py-3 text-right font-semibold">Goods sold</th>
                {fin && <th className="px-4 py-3 text-right font-semibold">Revenue</th>}
              </tr>
            </thead>
            <tbody>
              {data.markets.map((m: any) => (
                <tr key={m.name} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5"><span className="font-semibold text-ink">{m.name}</span>{m.city && <span className="ml-2 text-muted">{m.city}</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.orders}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{naira(m.goods_sold)}</td>
                  {fin && <td className="px-4 py-2.5 text-right tabular-nums">{money(m.revenue)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <SectionHeader icon="user" title="The network" subtitle="The people and places that make deliveries happen." className="mb-3" />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Agents" value={`${data.supply.agents_active_30d} active of ${data.supply.agents}`} />
        <StatTile label="Riders" value={`${data.supply.riders_active_30d} active of ${data.supply.riders}`} />
        <StatTile label="Market hubs" value={data.supply.hubs} />
        <StatTile label="Markets open" value={data.supply.markets_live} />
      </div>
      <p className="-mt-6 mb-8 text-xs text-faint">&ldquo;Active&rdquo; means they completed at least one delivery in the last 30 days.</p>

      <SectionHeader icon="check" title="How we count" subtitle="Every figure above, in plain words." className="mb-3" />
      <Card className="mb-3">
        <dl className="space-y-3">
          {DEFINITIONS.filter(([term]) => fin || !["Revenue", "Take rate"].includes(term)).map(([term, text]) => (
            <div key={term}>
              <dt className="text-sm font-semibold text-ink">{term}</dt>
              <dd className="text-sm text-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <p className="mb-2 text-xs text-faint">
        Live figures as of {new Date(data.as_of).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}.
        {data.pipeline.orders_in_flight > 0 && ` ${data.pipeline.orders_in_flight} order${data.pipeline.orders_in_flight === 1 ? " is" : "s are"} in progress and not yet counted.`}
        {" "}Qyka is in its pilot phase, so figures are early and move quickly.
      </p>
    </div>
  );
}
