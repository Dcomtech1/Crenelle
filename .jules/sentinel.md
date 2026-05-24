## 2026-05-22 - [CRITICAL] Unauthenticated Open Mail Relay via Event Spoofing
**Vulnerability:** The `/api/send-email` endpoint was completely unauthenticated and accepted the `event` payload (including event name, date, time, venue) directly from the client request body. This allowed an attacker to spoof event details and send arbitrary, deceptive emails (phishing) to anyone using the application's email infrastructure (Resend).
**Learning:** Never trust client-provided payloads for sensitive operations, especially when those payloads determine the content of communications sent on behalf of the application. Authentication and authorization must be verified at the endpoint level.
**Prevention:**
1. Secure the endpoint using `supabase.auth.getUser()`.
2. Do not accept the `event` object from the request. Instead, fetch it securely from the database using the provided `eventId`.
3. Rely on Row Level Security (RLS) to ensure that the authenticated user actually owns the event they are trying to send emails for.
## 2026-05-20 - Unauthenticated Access to Email Sending API
**Vulnerability:** The `/api/send-email` API endpoint was completely unauthenticated. It accepted POST requests with email details and sent them via Resend using the server's API key. This is a critical SSRF/Open Mail Relay vulnerability that could be abused to send spam.
**Learning:** Next.js API routes must explicitly check for authentication, even if they are only intended to be called by the frontend application or server actions. Server actions might use a client that implicitly checks cookies, but raw API routes do not.
**Prevention:** Always verify that API endpoints performing sensitive actions (like sending emails or accessing user data) have explicit authentication checks (e.g., `await supabase.auth.getUser()`) before processing the request.
