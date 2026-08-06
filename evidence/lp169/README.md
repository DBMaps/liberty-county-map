# LP169 governed evidence

## Supabase SQL Editor metadata

Database and Storage catalog evidence uses the authenticated Supabase Dashboard SQL Editor; no database password or external PostgreSQL client is required. Run `tools/lp169/lp169-owner-metadata-query.sql`, export its **single** result as CSV, review that the export contains only metadata, then run:

```powershell
npm run ingest:lp169:sql-editor -- "C:\full\path\to\Supabase Snippet Untitled query (4).csv"
```

The ingester accepts BOM or BOM-free UTF-8, correctly parses quoted CSV, requires exactly one `lp169_owner_metadata` cell, rejects malformed/extra results and secret-like material without echoing it, and atomically writes `supabase-sql-editor-metadata.json` as deterministic UTF-8 without BOM and with LF endings. Until the owner export is available, the governed state is `OWNER_SQL_EDITOR_EXPORT_INGESTION_REQUIRED` and that evidence file must not be fabricated.

## Other owner evidence

The capture script continues to collect redacted GitHub CLI and Supabase CLI names/status metadata into `%TEMP%`. Review its bundle and ingest a schema-v2 draft with `node tools/lp169/ingest-owner-evidence.mjs <draft>`. Never place raw output, environment files, tokens, credentials, user records, object bodies, or private authentication data here. Partial evidence remains partial.
