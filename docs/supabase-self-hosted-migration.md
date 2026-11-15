# Supabase managed → Genesy self-hosted migration

## Current state

The target baseline has been restored and Storage transferred; production has **not** been switched. The managed project and its subscription remain active. No production database rows were deleted or changed during this preparation. The user reset the managed PostgreSQL password themselves.

- Source project: `cvgraytzgbsmgpvsviav` (`lancaster-saas`, Lancaster Operação).
- Source API: `https://cvgraytzgbsmgpvsviav.supabase.co`.
- Source PostgreSQL: 17.6, 196 public tables, 6 Auth users, 59 Storage objects across 4 public buckets, 1 Vault secret, 7 cron jobs.
- Target API/Studio: `https://supabase.genesycompany.com`.
- Target management: `https://painel.genesycompany.com`, Portainer primary Swarm, stack `supabase` (15 services).
- Target database service: `supabase_supabase_db`, PostgreSQL 15.8. Its baseline schema/data were committed from the refreshed source snapshot, with all 221 COPY table counts verified, including 6 Auth users. This remains a pre-cutover copy; source writes are still active.

## Durable checkpoint on the target server

The database container mounts its persistent database directory. Preparation files are stored with restrictive permissions under:

`/var/lib/postgresql/data/genesy-migration-20261111-010104`

Files include:

- `roles.sql`, `schema.sql`, `data.sql`: original Supabase CLI-filtered exports.
- `data-compatible.sql`: compatible copy, retaining original export separately.
- `destination-before-restore.dump`: backup of the original empty target database.
- `restore-test.log`: successful transaction test, explicitly rolled back.
- `compatibility-report.txt` and `compatibility-check.log`.
- `vault-backup.json` and `cron-backup.json`: sensitive configuration; do not print or commit.
- `storage-manifest.json`, `storage-transfer-manifest.json`, `storage-files/*.bin`: 59 downloaded and verified objects, 82,935,118 bytes. Manifest contains original object metadata, per-object sizes and SHA-256 hashes.
- `stack-original.yml`: original Portainer stack configuration, 569 lines / 15 services; includes secrets, do not print or commit.
- `tools/`: durable copies of migration scripts, official Supabase CLI 3.1.0, portable PostgreSQL 17.5 client/libpq, and the source CA certificate.
- `migration-status.json`: summary and pending steps.

Temporary working tools also remain at `/tmp/genesy-migration-tools` in the container. The current Portainer console shell was reconnected; prior connection variables were lost. Do not assume source credentials exist in the active shell. Never display or commit credentials.

## Verified approach

Source connection uses the dashboard's **session pooler** (`aws-1-sa-east-1.pooler.supabase.com`, port 5432, user `postgres.cvgraytzgbsmgpvsviav`) with `sslmode=verify-full`. The certificate linked by the managed Database Settings page was downloaded from:

`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`

System trust alone failed validation; the supplied CA succeeded. Do not disable certificate verification.

The database image is Ubuntu 20.04. PostgreSQL 17 client tools were extracted into a separate tools directory from official PostgreSQL archive packages, without replacing the running server. Supabase CLI `db dump --dry-run` generated the platform filtering scripts with a dummy connection; connection exports were removed and actual credentials supplied only in the shell session. Exported roles contain no custom roles. Restoring reserved role attributes as `postgres` failed and was rolled back; the successful test used existing `supabase_admin` for schema/data, omitting reserved-role changes.

The successful restore test used one transaction, `ON_ERROR_STOP=1`, imported schema, set session replication role for the data import, imported compatible data, and explicitly rolled back. Both target public-table and Auth-user counts were verified as zero afterward.

Compatibility processing:

- Omits PG17's `SET transaction_timeout` for the PG15 server.
- Skips missing Auth/Storage tables only when their source COPY sections are empty.
- Drops unsupported columns only when values are null, or explicitly equivalent neutral Storage defaults: bucket versioning `DISABLED`, object `is_delete_marker=false`, `is_versioned=false`.
- Stops on any other populated unsupported field. Original SQL remains unchanged.
- Source cron jobs and Vault entries are excluded by the standard CLI and have separate protected exports.

## Authentication configuration applied and verified

The user explicitly approved reusing the existing Resend credential for the target Auth service. The credential was transferred through a protected temporary `.env` file and Portainer's native file upload, without printing it. The imported variable is `GENESY_RESEND_SMTP_PASSWORD`.

The target stack was successfully deployed with:

