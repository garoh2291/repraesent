import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";

export function meta() {
  return [
    { title: "Lead Form - Repraesent" },
    { name: "description", content: "Lead form" },
  ];
}

export default function LeadForm() {
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentWorkspace) {
      navigate("/", { replace: true });
      return;
    }

    const hasLeadFormProduct = currentWorkspace.products?.some(
      (p) => p.product_slug === "lead-form"
    );

    if (!hasLeadFormProduct) {
      navigate("/", { replace: true });
    }
  }, [currentWorkspace, navigate]);

  const hasAccess =
    currentWorkspace?.products?.some(
      (p) => p.product_slug === "lead-form"
    ) ?? false;

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold tracking-tight">Lead form</h1>
      <p className="mt-2 text-muted-foreground">
        Lead form content will go here.
      </p>
    </div>
  );
}
