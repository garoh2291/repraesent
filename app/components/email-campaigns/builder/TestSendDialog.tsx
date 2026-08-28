import { useMutation, useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { listEmailAccountsForWorkspace } from "~/lib/api/email-accounts";
import { testSendEmailTemplate } from "~/lib/api/email-templates";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useAuthContext } from "~/providers/auth-provider";

export function TestSendDialog({
  open,
  onOpenChange,
  templateId,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  locale: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const [to, setTo] = useState(user?.email ?? "");
  const [accountId, setAccountId] = useState<string>("default");

  const { data: accounts } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: listEmailAccountsForWorkspace,
    enabled: open,
  });

  const send = useMutation({
    mutationFn: () =>
      testSendEmailTemplate(templateId, {
        to,
        locale,
        email_account_id: accountId === "default" ? undefined : accountId,
      }),
    onSuccess: () => {
      toast.success(
        t("emailCampaigns.templates.testSend.sent", {
          defaultValue: "Test email sent",
        }),
      );
      onOpenChange(false);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("emailCampaigns.templates.testSend.title", {
              defaultValue: "Send a test",
            })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t("emailCampaigns.templates.testSend.to", {
                defaultValue: "Send to",
              })}
            </Label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t("emailCampaigns.templates.testSend.from", {
                defaultValue: "From mailbox",
              })}
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  {t("emailCampaigns.templates.testSend.defaultAccount", {
                    defaultValue: "Workspace default",
                  })}
                </SelectItem>
                {(accounts ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => send.mutate()}
            disabled={send.isPending || !to.includes("@")}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {send.isPending
              ? t("common.sending", { defaultValue: "Sending…" })
              : t("emailCampaigns.templates.testSend.send", {
                  defaultValue: "Send test",
                })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