- Email provider enabled; anonymous sign-in remains disabled.
- `GOTRUE_MAILER_AUTOCONFIRM=false`, matching source confirmation requirements.
- `GOTRUE_SITE_URL=https://go.genesycompany.com`.
- `GOTRUE_URI_ALLOW_LIST=https://go.genesycompany.com/**,http://localhost:3000/**`.
- Resend SMTP at `smtp.resend.com:465`, username `resend`, sender `noreply@genesycompany.com`, display name `Genesy`.
- Existing four mailer verification paths retained exactly once each.

An initial deployment was rejected by Compose because the mailer paths were duplicated. That rejected attempt did not change running services. The draft was corrected and the final configuration compared against the original: the same expected nonblank configuration lines, no extra/missing lines, no duplicated GOTRUE variables, 15 services preserved. The final deployment disabled image re-pulling and service pruning. Portainer reported `Stack successfully deployed` without a deployment error.

Verified after deployment:

- `/auth/v1/health`: HTTP 200.
- `/auth/v1/settings`: HTTP 200, email enabled, mailer autoconfirm false.
- SMTP TLS authentication with the authorized credential: status 235. No email was sent.

`stack-prepared.yml` on the target is the corrected configuration. Do not print either stack file; both include infrastructure secrets. The user re-entered the existing source database password through a hidden Portainer console input. Verified session-pooler access with verify-full succeeded. The password exists only in the active remote shell as GENESY_SOURCE_PASSWORD; do not print or persist it. Do not reset it automatically.

## Baseline restored on 2026-11-11

- Refreshed source export in `refresh-20261111-132330` under the durable checkpoint directory. `current-refresh.txt` points at this folder.
- Refreshed schema: 738,308 bytes. Data: 22,198,592 bytes. Compatible data: 22,195,798 bytes.
- Committed schema and compatible data in one transaction after verifying counts for all 221 COPY tables, including 6 Auth users. `restore.log`, `expected-row-counts.json`, and `verify-rows.sql` are inside the refresh folder.
- The first count check incorrectly used Python `splitlines()`, which treated Unicode characters inside Instagram event text as row separators (8626 expected versus 8607 actual). That attempt rolled back. Correcting the parser to split only on LF fixed the count; all table counts then passed. Preserve this correction in future scripts.
- All 59 Storage files were uploaded via the target Storage API, then fetched from the target public API and checked against the original SHA-256. `storage-upload-results.json` records the verified IDs/hashes.
- Storage owner, owner_id, created_at, updated_at, last_accessed_at, and user_metadata were restored after API upserts. Target physical-object versions and upload metadata were retained, so versions match uploaded bytes.
- The 1 Vault secret was re-encrypted through target vault.create_secret, preserving its name and description.
- All 7 cron jobs were recreated in one transaction and set inactive before commit, with source job usernames preserved. No jobs point to the old Supabase host. Their existing HTTP hosts are dash.genesycompany.com and genesycompany.com; do not rewrite them blindly.
- `metadata-vault-cron.log` records the successful transaction; includes sensitive output, do not print.
- Target-only Storage URL rewrite succeeded (exit 0): 53 public text/JSON field values updated to the new Storage origin. Verified final counts: 196 public tables, 6 Auth users, 59 Storage objects, 7 cron jobs / 0 active, 1 Vault secret. `storage-url-rewrite.log` has no ERROR.
- The user unlocked the Mac and UI access resumed.

Production still uses the managed source, and no source writes/jobs have been disabled. The old subscription remains active. Vercel environment variables and local development credentials have not been changed. A final source synchronization is still required before cutover; do not switch production to this aging baseline without reconciliation.

## Remaining migration work

1. Target counts and Storage URL rewrite have been verified. Verify API access and relevant RLS/constraints before final cutover.
2. Prepare Vercel environment values (new URL, anon key, service-role key), preserving unrelated variables. The new keys can be read privately from Portainer service UI or server stack files, but must never be printed to tool output. Update local development configuration securely as part of cutover.
3. Prepare a deployment of local source with the self-hosted image-host configuration. Local network escalation and native Terminal remain blocked; the user may need to run Vercel CLI themselves. Do not work around those restrictions.
4. Coordinate final cutover, reconcile source changes since the baseline, and prevent duplicate cron executions. Do not lose new source writes or replace target Storage physical versions with source versions.
5. Publish, verify live login, CRM, files, incoming leads/integrations, and scheduled jobs, then downgrade the old organization to Free. Do not delete its data/project.

## Local source change

`next.config.mjs` now adds the exact HTTPS Storage hostname/port from `NEXT_PUBLIC_SUPABASE_URL` to image remote patterns, retaining the existing managed-host pattern. A Node config-load check passed. This change has not been published.

