# SSI DB-first authentication

Normal SSI requests must load the encrypted credential row from Supabase before creating the SSI adapter. The persisted access/refresh token is restored into the SSI SDK; an expired access token is refreshed before provider API calls, and rotated tokens are persisted back to the same credential row.

The application-layer session cache is not used as the credential source for normal API requests. This prevents stale in-memory tokens from causing SSI 401 responses after another request/process has rotated the token.
