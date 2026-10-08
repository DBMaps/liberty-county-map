# Interactive local owner acceptance

This launcher is LOCAL, DISPOSABLE and SYNTHETIC. It preserves the certified authentication adapter, frozen backend packages, original four infrastructure files, Dispatch demo, roadway geometry and notice composer. It enables no operational writes or publication.

## Start

Run this block in an interactive PowerShell console on this computer with Docker Desktop's Linux engine running:

```powershell
$dispatch = 'C:\Users\gulfi\.codex\worktrees\612f\RESPONDER-PHASE0-v1-contract-freeze'
& "$dispatch\tools\dispatch-auth-local\owner.ps1" `
  -Supabase 'C:\Users\gulfi\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\@supabase\cli-windows-x64\bin\supabase.exe' `
  -Docker 'C:\Users\gulfi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
```

Keep this console open. Startup verifies ports and resolved Docker bindings, installs the unchanged frozen foundation and approved local context fixture, and provisions one fresh synthetic viewer with explicit memberships in two departments. It does not sign in, enroll a factor, create an authenticated browser session or grant write/publication permissions.

The exact UI URL is **http://127.0.0.1:4180/**. Microsoft Edge opens in InPrivate mode with a separate disposable profile. All published ports bind explicitly to IPv4 localhost:

- Dispatch UI: 127.0.0.1:4180
- Supabase API: 127.0.0.1:54321
- PostgreSQL: 127.0.0.1:54322
- Mailpit: 127.0.0.1:54324
- GoTrue and PostgREST: no host publication

Startup refuses any occupied expected port. The independent visual demo may keep running on its usual port 4178.

## Private credentials and MFA

A local credential dialog opens separately from Edge. Its password is masked until you choose to reveal it. Credentials are generated afresh, never printed to the console, and stored only in a current-user DPAPI-encrypted file inside a directory restricted to the current Windows user and SYSTEM. Do not share, photograph or screenshot this dialog or the authenticator setup key.

Enter the synthetic email and temporary password into Dispatch. Select **Set up local authenticator**, enter the locally displayed key into your authenticator, then enter its six-digit code and select **Verify**. Use a disposable authenticator entry and remove that entry after acceptance. No seeds or tokens are supplied through chat, console logs or browser URL parameters.

After verification, **Authorized departments** lists exactly:

- Synthetic Acceptance Agency / Synthetic Public Works
- Synthetic Acceptance Agency / Synthetic Police

Switch between them, refresh the page, then choose **Sign out**. Expect **Signed out.** Refresh must show login, not authorized context. Ten-minute TOTP freshness and current membership/session checks remain enforced.

To reopen the private dialog, use another PowerShell window with the session path printed by the launcher:

```powershell
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -File "$dispatch\tools\dispatch-auth-local\owner-credentials.ps1" -Mode Show -Path '<printed-session-path>\credentials.dpapi'
```

The file is unreadable after cleanup. Recovery and real agency enrollment are not enabled.

## Stop

Press **Ctrl+C** in the launcher console. Alternatively, run the exact **STOP COMMAND** printed by the launcher in another PowerShell window. Its form is:

```powershell
& "$dispatch\tools\dispatch-auth-local\owner-stop.ps1" -SessionPath '<printed-session-path>'
```

Wait for **CLEANUP PASS**. The launcher stops its own UI process, credential window and dedicated Edge profile, removes only its UUID-owned Docker resources, deletes the private runtime and encrypted credentials, and clears the clipboard only if it contains this launcher's temporary password. It preserves unrelated browsers, containers, volumes, networks and clipboard contents.

A sanitized cleanup report is written under `reports/responder/dispatch-auth-owner/<project>/cleanup.json`. Any incomplete cleanup is explicitly reported as **CLEANUP INCOMPLETE**, including the owned project identifier; do not reuse that session or start another until its resources are reviewed. Do not use broad Docker prune commands.

## Boundaries and limitations

The launcher uses certified Supabase CLI 2.119.0 and the existing project-scoped Docker guard. It targets the local Linux named-pipe Docker engine and an unlinked TEMP project. No production database, real agency identity, external email provider or consumer runtime is used. The API profile exposes the reviewed invoker wrapper; no new private-table browser grants are installed.

The `-Certification` and `-Fault` switches exist for disposable automated launcher tests. They suppress owner windows and allow controlled failure injection; they do not bypass login or MFA. Use the normal command for manual acceptance.

Use a normal stop rather than force-killing processes, closing the terminal or shutting down Windows. Abrupt process termination or Docker unavailability can prevent cleanup; the printed session identifier identifies the exact resources needing recovery. Delete the synthetic authenticator entry on your own device after stopping.

The preserved `README.md` describes the earlier guard-only milestone. Use this document for owner acceptance; do not execute its historical context-grant proposal.

## Reviewed source portability

Startup uses tracked source-integrity.json and verify-sources.ps1; generated reports are never required. The contract accepts the reviewed base on codex/dispatch-visual-shell or its single-parent closure commit titled Complete Dispatch operational authentication foundation. It verifies all required files, rejects other branches/revisions and altered or missing sources, and requires closure files and manifest to match the committed review. Text hashes normalize CRLF to LF; binary hashes are exact. Startup never updates the manifest. Further source revisions require separate review and recertification.