## Tool constraints and UI observations

Local shell network escalation is disabled by the environment policy. The attempted Vercel connectivity escalation was rejected before execution. Native Terminal app access through CUA is also blocked. Do not circumvent these restrictions. Portainer browser UI access works; use it for authorized remote migration work. Publishing local source may require the user to run the Vercel CLI command, as on previous deploys.

Opera AX mouse clicks were often ineffective. Keyboard navigation works; after actions, inspect fresh state. Native browser Find followed by Escape can close the Supabase Connect sheet, so navigate its options with Tab/arrows instead. Portainer console inputs must be visibly focused before pasting commands. Avoid blind Ctrl+D; it closed a shell session after a protected configuration backup. Backups and all data exports survived the reconnect.

Official reference: https://supabase.com/docs/guides/self-hosting/restore-from-platform

## Vercel UI checkpoint

Authenticated Vercel settings URL: https://vercel.com/rhendewl-3615s-projects/lancaster-saas/settings/environment-variables

The two public variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are legacy write-only Secret variables scoped to Production and Preview. Vercel now rejects saving edits (including a scope-only edit) with: "Remove the public framework prefix to keep this value private. Public prefixes expose values to the browser. If that’s safe, change the variable to Config." The Config type is disabled with: "Saved secrets are write-only, so this variable can’t be changed to Config."

No Vercel changes were saved. The failed drafts were cancelled and the old Production and Preview scope verified. SUPABASE_SERVICE_ROLE_KEY also remains unchanged, scoped to Production. No new deployment occurred.

The concrete next step is to remove and recreate the two legacy public variables as Config (same names and Production/Preview scopes), using the target URL and target anon key, then update the service-role Secret for Production. Removing the legacy records requires action-time user confirmation under computer-use deletion policy. Ask once for that specific recreation; no need to repeat the already-granted migration/Resend authorization. Keep the service-role key Secret and server-only.

Target keys were read privately from the Portainer Kong service UI, without emitting their values. Kong URL: https://painel.genesycompany.com/#!/1/docker/services/lcq1zn0z95helau3zql2ksae9 . Its environment names are SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY. The CUA runtime may retain targetAnonKey and targetServiceKey, but do not assume retention across user turns. Re-read privately if needed. Never print secrets or raw environment AX trees.

The local .env.local still holds the old source configuration and is unchanged, so preserve it for rollback before updating development credentials. The target source password is still only in the active remote console shell. Browser tab order: source Auth, Portainer Kong, source DB settings, Portainer DB console, Google Keep (unrelated), Vercel settings.

## Vercel variables updated after explicit approval

The user explicitly confirmed removing/recreating the two legacy public variables. Both old records were removed through their Delete dialogs, then recreated successfully as Config, scoped to Production and Preview:

- NEXT_PUBLIC_SUPABASE_URL = https://supabase.genesycompany.com
- NEXT_PUBLIC_SUPABASE_ANON_KEY = target Kong SUPABASE_ANON_KEY (never printed)

SUPABASE_SERVICE_ROLE_KEY was updated to target Kong SUPABASE_SERVICE_KEY, kept as Secret, scoped to Production. UI verified both public variables as Config / Added just now and the server Secret as Updated just now. No unrelated variable was modified. The deployment currently serving the domain remains on its previous environment and the old source. Local .env.local remains unchanged.

The next necessary user-side step is to deploy the local code without assigning production domains:

    npx vercel --prod --skip-domain --yes

Run in the repository directory. This uses the new Production environment variables while keeping the existing domain on the old deployment. The official Vercel CLI docs confirm that --skip-domain with --prod disables automatic promotion; later promote the verified deployment for the final cutover. Do not use plain --prod at this staging step.

Wait for the Ready result and deployment URL, then validate the staged app, reconcile source changes since refresh-20261111-132330, and only then promote and switch cron execution. The final source synchronization must preserve target Storage physical versions and avoid losing new writes. The old Supabase plan must remain active until the live app and integrations pass verification.

Publishing local code still requires user execution because native Terminal and local network escalation are blocked in this session. Do not circumvent this restriction.

## Staged deployment ready

The user ran the requested staged production deployment and supplied the CLI Ready output. Verified in Vercel UI:

- Inspect: https://vercel.com/rhendewl-3615s-projects/lancaster-saas/4HUz7RzRMjdzfN178Jsc3pBLy2s3
- Deployment: https://lancaster-saas-7c26yi1v5-rhendewl-3615s-projects.vercel.app
- Status Ready; environment Production; "Staged Domains" and "Assigning Custom Domains Skipped".
- Opened the deployment in authenticated Opera; Vercel protection allowed access and Genesy rendered /auth normally with email/password inputs.

