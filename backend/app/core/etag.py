"""Conditional GET for polled endpoints: answer "nothing changed" with an
empty 304 instead of the whole payload.

The response carries an ETag (a fingerprint) and `Cache-Control: private,
no-cache`, which tells the browser to keep the body but check back every
time. On the next poll the browser itself adds `If-None-Match: <etag>`; when
it still matches we send 304 with no body and the browser hands the page its
cached copy. Nothing in the frontend has to know - plain fetch() does it.
"""

import hashlib
import json

from fastapi import Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

CACHE_CONTROL = "private, no-cache"


def _matches(request: Request, etag: str) -> bool:
    sent = request.headers.get("if-none-match", "")
    return etag in [t.strip() for t in sent.split(",") if t.strip()]


def not_modified(request: Request, etag: str) -> Response | None:
    """A ready 304 if the client already has this version, else None."""
    if _matches(request, etag):
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": CACHE_CONTROL})
    return None


def json_with_etag(request: Request, payload, *, etag: str | None = None) -> Response:
    """`payload` as JSON with an ETag - derived from the body itself unless a
    cheaper version marker was already computed - or a bare 304 on a match."""
    body = jsonable_encoder(payload)
    if etag is None:
        digest = hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        etag = f'W/"{digest[:32]}"'
    return not_modified(request, etag) or JSONResponse(
        body, headers={"ETag": etag, "Cache-Control": CACHE_CONTROL}
    )
