# LP241.11 rich-shard owner runbook

This executor is owner-local manufacturing tooling. It does not activate an Overture runtime source, publish data, deploy Cloudflare, or create Supabase tables.

## Safe acceptance sequence

Validate the complete immutable plan without remote execution:

```sh
node tools/lp24111/rich-manufacture.mjs --plan
```

Run the two measured King County acceptance shards separately:

```sh
node tools/lp24111/rich-manufacture.mjs --execute --shard tx-33-101
node tools/lp24111/rich-manufacture.mjs --execute --shard tx-33-100
```

After inspecting `owner-local/lp24111/rich-shard-progress.json`, verify resume/skip behavior. Both valid completed shards will be reported as `COMPLETE_EXISTING`; neither remote artifact will be downloaded again:

```sh
node tools/lp24111/rich-manufacture.mjs --execute --shards tx-33-101,tx-33-100
```

Artifact validation is authoritative. An invalid existing artifact stops as `INVALID_EXISTING_ARTIFACT`. It is never silently overwritten. Only after inspecting the error and retained artifact should an owner opt in to quarantining invalid files and rebuilding that explicitly bounded shard:

```sh
node tools/lp24111/rich-manufacture.mjs --execute --shard <shardId> --rebuild-invalid
```

Do not run an unselected statewide `--execute` during Phase C.1 acceptance.

## Dense-shard follow-up

After bounded executions have accumulated actual remote row counts, list deterministic dense candidates from measured local progress:

```sh
node tools/lp24111/rich-manufacture.mjs --dense-candidates
```

The helper sorts only shards with measured `remoteRowCount`, descending by row count with shard ID as the tie-breaker. It does not estimate unexecuted shards or execute a candidate.
