import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function BucketTabs({
  value,
  onChange,
}: {
  value: "daily" | "weekly" | "monthly";
  onChange: (v: "daily" | "weekly" | "monthly") => void;
}) {
  const tabs: Array<{ k: "daily" | "weekly" | "monthly"; label: string }> = [
    { k: "daily", label: "Daily" },
    { k: "weekly", label: "Weekly" },
    { k: "monthly", label: "Monthly" },
  ];
  return (
    <div className="inline-flex rounded-full border border-border bg-background p-1 text-xs">
      {tabs.map((t) => (
        <button
          key={t.k}
          type="button"
          onClick={() => onChange(t.k)}
          className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
            value === t.k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}
export function ChartCard({ title, children, right }: ChartCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {right}
      </div>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

export function LineTrend({
  data,
  dataKey,
  label,
  color = "var(--primary)",
  valueFormatter,
}: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  label: string;
  color?: string;
  valueFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="key" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={valueFormatter} width={48} />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
          formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)}
        />
        <Line type="monotone" dataKey={dataKey} name={label} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GroupedBars({
  data,
  series,
}: {
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; label: string; color: string }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="key" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={36} />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function rupees(v: number): string {
  return `₹${v.toLocaleString("en-IN")}`;
}
