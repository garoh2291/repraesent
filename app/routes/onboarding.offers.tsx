import { redirect } from "react-router";

export async function loader() {
  return redirect("/onboarding/products", 302);
}

export default function OnboardingOffersRedirect() {
  return null;
}
