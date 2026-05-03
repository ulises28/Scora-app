The "Everything is Clean" Response
When you click reset but the system was already free(no one in queue, no one locked).

    json
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
2. The "Lock Liberated" Response
When another athlete was in the middle of connecting and you "kicked" them out.

    json
{
    "success": true,
        "message": "System reset successful.",
            "hadActiveToken": false,
                "tokenRevoked": false,
                    "hadLock": true, // <--- This indicates someone was "holding the slot"
                        "queueCleared": false,
                            "queueSize": 0,
                                "details": "The queue, locks, and any stored active tokens were purged."
}
3. The "Queue Purged" Response
When there were multiple people waiting in the "Waiting Room"(Queue) and you cleared them all.

    json
{
    "success": true,
        "message": "System reset successful.",
            "hadActiveToken": false,
                "tokenRevoked": false,
                    "hadLock": true,
                        "queueCleared": true, // <--- This indicates the waiting line was emptied
                            "queueSize": 3,       // <--- Number of users removed from the line
                                "details": "The queue, locks, and any stored active tokens were purged."
}
4. The "Strava Force Disconnect" Response
When the system found an active session and successfully told Strava to disconnect it.

    json
{
    "success": true,
        "message": "System reset successful.",
            "hadActiveToken": true,
                "tokenRevoked": true, // <--- This confirms Strava accepted the deauth
                    "hadLock": true,
                        "queueCleared": false,
                            "queueSize": 0,
                                "details": "The queue, locks, and any stored active tokens were purged."
}
5. Error: Incorrect Credentials(401)
If the ADMIN_USER or ADMIN_PASS provided in the prompt doesn't match the .env file.

json
{
    "error": "Unauthorized: Incorrect Admin credentials."
}
6. Error: Redis Missing(Diagnostic)
The state you saw earlier when the.env file wasn't being read correctly.

json
{
    "success": true,
        "redisMissing": true,
            "message": "Redis is not configured. Reset not necessary."
}
Pro Tip for your Test Case:
In Playwright, you can use page.route to intercept the call to / api / admin - reset and force it to return any of these JSONs to see how your UI(the alerts) reacts to each one!

3: 12 PM