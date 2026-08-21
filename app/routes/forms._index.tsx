import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Copy,
  HelpCircle,
  Link2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { FormsIntroModal } from "~/components/forms/intro/FormsIntroModal";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { FormStatusBadge } from "~/components/forms/FormStatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  createForm,
  deleteForm,
  duplicateForm,
  type FormSummary,
} from "~/lib/api/forms";
import { buildPublicFormUrl } from "~/lib/config";
import { useLocalStorageValue } from "~/lib/hooks/useLocalStorage";
import { useAuthContext } from "~/providers/auth-provider";
import {
  FORM_LOCALES,
  isFormLocale,
  type FormLocale,
} from "~/lib/forms/schema";
import { useCanEditForms } from "~/lib/hooks/useCanEditForms";
import { useForms } from "~/lib/hooks/useForms";
import i18n from "~/i18n";

export function meta() {
  return [
    { title: `${i18n.t("forms.list.title")} · Repraesent` },
    { name: "description", content: i18n.t("forms.list.hint") },
  ];
}

/** Per-browser, by design — no migration, and nothing on `users` to hang it on. */
const INTRO_SEEN_KEY = "forms-intro-seen";

export default function FormsIndexRoute() {
  const { t, i18n: i18next } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useCanEditForms();
  const { user } = useAuthContext();
  const userId = user?.id;
  const onboardingDoneAt = user?.onboarding_completed_at;

  const { data: forms, isLoading } = useForms();

  // --- first-visit intro ----------------------------------------------------
  const { item: introSeen, setItem: setIntroSeen } =
    useLocalStorageValue<boolean>(INTRO_SEEN_KEY);
  const [introOpen, setIntroOpen] = useState(false);

  useEffect(() => {
    if (introSeen) return;
    // Opening from an effect is required, not stylistic: useLocalStorageValue
    // is useSyncExternalStore with a `""` server snapshot, so `introSeen` reads
    // as null through SSR and hydration. Gating during render would flash the
    // modal at every returning user before localStorage is legible.
    //
    // The null check on onboarding_completed_at keeps this off the screen while
    // the global OnboardingTour is still pending — _dashboard-layout wraps
    // /forms too, so a brand-new user would otherwise get both at once.
    if (!userId || onboardingDoneAt == null) return;

    const timer = setTimeout(() => setIntroOpen(true), 600);
    return () => clearTimeout(timer);
    // Scalars, not the `user` object: the auth context hands back a fresh
    // reference on each render, which would re-arm the timeout every time and
    // it would never fire. _dashboard-layout.tsx:62 does the same thing.
  }, [introSeen, userId, onboardingDoneAt]);

  const closeIntro = () => {
    setIntroOpen(false);
    setIntroSeen(true);
  };

  const [search, setSearch] = useState("");
  const { ref: searchInputRef, withHint } = useSearchShortcut();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  // Default to the operator's own dashboard language rather than always "de" —
  // the form's default locale is otherwise very hard to change later.
  const [newLocale, setNewLocale] = useState<FormLocale>(() =>
    isFormLocale(i18n.language) ? i18n.language : "de",
  );
  const [pendingArchive, setPendingArchive] = useState<FormSummary | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return forms ?? [];
    return (forms ?? []).filter((f) => f.name.toLowerCase().includes(q));
  }, [forms, search]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["forms"] });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      createForm({ name, default_locale: newLocale }),
    onSuccess: async (form) => {
      await invalidate();
      toast.success(t("forms.list.created"));
      setCreateOpen(false);
      setNewName("");
      navigate(`/forms/${form.id}`);
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      toast.error(
        status === 409
          ? t("forms.list.nameExists")
          : t("common.failedToSave", { defaultValue: "Could not save" }),
        status === 409
          ? undefined
          : { description: extractErrorMessage(error) },
      );
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateForm,
    onSuccess: async () => {
      await invalidate();
      toast.success(t("forms.list.duplicated"));
    },
    onError: (error: unknown) =>
      toast.error(
        t("common.failedToSave", { defaultValue: "Could not save" }),
        {
          description: extractErrorMessage(error),
        },
      ),
  });

  const archiveMutation = useMutation({
    mutationFn: deleteForm,
    onSuccess: async () => {
      await invalidate();
      toast.success(t("forms.list.archived"));
      setPendingArchive(null);
    },
    onError: (error: unknown) =>
      toast.error(
        t("common.failedToSave", { defaultValue: "Could not save" }),
        {
          description: extractErrorMessage(error),
        },
      ),
  });

  const copyLink = (form: FormSummary) => {
    void navigator.clipboard.writeText(buildPublicFormUrl(form.id));
    toast.success(t("forms.share.copied"));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18next.language, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("forms.list.title")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("forms.list.hint")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Without a replay, whoever hits Skip can never get the explanation
              back. Opens without touching the seen flag. */}
          <button
            type="button"
            onClick={() => setIntroOpen(true)}
            aria-label={t("forms.intro.replay")}
            title={t("forms.intro.replay")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {canEdit ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("forms.list.newForm")}
            </Button>
          ) : null}
        </div>
      </div>

      <FormsIntroModal open={introOpen} onClose={closeIntro} />

      <div className="border-t" />

      {(forms?.length ?? 0) > 0 ? (
        <Input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={withHint(t("forms.list.search"))}
          className="max-w-xs"
        />
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center app-fade-up">
          <ClipboardList
            className="h-8 w-8 text-muted-foreground/60"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-medium">{t("forms.list.empty")}</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              {t("forms.list.emptyHint")}
            </p>
          </div>
          {canEdit ? (
            <Button
              variant="outline"
              onClick={() => setCreateOpen(true)}
              className="mt-1"
            >
              <Plus className="h-4 w-4" />
              {t("forms.list.newForm")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((form, index) => (
            <div
              key={form.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/forms/${form.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/forms/${form.id}`);
                }
              }}
              className={`app-fade-up app-fade-up-d${Math.min(index + 1, 4)} group flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20 sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{form.name}</span>
                  <FormStatusBadge
                    status={form.status}
                    hasUnpublishedChanges={form.has_unpublished_changes}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{form.slug}</span>
                  {" · "}
                  {form.locales.join(", ").toUpperCase()}
                  {" · "}
                  {t("forms.list.colUpdated")} {formatDate(form.updated_at)}
                </p>
              </div>

              <div className="flex items-center gap-4 sm:gap-6">
                {/* The count is the natural way in to the submissions it counts
                    — the same destination the row menu offers, one click closer.
                    stopPropagation because the whole row is itself a button
                    that opens the builder, and a link inside it would otherwise
                    navigate twice.

                    Only a link when there is something to see: sending someone
                    to an empty filtered list to prove a zero is a dead end. */}
                {form.submission_count > 0 ? (
                  <Link
                    to={`/lead-form?form_name=${encodeURIComponent(form.slug)}`}
                    onClick={(e) => e.stopPropagation()}
                    title={t("forms.list.viewSubmissions")}
                    className="rounded-lg px-2 py-1 text-right transition-colors hover:bg-muted"
                  >
                    <div className="text-lg font-semibold tabular-nums leading-none underline-offset-4 hover:underline">
                      {form.submission_count}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("forms.list.colSubmissions")}
                    </div>
                  </Link>
                ) : (
                  <div className="px-2 py-1 text-right">
                    <div className="text-lg font-semibold tabular-nums leading-none text-muted-foreground">
                      {form.submission_count}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("forms.list.colSubmissions")}
                    </div>
                  </div>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={form.name}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem
                      onSelect={() => navigate(`/forms/${form.id}`)}
                    >
                      {t("forms.list.open")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        navigate(`/lead-form?form_name=${form.slug}`)
                      }
                    >
                      {t("forms.list.viewSubmissions")}
                    </DropdownMenuItem>
                    {form.status === "published" ? (
                      <DropdownMenuItem onSelect={() => copyLink(form)}>
                        <Link2 className="h-4 w-4" />
                        {t("forms.list.copyLink")}
                      </DropdownMenuItem>
                    ) : null}
                    {canEdit ? (
                      <>
                        <DropdownMenuItem
                          onSelect={() => duplicateMutation.mutate(form.id)}
                        >
                          <Copy className="h-4 w-4" />
                          {t("forms.list.duplicate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setPendingArchive(form)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("forms.list.archive")}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("forms.list.newForm")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-form-name">
                {t("forms.list.nameLabel")}
              </label>
              <Input
                id="new-form-name"
                autoFocus
                value={newName}
                placeholder={t("forms.list.namePlaceholder")}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) {
                    createMutation.mutate(newName.trim());
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("forms.list.languageLabel")}
              </label>
              <Select
                value={newLocale}
                onValueChange={(v) => setNewLocale(v as FormLocale)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORM_LOCALES.map((locale) => (
                    <SelectItem key={locale} value={locale}>
                      {locale.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(newName.trim())}
            >
              {t("forms.list.newForm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive */}
      <AlertDialog
        open={!!pendingArchive}
        onOpenChange={(open) => !open && setPendingArchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("forms.list.archiveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("forms.list.archiveBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pendingArchive && archiveMutation.mutate(pendingArchive.id)
              }
            >
              {t("forms.list.archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
