# Strava Integration & Slot Resilience Guide

This document acts as the master reference for Scora's integration with the Strava API. It captures the architectural constraints, history of failure modes (lessons learned), state management design (Redis + Queue), and emergency mitigation plans. 

> [!IMPORTANT]
> **For future AI Agents & Engineers**: Whenever you encounter a `403 Forbidden`, `500 Internal Server Error` on `/api/strava-activities`, or lock-related issues, **you must read this document first** to understand the historical context and prevent regressing the queue state machine.

---

## 1. The Core Constraint: The 1-Athlete Limitation
Scora's Strava application runs under a strict developer tier constraint where **only one athlete can be authorized at any single time**.
- If Athlete A is logged in, and Athlete B attempts to log in or exchange an authorization code, Strava will reject the request with a `403 Forbidden` error.
- To allow multiple users to use Scora, we must treat the Strava connection as a **single shared resource** that must be checked out, used quickly, and immediately returned.

### The Lifecycle Flow
1. **Queue Gate**: The user enters a FIFO queue managed via Redis.
2. **Lock Acquisition**: The user at the front of the queue is granted a temporary lock on the Strava slot.
3. **Login & Redirect**: The user is redirected to Strava to authenticate.
4. **Data Fetching**: Scora exchanges the auth code for a token, fetches the latest 10 activities, caches them in the user's browser, and fetches any required activity details.
5. **Immediate Deauthorization**: Immediately after fetching the activities, the application calls `/api/strava-deauth` to revoke the token on Strava's side. This releases the slot lock and allows the next user in the queue to log in.

---

## 2. Historical Outages & Lessons Learned

### A. Abandoned Sessions (Killed Tabs & Refreshes)
* **The Issue**: Users would connect to Strava, fetch their data, and close the browser tab or refresh the page before the `/api/strava-deauth` request could complete.
* **The Impact**: The token was left active on Strava's servers, and the local Redis lock would eventually expire, but the next user would get a permanent `403 Forbidden` from Strava because the slot was still occupied.
* **The Mitigation**:
  - We listen to `visibilitychange` (state: hidden), `pagehide`, and `beforeunload` to trigger an asynchronous `navigator.sendBeacon` request to `/api/strava-deauth`.
  - When a new session successfully acquires the Redis lock, it checks for an existing `strava:active_token` in Redis and preemptively deauthorizes it before starting its own OAuth flow.

### B. Safari's Popup & Redirect Policies
* **The Issue**: Safari aggressively blocks popups (`window.open`) when they are triggered from asynchronous callbacks (like polling timers or Promise resolutions) rather than direct, synchronous user gestures (like a click).
* **The Impact**: When a user waited in the queue and their turn arrived, Safari blocked the popup to Strava OAuth.
* **The Mitigation**: We shifted from popup-based OAuth to full-page redirects. When the queue polling detects the slot is free, the client performs a top-level redirection to Strava (`window.location.href`).

### C. Incognito / Private Browsing Sessions
* **The Issue**: Incognito windows restrict storage persistence (clearing sessionStorage/localStorage upon tab closure) and handle navigation state changes very strictly.
* **The Impact**: If a user closed an incognito tab during the fetch sequence, the beacon might not fire, and all local session IDs were lost, leaving the Redis lock and active token orphaned.
* **The Mitigation**: Redis locks are stored with a strict TTL (120 seconds for OAuth, 30 seconds for transfers) so they automatically clear. The `strava:active_token` is stored without a TTL so it can always be located and revoked by the next user or the admin tool.

---

## 3. The Redis Queue & Lock Architecture

Redis (Upstash) acts as the state coordinator. The following keys are used:

| Key | Type | Description |
| :--- | :--- | :--- |
| `strava:slot:lock` | String | Value: `sessionId` of current lock holder. TTL: 120s (resets to 30s during transfer). |
| `strava:slot:queue` | List | FIFO queue containing `sessionId`s waiting for their turn. |
| `strava:active_token` | String | The currently active Strava access token (stored so it can be cleared programmatically). |

### Handlers Summary
- **`/api/queue-join`**: Atomic check-and-set of the lock. If free, sets `strava:slot:lock` (TTL 120s) and returns position 0. Otherwise, pushes to `strava:slot:queue` and returns queue position.
- **`/api/queue-status`**: Returns the caller's position in `strava:slot:queue`.
- **`/api/strava-token`**: Exposes exchange endpoint. Confirms `sessionId` matches the lock holder. Saves the active token in `strava:active_token` (no TTL) and refreshes lock TTL to 120s to safeguard the data-fetching phase.
- **`/api/strava-deauth`**: Programmatically revokes the token on Strava, deletes `strava:active_token`, pops the next `sessionId` from `strava:slot:queue`, transfers the lock to them, and sets a 30s TTL.

---

## 4. UI Emergency Reset & Admin Rescue

Because a slot lockout halts production, we built two safety nets:

### The "Emergency Reset" Button (Frontend)
- When a user tries to connect and encounters a `403 Forbidden` error (indicating the slot is blocked), the frontend intercepts this and displays an **EMERGENCY BUTTON**.
- Clicking this triggers a prompt for the Admin credentials (`ADMIN_USER` / `ADMIN_PASS`).
- Once entered, the frontend sends a POST request to `/api/admin-reset` to force-release the lock and revoke the orphaned token.

> [!WARNING]
> **The 500 Error Bug (Fixed)**: 
> Previously, `/api/strava-activities` caught all fetch exceptions (including `403`s) and returned a generic `500 Internal Server Error`. Because of this, the frontend never received the `403` status code, hid the Emergency Button, and showed a generic *"Connection failed"* error, leaving the application permanently locked out.
> We resolved this by forwarding the exact status code from Strava back to the frontend.

### Manual Reset via `curl`
If the frontend is completely broken, administrators can trigger the reset via a basic authenticated request:

```bash
curl -X POST https://scora-app.vercel.app/api/admin-reset \
  -H "Authorization: Basic dWxpZGlvczp1bGlzZXMyOA==" \
  -H "Content-Type: application/json"
```
*(Base64 credentials: `ulidios:ulises28`)*

---

## 5. Development & Change Rules
1. **Keep Error Codes Transparent**: Never replace upstream HTTP codes (401, 403, 429) with generic 500s. The frontend relies on these to drive recovery flows.
2. **Verify Serverless Environment Variables**: In `api/` routes, avoid top-level global instantiation of clients that require environment variables (e.g. `new Redis(...)` outside the handler) without configuration checks. If variables are missing in non-prod environments, this crashes the entire handler file upon load.