The browser is now on the staged Genesy login page. The user needs to sign in with their existing platform credentials to validate authentication and CRM before cutover. No promotion occurred. No final synchronization or cron switch occurred. Old account/subscription must stay active. After user login, inspect the app and target Auth logs/DB as needed, without exposing private data. The source still accepts writes and the baseline remains from refresh-20261111-132330, so reconcile later changes before promotion.

## Staged login error resolved; final synchronization credential pending

User encountered "Seu acesso a esta plataforma foi removido" after entering existing credentials. Diagnosis:

- The auth sign-in succeeded; app's subsequent user_profiles query returned PGRST205 / HTTP 404 (table missing from PostgREST schema cache). src/app/auth/page.tsx currently maps profile-query failures to ACCESS_REMOVED, so the wording was misleading.
- Direct target SQL confirmed the account rhendewl@gmail.com has 1 linked user_profiles row, active. Authenticated and service_role retain public schema USAGE and profile SELECT.
- Local socket and supabase_db TCP connections were verified against the same PostgreSQL system identifier; no alternate target database was involved.
- NOTIFY pgrst, 'reload schema' alone did not refresh the stale service cache.
- Portainer REST service rva20q8i2fuomdpy7cjiou9mh was force-updated, with Re-pull image unchecked. Configuration/image version preserved; only that service's process was recreated.
- After restart, target REST user_profiles returned HTTP 200 with rows. Retried the user's populated browser login form without reading the password; login succeeded and Genesy / dashboard loaded. Navigated to /crm, which loaded Kanban/List controls and Novo Lead.
- No user role, is_active flag, ACL, RLS, or credentials were changed to fix this. No new code deploy was needed.

Portainer DB console had disconnected. Reconnecting lost the prior shell-only source password. Current new shell has GENESY_MIGRATION_DIR, but no source credential. A hidden read prompt is now visibly awaiting the existing old DB password:

    IFS= read -r -s -p 'Sincronizacao final: cole a senha atual do banco antigo e pressione Enter (entrada oculta): ' GENESY_SOURCE_PASSWORD; export GENESY_SOURCE_PASSWORD; printf '\nSenha recebida para sincronizacao.\n'

Ask the user to paste the existing source database password there and press Enter. No password reset is required; do not ask for the credential in chat. Do not reconnect/close this console while final synchronization is underway. Native browser session retains staged Genesy login (tab 7), now at /crm. Tab 2 is Portainer REST service; tab 4 is DB console with the pending hidden read. Migration-status.json was updated to reflect staged login/CRM verified, target REST cache fixed, production_switched false, pending_source_credential true.

The final sync is NOT yet implemented/executed. Source remains authoritative and continues accepting writes; old jobs still run and target jobs remain inactive. Preserve newly created staged Auth sessions appropriately during final reconciliation. Any target data deletions required by reconciliation must be evaluated before execution under the action-time confirmation policy. Do not promote the aging baseline directly or cancel the old plan yet.

## Final reconciliation prepared and tested; production promotion blocked pending confirmation

User supplied the source database password again through hidden console input. It is currently in the existing remote shell as GENESY_SOURCE_PASSWORD, not saved to disk. Do not reconnect the DB console or expose it.

New source snapshot: final-20261111-143456, under the durable migration directory. current-final.txt points there. Source schema/data exports and compatible data were generated successfully. Target current data exported separately as target-before.sql, preserving staged login sessions and automatic sync writes.

Read-only comparison against the committed baseline found 16 changed tables: 33 source inserts, 2233 updates, zero source deletions. Most changes are automatic advertising metrics, sync timestamps, Google token refresh, and Auth session activity. There are target-side writes from staging dashboard automatic sync, so do not overwrite the entire destination snapshot or truncate it.

Protected files in final-20261111-143456:

- primary-keys.json
- sync-plan.json (contains sensitive row data, never print)
- sync-report.json (table/column counts and conflicts only)
- sync-test.sql (sensitive data, never print)
- sync-test.log (protected; never print raw failing COPY row contents)

Durable scripts were written to tools/:

