import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BrandMetrics } from "~/lib/api/ai-visibility";
import { pct, shortDate } from "./shared";

/**
 * Visibility over time: the business as a thick ink line, competitors as thin
 * coloured ones. Five competitors at most — more lines than that is noise.
 */
export function TrendChart({
  trend,
  brands,
  height = 240,
}: {
  trend: Array<{ date: string; answers: number; values: Record<string, number | null> }>;
  brands: Array<BrandMetrics & { color?: string | null }>;
  height?: number;
}) {
  const shown = [brands.find((b) => b.is_own), ...brands.filter((b) => !b.is_own).slice(0, 5)].filter(Boolean) as Array<
    BrandMetrics & { color?: string | null }
  >;
  const data = trend.map((p) => ({ date: p.date, ...Object.fromEntries(shown.map((b) => [b.key, p.values[b.key] ?? null])) }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v: number) => pct(v)}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] shadow-md">
                  <p className="mb-1 font-medium text-foreground">{shortDate(String(label))}</p>
                  {[...payload]
                    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
                    .map((p) => {
                      const b = shown.find((x) => x.key === p.dataKey);
                      return (
                        <p key={String(p.dataKey)} className="flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: String(p.color) }} />
                            <span className={b?.is_own ? "font-semibold text-foreground" : undefined}>{b?.name}</span>
                          </span>
                          <span className="num text-foreground">{pct(p.value as number)}</span>
                        </p>
                      );
                    })}
                </div>
              ) : null
            }
          />
          {shown
            .slice()
            .reverse()
            .map((b) => (
              <Line
                key={b.key}
                type="monotone"
                dataKey={b.key}
                name={b.name}
                stroke={b.is_own ? "var(--foreground)" : b.color ?? "#9a9a9a"}
                strokeWidth={b.is_own ? 2.75 : 1.5}
                strokeOpacity={b.is_own ? 1 : 0.8}
                dot={data.length <= 2 ? { r: b.is_own ? 4 : 3 } : false}
                activeDot={{ r: b.is_own ? 4.5 : 3.5 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
