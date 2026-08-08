import { useQuery } from "@tanstack/react-query";
import { getForm, getForms } from "~/lib/api/forms";

export function useForms(enabled = true) {
  return useQuery({
    queryKey: ["forms"],
    queryFn: getForms,
    enabled,
  });
}

/**
 * Named useFormDefinition, not useForm — `useForm` would collide with
 * react-hook-form and with the shadcn wrapper in app/components/ui/form.tsx.
 */
export function useFormDefinition(formId: string | undefined) {
  return useQuery({
    queryKey: ["form", formId],
    queryFn: () => getForm(formId!),
    enabled: !!formId,
  });
}