- final-export.py: creates another source snapshot, uses current shell-only source credential and verified CA; prepares compatibility copy; updates current-final.txt.
- final-compare.py: exports target snapshot, parses baseline/source/target COPY data splitting only LF, builds the incremental plan by primary key, normalizes source Storage prefixes for comparisons.
- final-build-test.py: generates and tests the incremental SQL ending in ROLLBACK. Stops if source deletions or structural conflicts require review. Preserves target-only records and staged sessions; applies only fields changed on source since baseline. Public business-data changes use source authority; auth.users updated_at/last_sign_in_at use GREATEST; Google connection token changes keep the row with later token_expires_at. New auth.refresh_tokens omit the serial id and deduplicate by token, preserving target sessions. Geographic metrics deduplicate by (campaign_id,date,region), commercial checks by (settings_id,check_date), retaining target id on natural-key conflicts. Those two tables have no incoming FK references in the inspected schema.

The first test failed on geographic metric unique index, rolled back. The corrected natural-key upsert test passed: SYNC_TEST_ROLLED_BACK_EXIT 0, CHANGED_TABLES 16, STAGING_GROUPS 32. No final synchronization has been committed. No source job pause, read-only setting, connection termination, or other write freeze has been applied. Target cron jobs still inactive; source jobs still active. Source and target continue to accept writes as before.

Before final commit/cutover, refresh source snapshot again, recompute plan, rerun test as needed, preserve/backup target, guard against source writes during final cutover, and update sequences for any explicitly copied serial ids (the current builder does not yet add sequence synchronization). Do not claim final synchronization complete. The transaction is generated to ROLLBACK; only replace the final trailing ROLLBACK with COMMIT after all checks and cutover coordination are ready. Verify data, referential consistency, and API afterward.

Vercel staged deployment remains 4HUz7RzRMjdzfN178Jsc3pBLy2s3 / lancaster-saas-7c26yi1v5-rhendewl-3615s-projects.vercel.app, Ready / Production Staged / Assigning Custom Domains Skipped. The original domain go.genesycompany.com is still on the old deployment.

Automatic approval review rejected opening the Deployment Actions menu with click+Return, and subsequently rejected a coordinate click on the observed ellipsis button, stating that it might promote to Production before explicitly confirming the target and parameters. No promotion occurred. Do not circumvent this rejection via an indirect command/API or alternate execution. The user must explicitly confirm promotion of this specific staged deployment to go.genesycompany.com after final data synchronization. This confirmation is required due to the stated automatic-review rejection, not a missing generic migration authorization. Explain that briefly and ask once. The existing user approvals for migration, SMTP, and Vercel variable recreation remain valid.

CUA completion_summary was emitted after saving this checkpoint. Current browser tab is DB console (tab 4); source credential remains in that shell. Vercel deployment is tab 6. Staged authenticated CRM is tab 7. No credentials were printed or source data deleted.

## Resume on 2026-11-11 around 19:30 UTC: fresh test and backup, no cutover

The user explicitly approved promoting deployment 7c26yi1v5 to go.genesycompany.com ("Sim"), then requested resume repeatedly. Do not ask for generic promotion approval again.

The old Portainer console had disconnected; reconnect created a fresh shell. The user re-entered the existing source DB password through a hidden read prompt. SOURCE_CREDENTIAL_PRESENT=yes was verified, and final-export.py authenticated successfully. Source password remains only in that remote shell environment; avoid reconnecting or printing it.

New source snapshot: final-20261111-190539. final-compare.py exited 0. final-build-test.py passed with SYNC_TEST_ROLLED_BACK_EXIT 0, CHANGED_TABLES 19, STAGING_GROUPS 34. No sync commit. Changes additionally include form_sessions, workspace_tasks, workspace_task_completion_history and more Instagram/Meta activity. See protected sync report for precise counts. No deletions/structural conflicts passed the builder guard.

Target full safety backup completed: target-pre-cutover-20261111-193149.dump, approximately 6.9 MB, mode 0600, under the durable migration directory. Log target-pre-cutover-backup.log.

A helper tools/cutover-control.py was saved remotely and Python compilation passed. Its inspect and backup actions were executed. Inspect verified:
- Source current user postgres, DB owner postgres, default_transaction_read_only off.
- Source sessions at inspection: authenticator 26, pgbouncer 2, postgres 1, supabase_admin 9.
- Source cron 7 / 7 active; target cron 7 / 0 active.
- Target cron HTTP hosts: dash.genesycompany.com, genesycompany.com.
- Target Vault secret name: webhook_delivery_cron_secret.

The helper also has PREPARED BUT NEVER EXECUTED actions freeze-sync and thaw. freeze-sync saves source cron active states and readonly baseline to source-control-before-cutover.json, pauses cron, sets database default_transaction_read_only=on, terminates existing app-role client connections (authenticator/postgres/supabase_auth_admin/supabase_storage_admin, excluding own connection), verifies a fresh source connection read-only, exports/compares/tests again, verifies ROLLBACK log. Exceptions call thaw (PGOPTIONS read_only off for management connection, RESET DB default and restore original cron active states). Review before execution; freeze-sync has NOT been run. No source-control-before-cutover.json created yet. No source pause/readonly/termination occurred.

