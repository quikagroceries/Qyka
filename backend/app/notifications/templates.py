"""Email for critical notifications - same look as the login-code email
(auth/email_templates.py): table layout, inline styles, no remote images."""

from datetime import datetime, timezone
from html import escape

from app.auth.email_templates import CREAM, FONT, INK, LINE, MUTED, ORANGE, ORANGE_DARK

# kind -> (subject, eyebrow, heading)
_COPY = {
    "payment_due": ("Payment due on your Qyka order", "Payment due", "Your order is ready to pay for"),
    "out_for_delivery": ("Your Qyka order is on its way", "Out for delivery", "Your order is on its way"),
}
_DEFAULT = ("An update on your Qyka order", "Order update", "An update on your order")


def notification_email(kind: str, message: str) -> tuple[str, str, str]:
    """Returns (subject, plain_text, html)."""
    subject, eyebrow, heading = _COPY.get(kind, _DEFAULT)
    year = datetime.now(timezone.utc).year
    m = escape(message)

    text = (
        f"{heading}\n\n{message}\n\n"
        "Open the Qyka app to see your order.\n\n"
        f"Qyka Groceries · Ibadan, Nigeria\n© {year} Qyka Technologies Ltd"
    )
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>{escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:{CREAM};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{CREAM};">{m}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{CREAM};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
    <tr><td style="padding:0 4px 20px;font-family:{FONT};">
      <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;background:{ORANGE};color:{INK};border-radius:10px;font-size:20px;font-weight:800;vertical-align:middle;">Q</span>
      <span style="font-size:22px;font-weight:800;color:{INK};vertical-align:middle;padding-left:8px;letter-spacing:-0.3px;">Qyka</span>
      <span style="font-size:11px;font-weight:700;color:{MUTED};vertical-align:middle;padding-left:6px;letter-spacing:1.5px;text-transform:uppercase;">Groceries</span>
    </td></tr>
    <tr><td style="background:#FFFFFF;border-radius:20px;border-top:4px solid {ORANGE};padding:36px 32px 32px;font-family:{FONT};">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:{ORANGE_DARK};">{escape(eyebrow)}</p>
      <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:800;color:{INK};letter-spacing:-0.4px;">{escape(heading)}</h1>
      <p style="margin:0;font-size:16px;line-height:1.55;color:{INK};">{m}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
        <tr><td style="border-top:1px solid {LINE};padding-top:20px;font-size:13px;line-height:1.55;color:{MUTED};font-family:{FONT};">Open the Qyka app to see your order. This is a service message about an order you placed, so it&rsquo;s sent even if you&rsquo;ve turned off other notifications.</td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:24px 8px 0;font-family:{FONT};font-size:12px;line-height:1.6;color:{MUTED};">
      Qyka Groceries &middot; Ibadan, Nigeria<br>&copy; {year} Qyka Technologies Ltd
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>"""
    return subject, text, html
