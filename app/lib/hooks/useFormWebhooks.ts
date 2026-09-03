import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  createFormWebhook,
  deleteFormWebhook,
  getFormWebhookPayloadKeys,
  listFormWebhookDeliveries,
  listFormWebhooks,
  redeliverFormWebhook,
  rotateFormWebhookSecret,
  testFormWebhook,
  updateFormWebhook,
  type CreateFormWebhookBody,
  type FormWebhook,
  type FormWebhookDelivery,
  type FormWebhookEvent,
  type PayloadKeysResponse,
  type UpdateFormWebhookBody,
} from "~/lib/api/form-webhooks";

/**
 * Key factory. The form id is in every key: the webhooks are per form, and
 * the whole cache is dropped on a workspace switch anyway (use-auth.ts).
 */
export const formWebhookKeys = {
  list: (formId: string) => ["form-webhooks", formId] as const,
  payloadKeys: (formId: string) =>
    ["form-webhook-payload-keys", formId] as const,
  deliveries: (formId: string, webhookId: string) =>
    ["form-webhook-deliveries", formId, webhookId] as const,
};

export function useFormWebhooks(formId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: formWebhookKeys.list(formId ?? ""),
    queryFn: () => listFormWebhooks(formId!),
    enabled: !!formId && enabled,
  });
}

/**
 * The keys a form produces, from its DRAFT. Invalidated by the builder after a
 * definition save, so a field added a moment ago is already in the table.
 */
export function usePayloadKeys(
  formId: string | undefined,
  enabled = true,
  options?: Pick<UseQueryOptions<PayloadKeysResponse>, "staleTime">,
) {
  return useQuery({
    queryKey: formWebhookKeys.payloadKeys(formId ?? ""),
    queryFn: () => getFormWebhookPayloadKeys(formId!),
    enabled: !!formId && enabled,
    staleTime: options?.staleTime ?? 60_000,
  });
}

export function useWebhookDeliveries(
  formId: string | undefined,
  webhookId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: formWebhookKeys.deliveries(formId ?? "", webhookId ?? ""),
    queryFn: () => listFormWebhookDeliveries(formId!, webhookId!),
    enabled: !!formId && !!webhookId && enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

export function useInvalidateFormWebhooks(formId: string | undefined) {
  const qc = useQueryClient();
  return async () => {
    if (!formId) return;
    await qc.invalidateQueries({ queryKey: formWebhookKeys.list(formId) });
  };
}

export function useCreateWebhook(formId: string) {
  const invalidate = useInvalidateFormWebhooks(formId);
  return useMutation({
    mutationFn: (body: CreateFormWebhookBody) =>
      createFormWebhook(formId, body),
    onSuccess: invalidate,
  });
}

/**
 * Optimistic for `is_active` and `events` — the switch on the card must flip
 * under the finger, not after a round trip. Everything else waits.
 */
export function useUpdateWebhook(formId: string) {
  const qc = useQueryClient();
  const key = formWebhookKeys.list(formId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateFormWebhookBody }) =>
      updateFormWebhook(formId, id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<FormWebhook[]>(key);
      if (previous) {
        qc.setQueryData<FormWebhook[]>(
          key,
          previous.map((w) =>
            w.id === id
              ? {
                  ...w,
                  ...(body.is_active !== undefined
                    ? { is_active: body.is_active }
                    : {}),
                  ...(body.events !== undefined ? { events: body.events } : {}),
                }
              : w,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteWebhook(formId: string) {
  const invalidate = useInvalidateFormWebhooks(formId);
  return useMutation({
    mutationFn: (id: string) => deleteFormWebhook(formId, id),
    onSuccess: invalidate,
  });
}

export function useTestWebhook(formId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, event }: { id: string; event?: FormWebhookEvent }) =>
      testFormWebhook(formId, id, event),
    onSettled: (_r, _e, { id }) => {
      void qc.invalidateQueries({ queryKey: formWebhookKeys.list(formId) });
      void qc.invalidateQueries({
        queryKey: formWebhookKeys.deliveries(formId, id),
      });
    },
  });
}

export function useRedeliver(formId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deliveryId }: { id: string; deliveryId: string }) =>
      redeliverFormWebhook(formId, id, deliveryId),
    onSettled: (_r: FormWebhookDelivery | undefined, _e, { id }) => {
      void qc.invalidateQueries({ queryKey: formWebhookKeys.list(formId) });
      void qc.invalidateQueries({
        queryKey: formWebhookKeys.deliveries(formId, id),
      });
    },
  });
}

export function useRotateSecret(formId: string) {
  const invalidate = useInvalidateFormWebhooks(formId);
  return useMutation({
    mutationFn: (id: string) => rotateFormWebhookSecret(formId, id),
    onSuccess: invalidate,
  });
}
