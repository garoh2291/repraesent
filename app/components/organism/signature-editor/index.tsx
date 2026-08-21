import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { ImagePlus, Loader2 } from "lucide-react";
import {
  getEmailAccountSignature,
  setEmailAccountSignature,
} from "~/lib/api/email-accounts";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_PRESET_WIDTH,
  resizeImageFile,
  type ImageSizePreset,
} from "~/lib/utils/image-resize";
import {
  RichTextEditor,
  RichTextToolbar,
} from "~/components/organism/compose-email/rich-text-editor";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const PRESETS: ImageSizePreset[] = ["xsmall", "small", "medium", "large"];

/** Fallbacks for the size labels; the translated keys win when present. */
const PRESET_LABEL: Record<ImageSizePreset, string> = {
  xsmall: "Extra small",
  small: "Small",
  medium: "Medium",
  large: "Large",
};

/**
 * Per-mailbox signature editing, rendered inline under an account row.
 *
 * Deliberately reuses the composer's editor rather than forking one: what you
 * type here should look exactly like what the composer will send.
 */
export function SignatureEditor({
  accountId,
  accountEmail,
  onClose,
}: {
  accountId: string;
  accountEmail: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [html, setHtml] = useState("");
  const [dirty, setDirty] = useState(false);
  const [size, setSize] = useState<ImageSizePreset>("small");
  const [inserting, setInserting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["email-account-signature", accountId],
    queryFn: () => getEmailAccountSignature(accountId),
  });

  useEffect(() => {
    if (data) setHtml(data.signature_html ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      setEmailAccountSignature(accountId, editor?.getHTML() ?? html),
    onSuccess: (result) => {
      // Refreshes has_signature on the row so the list reflects reality.
      void queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      void queryClient.invalidateQueries({
        queryKey: ["email-account-signature"],
      });
      setHtml(result.signature_html ?? "");
      setDirty(false);
      toast.success(
        t("settings.emailAccounts.signatureSaved", {
          defaultValue: "Signature saved",
        }),
      );
      onClose();
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const insertImage = async (file: File) => {
    setInserting(true);
    try {
      const image = await resizeImageFile(file, size);
      editor
        ?.chain()
        .focus()
        // width/height as real attributes: plenty of mail clients ignore CSS
        // sizing, and an unsized logo arrives at its full pixel dimensions.
        .setImage({ src: image.dataUrl, alt: "" })
        .updateAttributes("image", {
          width: image.width,
          height: image.height,
        })
        .run();
      setDirty(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings.emailAccounts.signatureImageFailed", {
              defaultValue: "That image could not be added.",
            }),
      );
    } finally {
      setInserting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-4 sm:px-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const inherited = data?.inherited_from;

  return (
    <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("settings.emailAccounts.signatureFor", {
            defaultValue: "Signature for {{email}}",
            email: accountEmail,
          })}
        </p>
        {inherited && !dirty ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {t("settings.emailAccounts.signatureInherited", {
              defaultValue: "Inherited from {{email}}",
              email: inherited,
            })}
          </span>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card px-2">
        <RichTextEditor
          value={html}
          onChange={(next) => {
            setHtml(next);
            setDirty(true);
          }}
          allowImages
          minHeight="min-h-[140px]"
          disabled={save.isPending}
          toolbarRef={setEditor}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <RichTextToolbar editor={editor} />
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void insertImage(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 text-xs sm:h-8"
            disabled={!editor || inserting || save.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {inserting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImagePlus className="size-3.5" />
            )}
            {t("settings.emailAccounts.signatureAddImage", {
              defaultValue: "Image",
            })}
          </Button>
          <Select
            value={size}
            onValueChange={(v) => setSize(v as ImageSizePreset)}
          >
            <SelectTrigger
              size="sm"
              className="h-9 w-auto gap-1 text-xs sm:h-8"
              aria-label={t("settings.emailAccounts.signatureImageSize", {
                defaultValue: "Image size",
              })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {t(`settings.emailAccounts.signatureSize.${preset}`, {
                    defaultValue: PRESET_LABEL[preset],
                  })}{" "}
                  <span className="text-muted-foreground">
                    {IMAGE_PRESET_WIDTH[preset]}px
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 text-xs sm:h-8"
            onClick={onClose}
            disabled={save.isPending}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 text-xs sm:h-8"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending
              ? t("common.saving", { defaultValue: "Saving…" })
              : t("common.save", { defaultValue: "Save" })}
          </Button>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t("settings.emailAccounts.signatureHint", {
          defaultValue:
            "Added automatically to emails sent from this address, whoever sends them. You can paste your existing signature straight out of Gmail.",
        })}
      </p>
    </div>
  );
}
