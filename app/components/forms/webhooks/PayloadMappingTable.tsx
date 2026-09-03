import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import type {
  FormWebhookFieldMap,
  PayloadKeyGroup,
} from "~/lib/api/form-webhooks";
import { TARGET_KEY_RE, collidingTargets } from "~/lib/forms/webhook-preview";
import { cn } from "~/lib/utils";

interface Props {
  groups: PayloadKeyGroup[];
  map: FormWebhookFieldMap;
  onChange: (map: FormWebhookFieldMap) => void;
  disabled?: boolean;
}

/**
 * The key-by-key table: include, our key, → , the name it is sent as, its
 * type, an example. Renamed rows are tinted; excluded rows dim and strike;
 * two keys landing on one name get a red ring, because that is the one
 * mistake the server refuses.
 */
export function PayloadMappingTable({
  groups,
  map,
  onChange,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");

  const allKeys = useMemo(
    () => groups.flatMap((g) => g.keys.map((k) => k.key)),
    [groups],
  );
  const collisions = useMemo(
    () => collidingTargets(map, allKeys),
    [map, allKeys],
  );

  const isIncluded = (key: string) => {
    const rule = map.keys[key];
    return rule ? rule.include : map.default === "include";
  };
  const targetOf = (key: string) => map.keys[key]?.as ?? key;

  const setRule = (
    key: string,
    patch: Partial<{ include: boolean; as: string | undefined }>,
  ) => {
    const current = map.keys[key] ?? { include: isIncluded(key) };
    const next = { ...current, ...patch };
    if (next.as !== undefined && (next.as.trim() === "" || next.as === key)) {
      delete next.as;
    }
    const keys = { ...map.keys };
    // Back to the default with no rename: drop the rule so the map stays small.
    if (next.include === (map.default === "include") && next.as === undefined) {
      delete keys[key];
    } else {
      keys[key] = next;
    }
    onChange({ ...map, keys });
  };

  const setGroup = (group: PayloadKeyGroup, include: boolean) => {
    const keys = { ...map.keys };
    for (const k of group.keys) {
      const current = keys[k.key];
      const rule = { ...(current ?? {}), include };
      if (include === (map.default === "include") && !rule.as)
        delete keys[k.key];
      else keys[k.key] = rule;
    }
    onChange({ ...map, keys });
  };

  const needle = filter.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("forms.webhooks.search")}
        className="h-8"
      />

      {groups.map((group) => {
        const rows = group.keys.filter(
          (k) =>
            !needle ||
            k.key.toLowerCase().includes(needle) ||
            k.label.toLowerCase().includes(needle) ||
            targetOf(k.key).toLowerCase().includes(needle),
        );
        if (rows.length === 0) return null;
        return (
          <section key={group.group} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {t(`forms.webhooks.group.${group.group}`)}
              </h4>
              {!disabled ? (
                <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
                    onClick={() => setGroup(group, true)}
                  >
                    {t("forms.webhooks.all")}
                  </button>
                  <span aria-hidden>·</span>
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
                    onClick={() => setGroup(group, false)}
                  >
                    {t("forms.webhooks.none")}
                  </button>
                </span>
              ) : null}
            </div>

            <div className="divide-y divide-border/60 overflow-hidden rounded-xl border">
              {rows.map((k) => {
                const included = isIncluded(k.key);
                const target = targetOf(k.key);
                const renamed = included && target !== k.key;
                const invalidName = renamed && !TARGET_KEY_RE.test(target);
                const collides = included && collisions.has(target);
                return (
                  <div
                    key={k.key}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 px-3 py-2 text-sm transition-colors @lg:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.2fr)]",
                      !included && "opacity-50",
                      renamed && included && "bg-primary/5",
                    )}
                  >
                    <Switch
                      checked={included}
                      disabled={disabled}
                      onCheckedChange={(v) => setRule(k.key, { include: v })}
                      aria-label={`${t("forms.webhooks.include")} ${k.key}`}
                      className="scale-90"
                    />
                    <span
                      className={cn(
                        "truncate font-mono text-[12px]",
                        !included && "line-through",
                      )}
                      title={k.label}
                    >
                      {k.key}
                    </span>
                    <span className="text-muted-foreground/60" aria-hidden>
                      →
                    </span>
                    <span className="relative flex min-w-0 items-center gap-1">
                      <Input
                        value={target}
                        disabled={disabled || !included}
                        onChange={(e) => setRule(k.key, { as: e.target.value })}
                        aria-label={`${t("forms.webhooks.targetKey")} ${k.key}`}
                        aria-invalid={invalidName || collides || undefined}
                        className={cn(
                          "h-8 font-mono text-[12px]",
                          (invalidName || collides) &&
                            "border-destructive ring-2 ring-destructive/20",
                        )}
                      />
                      {renamed && !disabled ? (
                        <button
                          type="button"
                          onClick={() => setRule(k.key, { as: undefined })}
                          aria-label={t("forms.webhooks.reset")}
                          title={t("forms.webhooks.reset")}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </span>
                    <span className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground @lg:inline">
                      {k.type}
                    </span>
                    <span className="hidden truncate text-xs text-muted-foreground @lg:inline">
                      {formatExample(k.example)}
                    </span>
                    {collides ? (
                      <p className="col-span-full text-xs text-destructive">
                        {t("forms.webhooks.collision")}
                      </p>
                    ) : invalidName ? (
                      <p className="col-span-full text-xs text-destructive">
                        {t("forms.webhooks.invalidName")}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function formatExample(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
