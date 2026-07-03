# Strava Integration Resilience Guide

This document describes Scora's Strava slot management architecture, details the recent outage, and outlines recovery procedures to keep production running.

---

## 1. Architecture Overview
Because the Strava application operates under a strict **1-athlete limit** (designed for single-user dev apps), Scora enforces a queue/lock system using Redis:

1. **Locking (`strava:slot:lock`)**: Restricts access to a single active browser session ID.
2. **Queueing (`strava:slot:queue`)**: Places other connecting users in a FIFO queue.
3. **Active Token (`strava:active_token`)**: Stores the active oauth token in Redis.
4. **Deauthorization**: When a user's flow completes (or they close the tab), the token is revoked on Strava's side via POST `/api/strava-deauth` (or a `navigator.sendBeacon` call on unload). This releases the queue slot.

---

## 2. The Failure Mode (Why Prod Went Down)
If an athlete session was abandoned without deauthorizing, the 1-athlete slot remained locked.
When a new user tried to connect:
1. Strava returned a `403 Forbidden` response because another athlete was already authorized.
2. The `/api/strava-activities` wrapper intercepted this error, but instead of forwarding the `403` status code, it logged the error and returned a generic `500 Internal Server Error` to the client.
3. The frontend (configured to show the **Emergency Reset / Rescue Button** on `403`) instead showed the generic `500` error message: *"Internal server error. Connection failed."*
4. Because the Emergency Reset button was hidden, administrators/users could not clear the lockout state, resulting in a permanent outage in production.

### The Fix
The wrapper in [strava-activities.ts](file:///Users/ulises/Developer/Scora-app/api/strava-activities.ts) now forwards the exact status code from the Strava response directly back to the client:
```typescript
if (!activitiesResponse.ok) {
    console.error(`[API Error] Strava API returned ${activitiesResponse.status}`);
    return res.status(activitiesResponse.status).json({
        error: 'Strava API Error',
        message: `Strava API error: ${activitiesResponse.status}`
    });
}
```
This restores the **Emergency Button** visibility so the lock can be cleared by administrators directly from the UI.

---

## 3. Emergency Manual Recovery
If the UI is inaccessible or you need to unlock the queue immediately, you can trigger a full admin reset via `curl`.

Using the credentials defined in your `.env.local` (or Vercel environment variables):
- **User**: `ulidios`
- **Pass**: `ulises28` (or the set `ADMIN_PASS` in production)

Execute the following request to wipe all locks and revoke any lingering tokens on Strava:

```bash
curl -X POST https://scora-app.vercel.app/api/admin-reset \
  -H "Authorization: Basic dWxpZGlvczp1bGlzZXMyOA==" \
  -H "Content-Type: application/json"
```

*(Note: `dWxpZGlvczp1bGlzZXMyOA==` is the base64 encoding of `ulidios:ulises28`)*

---

## 4. Best Practices for Future Changes
1. **Never suppress status codes**: When writing API wrappers in `/api/*.ts`, always forward the downstream HTTP status code to the frontend instead of masking it with `500 Internal Server Error`.
2. **Module-level safety**: Do not initialize clients (like Redis) globally at the top level of the module without wrapping them or checking if variables are configured, as it can cause complete serverless function startup failures (500) if environment variables differ between environments.
