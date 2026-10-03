# eaze account links

Static authentication-only fallback for `account.eaze.co.uk`, hosted on GitHub Pages. Shares the app's Manrope font, exact existing wordmark path, approved E artwork and cream/olive/pastel palette. Local font and artwork only; font licence in assets/.

New email URLs use an exact action path and a fragment containing only `token_hash` and `type`:

- `/confirm/`: signup
- `/sign-in/`: magiclink
- `/reset-password/`: recovery
- `/email-change/`: email_change
- `/staging/` prefixes each test-environment action.

The app verifies one-time proof against its own pinned backend. This page makes **no verification request**, has no cookies/session storage/analytics, strips the fragment immediately and opens only a fixed `uk.co.eaze.app://auth/...` URL after a member's explicit tap. A mail scanner fetch cannot consume the proof. Invalid links have no active authentication button. An unsuccessful app-open attempt can be retried.

Compatibility: existing root-fragment links keep `/auth/callback`, and existing `/confirm/` links keep `/auth/confirm`. Their purpose and proof are preserved. The older `confirm/confirm.js` and `confirm/style.css` remain available for previously cached documents; new documents use assets/account-link.js and assets/account.css.

The AASA file lists only account-action paths for the existing app identifier `7PVT5WZ6V8.uk.co.eaze.app`. Universal Links additionally require the Associated Domains entitlement in an installed signed app, Apple's association cache and a supporting email client. A website deployment alone cannot update an installed iPhone binary.

`bun test account-link.test.js` checks fixed handoffs, no automatic token consumption, malformed/mixed-purpose links, compatibility and page CSP. Preview locally with `python3 -m http.server 4341 --bind 127.0.0.1`. Use synthetic proof only for previews.

Do not change production email templates until the signed native flow has passed owner-assisted acceptance. App signup, sign-in and password recovery are separate actions; requesting a sign-in link must not silently create an account.
