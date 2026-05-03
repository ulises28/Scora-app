# Admin Hard Reset Protocol

## Objective
To allow an administrator to forcibly clear the Strava connection slot and queue when the system is blocked (Error 403 or abandoned locks).

## Activation
- **Trigger**: URL parameter `?admin=scora` must be present.
- **Visibility**: The "🚨 ADMIN: FORCE RESET" button appears at the bottom of the Auth section.

## Verification Flow (The "Chain of Trust")
1. **Confirmation**: User clicks the button. System asks: "Esto eliminará de la fila... ¿Continuar?"
2. **Identification**: System asks for "Usuario Maestro".
3. **Authentication**: System asks for "Contraseña Maestra".
4. **Execution**: API `/api/admin-reset` is called with Basic Auth.
5. **Feedback**: A final browser `alert` displays the diagnostic results (Locks cleared, users removed, etc.).

## Testing Requirements
- Dialogs must be handled in sequence: `confirm` -> `prompt` -> `prompt` -> `alert`.
- The test must verify the final `alert` contains the string "SISTEMA REINICIADO".
- Environmental variables (ADMIN_USER/ADMIN_PASS) must be configured in the test runner.

## API Response Reference (for Mocking)

### Scenario 1: Everything is Clean
```json
{
    "success": true,
    "message": "System reset successful.",
    "hadActiveToken": false,
    "tokenRevoked": false,
    "hadLock": false,
    "queueCleared": false,
    "queueSize": 0,
    "details": "The queue, locks, and any stored active tokens were purged."
}
```

### Scenario 2: Active Lock Cleared
```json
{
    "success": true,
    "hadLock": true,
    "queueCleared": false,
    "queueSize": 0
}
```

### Scenario 3: Queue Cleared
```json
{
    "success": true,
    "hadLock": true,
    "queueCleared": true,
    "queueSize": 5
}
```

### Scenario 4: Redis Missing (Warning)
```json
{
    "success": true,
    "redisMissing": true,
    "message": "Redis is not configured. Reset not necessary."
}
```