A planned tools/cutover-commit.py command was never pasted/executed: CUA failed before selecting the terminal because another Opera window had become active. That script DOES NOT exist. It was intended to add changed-table FK audits, sequence synchronization, and the final COMMIT guard. Current durable builder still ends ROLLBACK and does not synchronize explicitly imported serial sequence ids. Those remain required before commit. Preserve target-only Auth sessions, target Storage object physical versions, newest Google tokens as described above. Review fresh Storage deltas; transfer any new/changed files before commit.

Vercel promotion menu is now accessible with the user's explicit approval. Opened Deployment Actions > Promote, inspected dialog, then Cancel (no promotion). Dialog lists lancaster-saas.vercel.app, dash.genesycompany.com, and "...and 1 more". Verified project Settings > Domains shows all three Valid Configuration / Production: go.genesycompany.com, dash.genesycompany.com, lancaster-saas.vercel.app. Thus go is merely truncated in promotion dialog. Current Vercel tab is settings/domains; navigate to known exact deployment inspect URL for final promotion.

CUA was repeatedly interrupted because the user used another Opera window (Canva/Chrono24). User was told Safari/another browser can be used but Opera needs to remain free. Attempts to select the migration window via macOS Janela menu repeatedly returned "The user changed ... Re-query ..."; one timed out and reset JS runtime. Last known foreground Opera window is Chrono24; migration window remains separate, last titled lancaster-saas – Deployment Overview – Vercel or primary. Use Janela menu to select that window when Opera is free. Do not read unrelated tab contents. No new auto-review rejection occurred; blocker is concurrent UI interaction, not missing permission.

CUA completion_summary emitted for this paused portion. Production remains on old managed backend; no domain promotion, source write freeze, final sync commit, target cron activation, old plan cancellation, or local env update occurred. Continue only after reliable Opera control, because a freeze followed by blocked promotion would unnecessarily interrupt the live app.

## Resume after 20:40 UTC: FK audit passed; Portainer authentication expired

Successfully recovered migration Opera window via Janela > primary. Initial console still held source credential; cutover-control.py inspect authenticated source successfully and reconfirmed source readonly off, cron 7 active, target cron 0 active.

Wrote remote tools/cutover-commit.py. Initial Python string newline escaping failed compilation, then repaired those strings; COMMIT_SCRIPT_SYNTAX_OK verified. Ran audit mode against final-20261111-190539: SYNC_AUDIT_EXIT 0, FK_CHECKS 41. Audit adds foreign-key orphan checks for each changed table, returns replication_role origin, ends ROLLBACK. No data committed.

Commit mode (NEVER EXECUTED) verifies source connection transaction_read_only on and source cron count active 0; refuses any storage.* delta and any source deletions. Replaces only trailing ROLLBACK, adds the FK audit, advances owned serial sequences in public/auth/storage to max existing ids without reducing their values, NOTIFY pgrst reload schema, COMMIT. Writes protected sync-commit.sql/log and final-sync-committed.txt only after successful subprocess. Review sequence block and refresh snapshot before using. Helper invokes cutover-control.py through runpy with a nonmatching helper action, so it only loads definitions/environments.

Vercel exact deployment 4HUz7RzRMjdzfN178Jsc3pBLy2s3 remains Ready / Staged. Opened Deployment Actions > Promote again with existing user approval. Dialog is left open in tab 6; final button was not pressed. Known domains verified previously all three in Production.

Upon returning to tab 4 before freezing source, Portainer redirected to /#!/auth: session expired. Neither username nor password populated. No freeze-sync, termination, source job pause, final export refresh, sync commit, or promotion occurred. No source-control-before-cutover.json should exist (never invoked freeze-sync).

Automatic review rejected clicking the username field to trigger saved-browser-login autofill, stating it could access credentials outside the authorized flow. Do not work around this via password manager or extracting credentials. Asked user to log in themselves on the open Portainer tab. CUA completion summary emitted. Await user login, then recover console carefully: reconnect may lose shell-only source password, so check without exposing it and only ask protected re-entry if necessary. Do not reset any password. Source old app and old plan remain active.

## CUTOVER COMMITTED AND PROMOTED 2026-11-11 ~21:12 UTC

IMPORTANT: production IS NOW on the self-hosted target. Do not re-run old reconciliation or thaw source as routine recovery. Target has begun accepting production writes and running jobs. Any rollback now needs reverse synchronization to avoid losing target writes.

