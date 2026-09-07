import { useTranslation } from "react-i18next";
import { AlertCircle, ExternalLink } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { useVisibilityPromptRuns } from "~/lib/hooks/useWorkspaceReVisible";
import type { PromptRun } from "~/lib/api/re-visible";
import { engineColor, engineLabel } from "./constants";

/**
 * The actual answers behind one question.
 *
 * This exists because a rate on its own is not believable. A client who sees
 * "Names you: 33%" wants to read the answer that did and the two that did not,
 * and every number on the page has to be checkable against the raw text.
 *
 * Loaded on expand rather than with the list: a prompt row is cheap, twelve
 * answers with full text are not.
 */
export function PromptRunsDetail({
  pluginUuid,
  promptId,
}: {
  pluginUuid: string;
  promptId: string;
}) {
  const { t } = useTranslation();
  const { data, isPending } = useVisibilityPromptRuns(pluginUuid, promptId);

  if (isPending) {
    return <div className="h-20 animate-pulse rounded-lg bg-muted" />;
  }

  const runs = data?.runs ?? [];

  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(
          "wordpress.reVisible.noAnswersYet",
          "This question has not been asked yet.",
        )}
      </p>
    );
  }

  // Newest first per engine, so a reader compares like with like.
  const byEngine = new Map<string, PromptRun[]>();

  for (const run of runs) {
    const bucket = byEngine.get(run.engine) ?? [];
    bucket.push(run);
    byEngine.set(run.engine, bucket);
  }

  return (
    <div className="space-y-4">
      {[...byEngine.entries()].map(([engine, engineRuns]) => (
        <div key={engine} className="rounded-xl border bg-muted/20 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: engineColor(engine) }}
            />
            <h4 className="text-xs font-semibold">{engineLabel(engine)}</h4>
            <span className="text-[11px] text-muted-foreground">
              {new Date(engineRuns[0].created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="space-y-3">
            {engineRuns.slice(0, 3).map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RunCard({ run }: { run: PromptRun }) {
  const { t } = useTranslation();

  if (run.error) {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          {t("wordpress.reVisible.runFailed", "This answer failed: {{error}}", {
            error: run.error,
          })}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-l-2 border-border pl-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {run.own_mentioned ? (
          <Badge className="text-[10px]">
            {t("wordpress.reVisible.named", "Named you")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            {t("wordpress.reVisible.notNamed", "Did not name you")}
          </Badge>
        )}
        {run.own_cited ? (
          <Badge variant="secondary" className="text-[10px]">
            {t("wordpress.reVisible.cited", "Cited your site")}
          </Badge>
        ) : null}
        {run.recommended ? (
          <Badge variant="secondary" className="text-[10px]">
            {t("wordpress.reVisible.recommended", "Recommended you")}
          </Badge>
        ) : null}
        {!run.grounded ? (
          <Badge variant="outline" className="text-[10px]">
            {t("wordpress.reVisible.fromMemory", "Answered from memory")}
          </Badge>
        ) : null}
      </div>

      {run.answer_text ? (
        <p className="max-h-40 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
          {run.answer_text}
        </p>
      ) : null}

      {run.brands_named.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {t("wordpress.reVisible.brandsInOrder", "Named, in order:")}{" "}
          {run.brands_named.map((brand, index) => (
            <span key={`${brand.name}-${index}`}>
              {index > 0 ? ", " : ""}
              <span className={brand.is_self ? "font-semibold text-foreground" : ""}>
                {brand.name}
              </span>
            </span>
          ))}
        </p>
      ) : null}

      {run.citations.length > 0 ? (
        <ul className="space-y-0.5">
          {run.citations.slice(0, 6).map((citation) => (
            <li key={citation.url} className="truncate text-[11px]">
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
              >
                <ExternalLink className="size-3 shrink-0" aria-hidden />
                <span className="truncate">
                  {citation.title || citation.domain}
                </span>
                <span className="shrink-0 text-[10px] opacity-70">
                  {citation.domain}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
