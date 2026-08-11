/**
 * The starting confirmation e-mail, in all four languages.
 *
 * Translated here at author time rather than pushed through the AI translator:
 * these four strings never change, and paying for a round trip — plus risking a
 * failure — to produce the same output every time would be silly. The AI
 * translator still handles whatever the customer edits afterwards.
 *
 * Written into `by_locale` when the confirmation e-mail is switched ON and the
 * copy is empty. Never overwrites: an operator who has already written
 * something and toggles the feature off and on again keeps their text.
 *
 * The markup is deliberately plain and inline-styled. Mail clients strip
 * <style> blocks with wild inconsistency, and this has to survive Outlook.
 */

import type { FormConfirmationEmailLocale, FormLocale } from "./schema";

interface Copy {
  subject: string;
  heading: string;
  greeting: string;
  body: string;
  footer: string;
}

const COPY: Record<FormLocale, Copy> = {
  en: {
    subject: "Thank you",
    heading: "Thank you for reaching out!",
    greeting: "Hi there,",
    body: "We have received your inquiry and will get back to you shortly.",
    footer: "You received this because you submitted a form on our website.",
  },
  de: {
    subject: "Vielen Dank",
    heading: "Vielen Dank für Ihre Nachricht!",
    greeting: "Hallo,",
    body: "Wir haben Ihre Anfrage erhalten und melden uns in Kürze bei Ihnen.",
    footer:
      "Sie erhalten diese E-Mail, weil Sie ein Formular auf unserer Website abgesendet haben.",
  },
  fr: {
    subject: "Merci",
    heading: "Merci de nous avoir contactés !",
    greeting: "Bonjour,",
    body: "Nous avons bien reçu votre demande et vous répondrons dans les plus brefs délais.",
    footer:
      "Vous recevez cet e-mail car vous avez envoyé un formulaire sur notre site.",
  },
  nl: {
    subject: "Bedankt",
    heading: "Bedankt voor uw bericht!",
    greeting: "Hallo,",
    body: "We hebben uw aanvraag ontvangen en nemen zo snel mogelijk contact met u op.",
    footer:
      "U ontvangt deze e-mail omdat u een formulier op onze website hebt verzonden.",
  },
};

function render(copy: Copy): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg,#1a1a2e,#16213e); padding: 36px 40px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #fff; }
    .body { padding: 36px 40px; }
    .body p { margin: 0 0 14px; font-size: 15px; line-height: 1.65; color: #444; }
    .footer { padding: 20px 40px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>${copy.heading}</h1></div>
    <div class="body">
      <p>${copy.greeting}</p>
      <p>${copy.body}</p>
    </div>
    <div class="footer">${copy.footer}</div>
  </div>
</body>
</html>`;
}

export function defaultConfirmationEmail(
  locale: FormLocale,
): FormConfirmationEmailLocale {
  const copy = COPY[locale] ?? COPY.en;
  return { subject: copy.subject, html: render(copy) };
}

/** True when there is nothing worth preserving at this locale. */
export function isEmptyConfirmationCopy(
  copy: FormConfirmationEmailLocale | undefined,
): boolean {
  if (!copy) return true;
  return copy.subject.trim() === "" && copy.html.trim() === "";
}
