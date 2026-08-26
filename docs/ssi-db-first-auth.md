# SSI DB-first authentication

Normal SSI requests load the encrypted credential row from Supabase before creating the SSI adapter. The persisted access/refresh token is restored into the SSI SDK; expired access tokens are refreshed before provider API calls, and rotated tokens are persisted back to the same credential row.
