// The one inbox every "email us" link and apply form on the site points at.
// Temporary: quika.ng has no DNS/mail set up yet, so anything sent to
// hello@/agents@/riders@quika.ng bounced. Once the company domain's mailboxes
// exist, change this (or split it back into per-purpose addresses).
// Subjects on each link keep applications, support and press apart.
export const CONTACT_EMAIL = "qykagroup@gmail.com";

export function mailto(subject?: string) {
  return `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}

function mailtoWithBody(subject: string, body: string) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// The one "notify me when a market opens" email, used by every waitlist
// touchpoint (market picker, market cards, market detail page) so they all
// land in the same inbox with the same shape instead of each page inventing
// its own wording.
export function notifyMeMailto(marketLabel: string, email?: string) {
  const emailLine = email?.trim() ? `\n\nEmail: ${email.trim()}\n` : "\n";
  return mailtoWithBody(`Notify me — ${marketLabel}`, `Please notify me when Qyka opens at ${marketLabel}.${emailLine}`);
}

// Same idea for "my city isn't listed at all yet" - no specific market to
// name, just a city.
export function cityRequestMailto(city: string) {
  return mailtoWithBody(
    `City request — ${city.trim()}`,
    `Please consider adding ${city.trim()} as a Qyka market city.\n`
  );
}
