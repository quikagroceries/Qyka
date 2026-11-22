"""The one check for image links users send us: they must be uploads on OUR
Cloudinary account. Used by every field that stores an image link - profile
photos, market covers, purchase receipts, chat images, packing photos - so
nobody can plant an outside (or malicious) URL that an admin or customer
would later open.

Matched exactly, not by substring: https, host exactly res.cloudinary.com
(so cloudinary.evil.com and res.cloudinary.com.evil.com fail), no user/port
tricks, and the first path segment must be our cloud name (so an image on
someone else's Cloudinary account fails too).
"""

from urllib.parse import urlsplit

from app.core.config import settings

CLOUDINARY_HOST = "res.cloudinary.com"


def is_our_cloudinary_url(url: str) -> bool:
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        return False
    if parts.scheme != "https" or parts.username or parts.password or port is not None:
        return False
    if (parts.hostname or "").lower() != CLOUDINARY_HOST or parts.netloc.lower() != CLOUDINARY_HOST:
        return False
    segments = [s for s in parts.path.split("/") if s]
    return bool(segments) and segments[0] == settings.cloudinary_cloud_name


def require_our_image_url(url: str, message: str = "Image must be uploaded through Qyka") -> str:
    """For pydantic validators: returns the URL, or raises ValueError (-> 422)."""
    if not is_our_cloudinary_url(url):
        raise ValueError(message)
    return url
