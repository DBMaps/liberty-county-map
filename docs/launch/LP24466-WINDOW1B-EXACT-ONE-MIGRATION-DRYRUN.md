# LP244.66 Window 1B — exact-one linked migration dry-run result

**Observation:** September 27, 2026, approximately 23:56 UTC. **Verdict: EXACT-ONE MIGRATION MECHANISM NOT PROVEN.** The linked Supabase CLI has no authentication in this environment, so it exited before producing a migration dry run. No migration was staged, applied, repaired or recorded.

## Source, recovery and migration identities

The starting branch was `LP244.66-production-subscription-verification-admission` at `d197ace62a222868d2b813485b231420ef4ea438`, with a clean working tree. The owner reports scheduled physical backups active for project `nhwhkbkludzkuyxmkkcj`, daily restore points visible for at least September 20–27, a Restore action available, and PITR disabled. The owner accepts backup-based recovery for these additive database migrations. This is owner-provided dashboard evidence, not a fresh backup restore test or independent CLI backup check.

| Migration | Approved SHA-256 of committed LF bytes | Local checkout observation before CLI |
| --- | --- | --- |
| `20260926205345_lp24462_store_entitlement_cache.sql` | `4ed076fe114e6d69b8104ea1e6de10c71031f7310d6a2bbbb2cd784158f24e6a` | Raw CRLF bytes: `dec74ae2a664358a0de2cbfa74a23db24ca04e3bdb53abfd9a84c11e350a1fba`; replacing **only** CRLF with LF yields the approved hash. The checkout has 97 CRLF pairs and no standalone CR. This is the committed-byte identity rule recorded in Window 1. |
| `20260927204849_lp24466_google_acknowledgment_queue.sql` | `53f9e93fbbf9f9acf831a8e301d8594a4b016f0fc1b25a227aead561c4125270` | Raw checkout bytes match the approved hash. |

No migration file was moved or edited. Both original paths remained present. Final hashes and clean-tree checks are recorded below.

## CLI capability and linked target

The previously cached standalone Supabase CLI package was invoked directly from its cached `supabase/dist/supabase.js` entrypoint using Node, with `SUPABASE_HOME` confined to projectless scratch and telemetry disabled. It reported **2.117.0**. No download, dependency installation or repository package change occurred.

`db push --help` provides `--dry-run`, `--linked`, `--project-ref`, `--skip-vault` and `--workdir`, but no native one-version selector. It says a dry run prints migrations without applying them; Vault updates are skipped with `--skip-vault`. `migration up --help` describes a command that applies pending migrations, including against a linked project; it has no dry-run or one-version selector and **was not executed**. `migration list --help` offers `--linked`/`--project-ref` and no one-version selector. `migration repair` was not invoked.

The local linked ref file `supabase/.temp/project-ref` contains exactly `nhwhkbkludzkuyxmkkcj`. An independent read-only Supabase project lookup returned ID/ref `nhwhkbkludzkuyxmkkcj`, **Gridly Platform**, `us-east-1`, `ACTIVE_HEALTHY`. This proves the configured ref and independently observed project identity, but the CLI never authenticated or connected, so it does **not** prove a successful CLI database target session.

## Attempted read-only dry runs and stop

`supabase migration list --linked` exited **1** with `LegacyPlatformAuthRequiredError: Access token not provided`. It returned no migration comparison. The full baseline command, `supabase db push --linked --dry-run --skip-vault`, also exited **1** with the same authentication error before listing any proposed migration. No access token, password, connection string or other credential was supplied or printed.

Therefore the baseline did **not** prove that precisely the two subscription migrations are pending from the CLI's perspective. The acknowledgment file was **not moved** out of `supabase/migrations`; there was no cache-only live dry run. The cache-only proposed count is **unknown**, and exclusion of the acknowledgment migration is **unproved**. No disposable/local PostgreSQL migration-history fixture was run; step 2 selection is **not simulated**. Source filenames and the production ledger alone cannot substitute for CLI selection evidence.

The authorized staging idea remains conditional: hold only `20260927204849_lp24466_google_acknowledgment_queue.sql` outside `supabase/migrations` in a guaranteed restore/finally path; check both identities; run `db push --linked --dry-run --skip-vault`; require exactly the cache version; restore and recheck hashes/clean tree. That procedure requires a credential-safe authenticated CLI session and a fresh successful full baseline first. **No production `db push` without `--dry-run` is authorized by this result.** After an independently authorized cache application and one-version ledger postcheck, a separate acknowledgment-only dry run and separate authorization would be required. Do not infer that the second step is proved here.

## Postattempt safety evidence

After the two CLI authentication failures, a fresh read-only Supabase migration listing for explicit project `nhwhkbkludzkuyxmkkcj` returned **17 versions, each once**: the same historical set recorded in Window 1, ending with `20260926021558`. Cache version `20260926205345` and acknowledgment version `20260927204849` are both **absent**. A separate bounded read of `report_retention.admission_state` returned `protocol_version=2` and `reporting_enabled=false`. These reads support that the failed dry-run attempts did not mutate the ledger or reporting state. No guard, scheduler, schema, secret, deployment, store purchase or production data change was attempted.

## Local cleanup, verdict and next decision

Both proposed files remain at their original paths and were never moved. There is no temporary migration file in `supabase/migrations` and no holding directory from this run. Recomputed postattempt raw hashes were unchanged: cache `dec74ae2a664358a0de2cbfa74a23db24ca04e3bdb53abfd9a84c11e350a1fba` (CRLF checkout; CRLF→LF reproduces the approved hash) and acknowledgment `53f9e93fbbf9f9acf831a8e301d8594a4b016f0fc1b25a227aead561c4125270`. Before staging this document, `git diff --check` passed and `git status --short` showed only this new document. A staged diff check and final status follow the documentation-only local commit.

**EXACT-ONE MIGRATION MECHANISM NOT PROVEN. Window 2 migration application remains NO-GO.** The next owner action is to provide or arrange a credential-safe **authenticated Supabase CLI session** for this same linked project, without placing credentials in Codex, and then authorize a fresh non-mutating Window 1B baseline plus isolated cache-only dry run and disposable step-2 selection proof. Review the exact output and fresh ledger before considering a separate cache migration approval. Do not push or merge as part of Window 1B.