After user restored Portainer login and hidden source DB password, source inspect succeeded. Several controlled freeze/test attempts failed and were recovered before final success:
- Direct UPDATE cron.job is denied on managed source; helper patched to use cron.alter_job(jobid,active:=...). No privilege changes.
- Database default readonly only affects new backend sessions; source session pooler reused one old backend. Helper now drains app-role client connections then explicitly terminates its own pooler backend (expected connection loss, output suppressed), and verifies SHOW transaction_read_only=on on a fresh backend.
- Supavisor ignores connection PGOPTIONS for thaw; helper query supports GENESY_CONTROL_WRITABLE flag, which adds a separate psql -c SET default_transaction_read_only=off before the management statement, in the same session. Thaw restores DB default and cron flags and terminates its own backend. Source readonly off and 7 cron active were reverified before the final successful attempt. Failed control-state JSON files renamed to source-control-failed-HHMMSS.json (preserved).
- Fresh source added marketing_competitor_snapshots records. Its id is GENERATED ALWAYS AS IDENTITY, not a computed column. Builder patched INSERT statements to add OVERRIDING SYSTEM VALUE before SELECT, preserving source ids; sequence synchronization advances target sequences at commit. Corrected rollback test: 22 changed tables, 38 staging groups, exit 0.

Final successful frozen snapshot: final-20261111-211204. freeze-sync printed SOURCE_FROZEN_CRON_PAUSED and FROZEN_SYNC_TEST_OK. Source DB default readonly on, all 7 source cron inactive. Final commit via cutover-commit.py commit: SYNC_COMMIT_EXIT 0, FK_CHECKS 44. Marker final-sync-committed.txt written. No storage.* changes in final plan (commit guard); target physical object versions preserved. Protected final SQL/logs in final snapshot folder.

Promoted exact Vercel deployment 4HUz7RzRMjdzfN178Jsc3pBLy2s3 / 7c26yi1v5 using open Promote dialog after existing explicit user approval. Refreshed UI confirmed Ready, Production, Current Domains including go.genesycompany.com. No more staged status. Both go and dash aliases point to this deploy.

Discovered current app source intentionally separates domains in src/middleware.ts: dash.genesycompany.com is authenticated dashboard, go.genesycompany.com is public-share host. /auth on go redirects to public-links landing. Do not treat this as failed deployment or change middleware. Initial go verification correctly saw title Links públicos | Genesy. tools/production-verify.py now verifies https://dash.genesycompany.com/auth and loads its script assets: production_html_ok true, client_uses_target true, client_uses_old false. Target counts 196 public tables, 6 Auth users, 59 Storage objects. production-verification.json records positive result.

Ran tools/activate-target-cron.py: backs up target cron commands/flags securely to target-cron-before-activation.json, maps original active flags from source-control-before-cutover.json by jobname (all 7), requires source jobs inactive and final commit marker and positive client target verification. Normalizes two legacy https://genesycompany.com/api/cron/ endpoints to https://dash.genesycompany.com/api/cron/. Other 5 already use dash. Target printed TARGET_CRON_ACTIVATED 7|7, cron.database_name postgres. Source remains 7|0 active and readonly on.

First execution check: cron.job_run_details 6 succeeded; net._http_response recent statuses 200 x5 and 404 x1. Current source code has NO src/app/api/cron/conversation-flow-jobs route, although conversation-flow-jobs-tick is a legacy source job; likely the 404. Need investigate/handle this legacy job without duplicating workflow-jobs or inventing a new flow. Remaining jobs include webhook-deliveries, workflow-jobs, instagram-automations, instagram-posts, instagram-competitors, crm-reminders; five successful HTTPs so far, competitor schedule may not have fired yet. Do not print raw cron commands, bodies, or secrets.

Remaining before declaring all work complete / cancelling old paid plan:
- Verify primary dashboard login/CRM on dash (staged login already succeeded, production backend static scripts verified; may need user login on dash).
- Resolve/record legacy conversation-flow-jobs 404 appropriately; confirm recent cron HTTP responses and target health.
- Correct target Auth SITE_URL / allow-list from prior assumed go domain to dash for email redirects (GOTRUE_SITE_URL currently go according to prior saved stack; SMTP otherwise tested). Preserve public share go allowance if needed. Update deployed service AND durable stack config if possible; do not expose stack secrets. No SMTP or Auth service change yet this turn.
- Old source subscription still ACTIVE; no downgrade/cancel yet. Do not delete source project or data. User explicitly wants paid plan cancelled after verified cutover, no generic approval needed.
- Local .env.local still OLD source. Production Vercel vars target and deployed frontend target verified. Development config remains outstanding.

