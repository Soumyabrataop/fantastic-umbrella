Flow/Veo3 Integration Plan
===========================

Status
------
- Prerequisites satisfied (Python, requests).
- Flow account access confirmed.
- Initial session cookies captured.

Action Items
------------

4. Identify API Endpoints
- [x] Capture recent Flow/Veo3 network calls in browser devtools.
- [x] Record URL, method, and payload schema for each required action (video generation, job status, asset retrieval).
- [x] Note mandatory headers (User-Agent, Accept, Referer, XSRF tokens, etc.).

	- **batchAsyncGenerateVideoText**
		- URL: `https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText`
		- Method: `POST`
			- Required headers: `authorization` sourced from cookie credentials (`Bearer <OAuth-access-token>`), `content-type: text/plain;charset=UTF-8`, `accept: */*`, `x-browser-channel`, `x-browser-validation`, `x-browser-year`, `x-browser-copyright`, `x-client-data`, standard `sec-*` headers, `accept-language`, `referrer: https://labs.google/`.
		- Request body shape (JSON):
			```json
			{
				"clientContext": {
					"projectId": "<project-uuid>",
					"tool": "PINHOLE",
					"userPaygateTier": "PAYGATE_TIER_NOT_PAID"
				},
				"requests": [
					{
						"aspectRatio": "VIDEO_ASPECT_RATIO_<variant>",
						"seed": <int>,
						"textInput": {
							"prompt": "<prompt>"
						},
						"videoModelKey": "veo_3_1_t2v_fast_portrait",
						"metadata": {
							"sceneId": "<scene-uuid>"
						}
					}
				]
			}
			```
		- Response: operation handle containing `name` for polling (see status request).

	- **batchCheckAsyncVideoGenerationStatus**
		- URL: `https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus`
		- Method: `POST`
			- Required headers: same as generation call (reuse Bearer token + browser metadata headers).
		- Request body shape (JSON):
			```json
			{
				"operations": [
					{
						"operation": {
							"name": "<operation-id>"
						},
						"sceneId": "<scene-uuid>",
						"status": "MEDIA_GENERATION_STATUS_PENDING"
					}
				]
			}
			```
		- Response: status updates per scene (pending, succeeded, failure) with asset metadata.

5. Backend Proxy Service Design
	- [x] Decide target architecture (FastAPI async proxy in `main.py`).
	- [x] Map incoming routes to Flow/Veo3 endpoints and expected request/response bodies (`POST /generate-video` -> `video:batchAsyncGenerateVideoText`, `POST /generation-status` -> `video:batchCheckAsyncVideoGenerationStatus`).
	- [x] Define secure cookie injection strategy (load fresh cookies + bearer token from `FLOW_COOKIE_FILE` per request, attach as HTTP jar + Authorization header).
	- [ ] Document payload validation and logging rules (exclude sensitive headers/cookies).

6. Session Management
	- [ ] Determine cookie lifetime from browser observations.
	- [x] Create renewal SOP (manual refresh checklist + optional automation ideas such as Playwright/Selenium script).
		- Prototype `test_token_refresh.py` fetches OAuth token via `https://labs.google/fx/api/auth/session` using existing cookies.
		- FastAPI lifespan task automatically refreshes token using `TokenRefresher` and rewrites `cookie.json` before expiry (configurable margin via `FLOW_TOKEN_REFRESH_MARGIN`).
	- [ ] Plan storage format for refreshed cookies (encrypted file or secrets manager; never commit to repo).

7. Security & Compliance
- [ ] Restrict backend exposure (VPN, allowlist, or authentication middleware).
- [ ] Add secrets handling policy (environment variables, .env.local, or OS keychain).
- [ ] Review Google ToS and internal policies for session-based automation; document compliance notes.

8. Downstream Integration
- [ ] Choose storage target for generated assets (e.g., Supabase storage, GCS bucket, or local disk during prototype).
- [ ] Sketch data flow for post-processing (metadata logging, notifications).
- [ ] Define interfaces for any consuming services (web app, CLI, etc.).

9. Error Handling & Monitoring
- [ ] Enumerate failure scenarios (cookie expiry, 4xx/5xx responses, rate limits).
- [ ] Plan retry/backoff strategy and surfaced error messages.
- [ ] Outline minimal observability stack (structured logs, alert hooks).

Open Questions
--------------
- Confirm which Flow/Veo3 endpoints are mandatory for MVP.
- Decide where refreshed cookies will live during development (local .env file vs. secrets manager).
- Identify any rate limits or quotas imposed by Flow/Veo3 APIs.

Notes
-----
- The provided cookie dump in `cookie.json` should remain untracked by source control; treat it as temporary reference only.
- Re-validate cookies via browser before backend requests; session tokens may expire or be revoked without notice.
- Ensure `cookie.json` includes a synthetic entry with `"name": "authorization"` holding the latest OAuth bearer token (value copied from browser request headers). The backend now refuses to run without this entry to avoid sending session cookies as bearer tokens.
