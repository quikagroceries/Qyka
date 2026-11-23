"""Off-app delivery for critical notifications: email (Resend) and SMS (Termii).

Best-effort by design: a notification is a side effect of something that
already happened (an order went out for delivery, a payment fell due), so a
provider being down or unconfigured must never fail that action. Every path
here logs and returns False instead of raising.

Same providers and settings as the login codes (auth/otp_delivery.py): SMS
needs SMS_API_KEY, email needs EMAIL_API_KEY. With a key missing, that
channel is skipped quietly - which is how SMS behaves until Termii is set up.
"""

import logging

import httpx

from app.core.config import settings
from app.notifications.templates import notification_email

logger = logging.getLogger(__name__)

# Tests swap this for httpx.MockTransport so no real request is ever made.
_transport: httpx.AsyncBaseTransport | None = None


async def send_email(to: str, kind: str, message: str) -> bool:
    if not settings.email_api_key:
        logger.info("Email not configured; skipping %s email", kind)
        return False
    subject, text, html = notification_email(kind, message)
    payload = {"from": settings.email_from, "to": [to], "subject": subject, "text": text, "html": html}
    headers = {"Authorization": f"Bearer {settings.email_api_key}"}
    try:
        async with httpx.AsyncClient(timeout=10.0, transport=_transport) as client:
            response = await client.post(
                f"{settings.email_base_url.rstrip('/')}/emails", json=payload, headers=headers
            )
    except httpx.HTTPError as exc:
        logger.warning("Notification email (%s) failed: %s", kind, exc)
        return False
    if response.status_code >= 400:
        logger.warning("Email provider rejected %s: %s %s", kind, response.status_code, response.text[:200])
        return False
    return True


async def send_sms(phone: str, kind: str, message: str) -> bool:
    if not settings.sms_api_key:
        logger.info("SMS not configured (no Termii key); skipping %s SMS", kind)
        return False
    payload = {
        "api_key": settings.sms_api_key,
        "to": "".join(ch for ch in phone if ch.isdigit()),
        "from": settings.sms_sender_id,
        "sms": f"Qyka: {message}",
        "type": "plain",
        "channel": "dnd",  # transactional route: also reaches DND-listed numbers
    }
    try:
        async with httpx.AsyncClient(timeout=10.0, transport=_transport) as client:
            response = await client.post(f"{settings.sms_base_url.rstrip('/')}/api/sms/send", json=payload)
    except httpx.HTTPError as exc:
        logger.warning("Notification SMS (%s) failed: %s", kind, exc)
        return False
    if response.status_code >= 400:
        logger.warning("SMS provider rejected %s: %s %s", kind, response.status_code, response.text[:200])
        return False
    return True


async def send_off_app(user, kind: str, message: str) -> dict[str, bool]:
    """Every off-app channel the user can be reached on: email if they have
    an address, SMS if they have a phone. Returns what actually went out."""
    return {
        "email": await send_email(user.email, kind, message) if user.email else False,
        "sms": await send_sms(user.phone, kind, message) if user.phone else False,
    }
