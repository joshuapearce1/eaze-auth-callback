# eaze Auth callback

Static, authentication-only HTTPS bridge for `account.eaze.co.uk`.

The page accepts a Supabase `token_hash` and approved Auth type from the URL fragment only. It does not receive access tokens, refresh tokens, wellness content, user-profile data, analytics or server-side credentials. It returns only to the fixed native callback `uk.co.eaze.app://auth/callback` after an explicit user action.