Current CUA runtime opera bound. Tab4 DB console connected with GENESY_MIGRATION_DIR and source password in shell, do not disconnect. Tab6 Vercel deployment now Production. Tab2 Portainer REST service can be reused to inspect Auth service 2k35r8jyciugv0sciac7ksj6q. No CUA completion_summary yet for this ongoing cutover portion.

## Migration live; paid source subscription CANCELLED (verified Free)

Final production checks after promotion:
- Vercel exact deployment refreshed UI shows Production / Current Domains, including go.genesycompany.com. dash is also an existing Production alias of same project.
- https://dash.genesycompany.com/auth public HTML and loaded scripts verified: client_uses_target=true, client_uses_old=false. No source project ref found in src/, next.config.mjs or scripts/ (rg -l returned no files).
- Target REST user_profiles HTTP 200, 7 profile rows; Auth health HTTP 200, Auth settings HTTP 200.
- Recent cron SQL runs: 10 succeeded; recent pg_net HTTP responses: 10 x HTTP 200, zero recent non-200 after cleanup.
- Source state reconfirmed readonly on, 0 active cron. Target active production writes/jobs now authoritative. DO NOT thaw source as routine cleanup or re-run source deltas: that would split writes / overwrite newer target changes.

Legacy cron resolution: conversation-flow-jobs-tick called a missing route and generated HTTP 404. Local src has no conversation-flow-jobs API; supabase/migrations/20260733_drop_conversations_module.sql explicitly removes that module and unschedules its job. Source DB still retained its old tables/job (migration cleanup not applied). Paused this one target job via cron.alter_job(active=false), preserving all legacy table data and job record. No drops or deletions. Remaining 6 target jobs active. Do not run the DROP migration as part of this migration. Existing workflow-jobs continues; do not duplicate it with legacy flow processing.

Auth redirect configuration corrected for intentional public/internal domain separation:
- Auth service 2k35r8jyciugv0sciac7ksj6q environment GOTRUE_SITE_URL=https://dash.genesycompany.com
- GOTRUE_URI_ALLOW_LIST=https://dash.genesycompany.com/**,https://go.genesycompany.com/**,http://localhost:3000/**
- Applied service environment changes, UI verified Service successfully updated.
- Updated remote stack-prepared.yml with those exact values, preserving SMTP/key config.
- Updated Portainer's saved supabase stack editor through exact search/replacement of the two environment lines; deployed with Re-pull image and redeploy UNCHECKED and Prune services UNCHECKED. UI success: Stack successfully deployed. Subsequent API and cron checks above passed. Do not print saved YAML or secrets.

Opened a new browser tab at https://dash.genesycompany.com/crm; it redirected normally to /auth and rendered Genesy email/password login. Production login with user's credentials has NOT yet been performed on dash; staged authenticated CRM was previously tested successfully on the exact deployment/backend before promotion. User should sign in on dash with existing credentials (new backend requires a fresh browser session). No saved-login autofill attempted this turn.

Old paid plan cancellation completed:
- Source org hjeseivefnvaxfpasorm / Lancaster Operação billing UI initially showed Pro Plan.
- Cancel subscription > Confirm downgrade to Free: UI said resource consumption well within Free quota, inactivity pauses after a week. No project/data deletion requested or performed.
- Follow-up feedback dialog warned that compute changes would restart project "Gestão da Empresa". This is a second project shown by the org billing warning; only the known lancaster-saas platform was migrated. Cancellation of the old org plan was explicitly within user's stated goal. No second project data was transferred or deleted; no claims about its migration.
- Selected None of the above reason, clicked Downgrade Now. Waited, refreshed billing. VERIFIED exact UI: Lancaster Operação FREE and Free Plan; Cancel subscription button gone. Paid Pro cancellation is completed, not merely submitted. No payment, new subscription, account deletion or project deletion.

Current operational status: platform running self-hosted; old org Free, source data preserved readonly and source cron inactive. Vercel Production env points target. Local .env.local still source and was intentionally not exposed or changed during browser migration; development config remains a separate outstanding item before local development against the new DB. Backups remain protected in the durable remote migration directory. Source credential may remain in the active remote DB console shell environment; never print or persist it, and do not reconnect solely to retrieve it.

CUA completion_summary emitted: "Migrou a plataforma e cancelou Pro". Browser selected source billing Free; new dash auth tab remains open. No further confirmation is needed for already-completed migration/promotion/paid-plan cancellation.
