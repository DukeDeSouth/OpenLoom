# OpenLoom Security Audit

> Full audit before first public deploy. Date: 2025-02-25

---

## BLOCKER — fix before deploy

These can damage reputation or leak secrets if someone deploys as-is.

### 1. Fallback SECRET_KEY allows JWT forgery
- **Files:** `src/lib/auth.ts:6`, `src/lib/access.ts:3`
- **Issue:** `process.env.SECRET_KEY || "change-me-in-production"` — if user forgets to set SECRET_KEY, anyone can forge JWT tokens and impersonate any user.
- **Risk:** Full account takeover on misconfigured instances.

### 2. Missing `.dockerignore` — secrets baked into image
- **File:** `.dockerignore` (missing)
- **Issue:** `COPY . .` in both Dockerfiles copies `.env`, `.git`, `node_modules` into the build context and image layers. Anyone who pulls or inspects the image gets the secrets.
- **Risk:** SECRET_KEY, DATABASE_URL, S3 credentials leaked.

### 3. Worker container runs as root
- **File:** `Dockerfile.worker`
- **Issue:** No `USER` directive. Everything runs as UID 0. If ffmpeg or whisper has a vulnerability, attacker gets root in the container.
- **Risk:** Container escape, visible to any security reviewer — bad for reputation.

### 4. Health endpoint leaks internal errors
- **File:** `src/app/api/health/route.ts:17-18,27,37,62`
- **Issue:** `e.message` is returned in JSON. Can expose connection strings (`postgres://user:pass@host`), internal paths, Redis errors etc. This endpoint is public.
- **Risk:** Credential leakage via error messages.

---

## BACKLOG — post-deploy improvements

Sorted by priority within each tier.

### HIGH

| # | Issue | File(s) | Notes |
|---|-------|---------|-------|
| 5 | No rate limiting on login/register | `api/auth/login`, `api/auth/register` | Brute-force risk. Mitigated by being self-hosted (fewer attackers), but should add. |
| 6 | No upload file size limits | `api/upload/presign` | User can upload multi-GB files. Add presigned URL conditions or server check. |
| 7 | IDOR: any authed user can delete sections, keys, invite codes | `api/sections/[id]`, `api/keys/[id]`, `api/invite-codes/[id]` | Mostly single-admin self-hosted, but multi-user setups are vulnerable. Needs userId on Section model. |
| 8 | No server-side file type validation | `api/upload/presign` | Client can override Content-Type. Verify via ffprobe in worker before processing. |
| 9 | MinIO CORS allows `*` origins | `scripts/init-minio.sh` | Any website can read the bucket. Lock to BASE_URL. |
| 10 | MinIO port 9000 exposed on host | `docker-compose.yml:93` | Should bind `127.0.0.1:9000:9000` or remove in prod. |
| 11 | No input length validation on auth | `api/auth/register`, `api/auth/login` | Giant strings → DoS. Add max lengths. |

### MEDIUM

| # | Issue | File(s) |
|---|-------|---------|
| 12 | No security headers (X-Frame-Options, CSP, nosniff) | `next.config.ts` |
| 13 | Redis without password | `docker-compose.yml` |
| 14 | Worker: no global uncaught exception handler | `src/worker/index.ts` |
| 15 | Worker: temp directories not cleaned up | `src/worker/compose.ts`, `thumbnail.ts`, `transcribe.ts` |
| 16 | No React Error Boundaries | Frontend components |
| 17 | No pagination on list endpoints | `api/videos`, `api/sections`, `api/invite-codes` |
| 18 | Race condition in single-use access keys | `api/access/verify` — two concurrent requests can both activate. Edge case, low probability. |

### LOW

| # | Issue |
|---|-------|
| 19 | Email enumeration on register ("Email already registered") |
| 20 | Session + access tokens share same secret |
| 21 | `req.json()` without Content-Type check |
| 22 | Prisma no `$disconnect` on SIGTERM |
| 23 | Partial SECRET_KEY logged in install.sh |

---

## Already good

- bcrypt cost 12 for passwords
- `bcrypt.compare` — constant-time (no timing attacks)
- Login: same error for wrong email and wrong password
- `httpOnly`, `secure` (prod), `sameSite: "lax"` on cookies
- Prisma ORM — no SQL injection possible
- `execFile` (not `exec`) for ffmpeg — no shell injection
- Video ownership enforced by userId
- App container runs as non-root (`USER nextjs`)
- `.env` in `.gitignore`
- No internal methodology references in code
