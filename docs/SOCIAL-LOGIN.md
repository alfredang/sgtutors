# Social Login — Google (web + iOS) and Apple (iOS)

Tutor accounts can sign in with Google on the web, and with Google or Apple in the
iOS app. Admin login is unchanged (password only).

## Why the split

Apple's App Store Review Guideline **4.8** requires an equivalent privacy-preserving
login option (Sign in with Apple) in any app that offers third-party social login.
That rule applies to the **app**, not the website — so the web offers Google only,
and the iOS app offers both.

## How it works

Both providers use the same server-side shape: the client obtains an **ID token**
and POSTs it; the server verifies the signature and audience before minting a session.

```
web  ─ Google Identity Services ─┐
                                 ├─▶ POST /api/auth/social/{google|apple}
iOS  ─ native Google/Apple SDK ──┘        │
                                          ├─ verify signature + audience
                                          ├─ match googleSub / appleSub
                                          ├─ else match VERIFIED email → link
                                          └─ set tutor_token cookie (7d)
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/social/providers` | Which providers are configured; returns the web Google client id |
| `POST` | `/api/auth/social/google` | Body `{ idToken }` — verify and sign in |
| `POST` | `/api/auth/social/apple` | Body `{ idToken }` — verify and sign in |

### Sign-in, not sign-up

These endpoints **sign in or link an existing account**. They do not create tutor
records, because a listing requires NRIC, date of birth, mobile, a passport photo
and subject/level selections that OAuth cannot supply — a social-created account
would be an unusable half-listing. Unmatched identities get **404** and the client
routes the user to the full signup form.

### Account matching order

1. **Provider subject id** (`google_sub` / `apple_sub`) — the stable identifier.
2. **Verified email** — links the provider to an existing account, once.

An **unverified** email is never used to match. Otherwise anyone able to mint a token
asserting someone else's address could take over that account.

## Configuration

All optional — with nothing set, the Google button doesn't render and the endpoints
return **503**. Nothing else breaks.

```bash
# Web (Google Identity Services)
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...        # reserved; ID-token flow doesn't use it

# iOS app (different audience than the web client)
GOOGLE_IOS_CLIENT_ID=yyyy.apps.googleusercontent.com

# Sign in with Apple
APPLE_CLIENT_ID=com.tertiaryinfotech.sgtutors   # the app's bundle/service id
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=YYYYYYYYYY
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

Google Cloud Console → Credentials → OAuth client:
- **Web application** — add the site origin to *Authorised JavaScript origins*.
- **iOS** — a separate client keyed to the bundle id; its id goes in `GOOGLE_IOS_CLIENT_ID`.

The `APPLE_*` key fields are declared for the client-secret flow used by the *web*
Apple variant. The current iOS path verifies the ID token against Apple's public
JWKS and needs only `APPLE_CLIENT_ID`.

## iOS app work (separate repo)

The backend is ready; the app still needs:

1. **GoogleSignIn-iOS** SDK → get `idToken` → `POST /api/auth/social/google`.
2. **AuthenticationServices** `ASAuthorizationAppleIDProvider` → `identityToken`
   → `POST /api/auth/social/apple`.
3. Persist the returned session cookie in the app's HTTP client.
4. Handle **404** by opening the signup web view.
5. Add the *Sign in with Apple* capability in Xcode and enable it for the App ID.

## Database

Two nullable columns on `tutors`, plus a nullable `password_hash`:

```sql
ALTER TABLE tutors ADD COLUMN google_sub text UNIQUE;
ALTER TABLE tutors ADD COLUMN apple_sub  text UNIQUE;
ALTER TABLE tutors ALTER COLUMN password_hash DROP NOT NULL;
```

`password_hash` becomes nullable so a social-only account can exist without one.
Password login explicitly rejects accounts with a null hash rather than passing
null into bcrypt.

## Security notes

- ID tokens are verified server-side on every call — signature, issuer and audience.
  A forged or replayed token from another app's audience is rejected.
- Both endpoints are rate limited (20 per 15 min per IP).
- Provider subject ids are internal only and never returned by the public API.
