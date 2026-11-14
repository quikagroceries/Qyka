// Large photo/illustration assets served from Cloudinary instead of the Next
// bundle/public folder — f_auto,q_auto lets Cloudinary pick the smallest
// format (avif/webp) and quality per browser, cutting these from ~1-2MB
// originals down to well under 100KB on the wire.
const BASE = "https://res.cloudinary.com/y0vuqbu5/image/upload/f_auto,q_auto";

export const CAT_PANTRY = `${BASE}/v1794666605/site-assets/qyka-cat-pantry.png`;
export const CAT_PRODUCE = `${BASE}/v1794666608/site-assets/qyka-cat-produce.png`;
export const CAT_PROTEIN = `${BASE}/v1794666611/site-assets/qyka-cat-protein.png`;
export const HERO_PERSON = `${BASE}/v1794666614/site-assets/qyka-hero-person.png`;
export const TRUST_BASKET = `${BASE}/v1794666618/site-assets/qyka-trust-basket.png`;
// Capped at 1920w — the source is 3840x2161 (1.2MB), but this renders as a
// hero background that never needs more than viewport width, and the CSS
// mask-image usage below fetches this URL directly (bypassing next/image's
// own resizing), so the cap has to live in the URL itself.
export const HERO_STREET_SKY = `${BASE},w_1920,c_limit/v1794666620/site-assets/hero-street-sky.webp`;
