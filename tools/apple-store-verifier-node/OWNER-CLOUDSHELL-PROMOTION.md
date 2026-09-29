# LP244.66S owner CloudShell production verifier handoff

Run in AWS CloudShell for the inspected Gridly account in **us-east-1**. This stage updates only `gridly-apple-store-verifier` and stops before creating a Function URL or changing Supabase.

1. Upload `.artifacts/lp24466s-aws-node-verifier.zip` from this workspace through CloudShell **Actions → Upload file**. Expected SHA-256: `cc067aff72e92a9a467554d8d39ab8d90054ed703fb1663ed10f6f1b0db59c8f`.
2. Run:

```bash
sha256sum lp24466s-aws-node-verifier.zip

aws lambda update-function-code \
  --region us-east-1 \
  --function-name gridly-apple-store-verifier \
  --zip-file fileb://lp24466s-aws-node-verifier.zip \
  --query '{CodeSha256:CodeSha256,Version:Version}'

aws lambda wait function-updated-v2 \
  --region us-east-1 \
  --function-name gridly-apple-store-verifier

aws lambda update-function-configuration \
  --region us-east-1 \
  --function-name gridly-apple-store-verifier \
  --handler verifier.handler \
  --runtime nodejs24.x \
  --timeout 30 \
  --memory-size 512 \
  --query '{Runtime:Runtime,Handler:Handler,Version:Version}'

aws lambda wait function-updated-v2 \
  --region us-east-1 \
  --function-name gridly-apple-store-verifier
```

The expected AWS `CodeSha256` is `zAZ6/3LpKppGdVTY05q42QBU7XA/sWY+0Q9vGw21nI8=`.

3. In the AWS Lambda console, privately enter these six environment variables. Never paste values into CloudShell commands, files, logs, the repository or chat. Use the owner-held Apple API credentials and App Apple ID; generate two independent new 32-byte random bridge values. Encode the internal token as unpadded base64url and the HMAC key as standard base64. Preserve both new values privately for the **identical** Supabase secrets later.

```text
GRIDLY_APPLE_ISSUER_ID
GRIDLY_APPLE_KEY_ID
GRIDLY_APPLE_PRIVATE_KEY_P8
GRIDLY_APPLE_APP_ID
GRIDLY_APPLE_NODE_INTERNAL_TOKEN
GRIDLY_APPLE_NODE_RESPONSE_HMAC_KEY
```

4. After the configuration update, make only this bad-token direct invocation. A valid configuration returns `statusCode:401` and `unauthorized`. `503` means incomplete configuration; stop before any public URL.

```bash
aws lambda wait function-updated-v2 --region us-east-1 --function-name gridly-apple-store-verifier
aws lambda invoke \
  --region us-east-1 \
  --function-name gridly-apple-store-verifier \
  --cli-binary-format raw-in-base64-out \
  --payload '{"requestContext":{"http":{"method":"POST"}},"rawPath":"/","rawQueryString":"","headers":{"content-type":"application/json","x-gridly-apple-node-token":"invalid"},"body":"{}","isBase64Encoded":false}' \
  lp24466s-denial.json
cat lp24466s-denial.json
```

Return only: uploaded ZIP SHA-256; AWS `CodeSha256`; runtime and handler; safe denial status/error. Do not return any environment value or owner transaction data. If a command fails, stop and report its bounded error. The remaining Function URL, Supabase bridge secrets, Apple verifier deployment, and one nonpurchase iPhone Retry follow only after this checkpoint is reviewed.

## Stage 2 — after the inspected code and bad-token denial match

The owner reported the exact ZIP hash, AWS code hash, `nodejs24.x` / `verifier.handler`, and `401 unauthorized`. The Function URL must target the immutable published version through the `production` alias. An unqualified Function URL would target mutable `$LATEST` and would defeat the published-version proof. Run in the same AWS account's CloudShell in `us-east-1`. Stop on any unexpected result; do not print or retrieve environment variables.

```bash
set -euo pipefail

gridly_function=gridly-apple-store-verifier
gridly_alias=production
gridly_expected_sha='zAZ6/3LpKppGdVTY05q42QBU7XA/sWY+0Q9vGw21nI8='

gridly_url_count=$(aws lambda list-function-url-configs \
  --region us-east-1 --function-name "$gridly_function" \
  --query 'length(FunctionUrlConfigs)' --output json)
test "$gridly_url_count" = 0 || { echo 'STOP: a Function URL already exists'; exit 1; }

gridly_alias_count=$(aws lambda list-aliases \
  --region us-east-1 --function-name "$gridly_function" \
  --query "length(Aliases[?Name=='production'])" --output json)
test "$gridly_alias_count" = 0 || { echo 'STOP: production alias already exists'; exit 1; }

gridly_version=$(aws lambda publish-version \
  --region us-east-1 --function-name "$gridly_function" \
  --code-sha256 "$gridly_expected_sha" \
  --query Version --output text)
[[ "$gridly_version" =~ ^[1-9][0-9]*$ ]] || { echo 'STOP: invalid published version'; exit 1; }

gridly_published_sha=$(aws lambda get-function-configuration \
  --region us-east-1 --function-name "$gridly_function" \
  --qualifier "$gridly_version" --query CodeSha256 --output text)
test "$gridly_published_sha" = "$gridly_expected_sha" || { echo 'STOP: published code hash differs'; exit 1; }

aws lambda create-alias \
  --region us-east-1 --function-name "$gridly_function" \
  --name "$gridly_alias" --function-version "$gridly_version" \
  --query '{Name:Name,FunctionVersion:FunctionVersion,AliasArn:AliasArn}'

aws lambda create-function-url-config \
  --region us-east-1 --function-name "$gridly_function" \
  --qualifier "$gridly_alias" --auth-type NONE \
  --query '{FunctionUrl:FunctionUrl,FunctionArn:FunctionArn,AuthType:AuthType,Cors:Cors}'
```

Add both required public permissions **to the alias only**. `NONE` makes the URL reachable; the handler's high-entropy internal token remains mandatory before any store verification. The second permission is restricted to invocation via the URL. Do not add unqualified function-level permissions.

```bash
aws lambda add-permission \
  --region us-east-1 --function-name "$gridly_function" \
  --qualifier "$gridly_alias" \
  --statement-id GridlyAppleStoreURLInvoke \
  --action lambda:InvokeFunctionUrl \
  --principal '*' \
  --function-url-auth-type NONE \
  --query '{Statement:Statement}'

aws lambda add-permission \
  --region us-east-1 --function-name "$gridly_function" \
  --qualifier "$gridly_alias" \
  --statement-id GridlyAppleStoreURLOnly \
  --action lambda:InvokeFunction \
  --principal '*' \
  --invoked-via-function-url \
  --query '{Statement:Statement}'
```

Verify the alias still points to the published version and that its URL is the only Function URL. Use the alias URL only for denial checks. Never send a valid internal token from CloudShell. A GET must return 405; an empty JSON POST without a token must return 401. These commands print bounded metadata and status codes only.

```bash
aws lambda get-alias \
  --region us-east-1 --function-name "$gridly_function" --name "$gridly_alias" \
  --query '{Name:Name,FunctionVersion:FunctionVersion,RoutingConfig:RoutingConfig}'

aws lambda get-function-configuration \
  --region us-east-1 --function-name "$gridly_function" --qualifier "$gridly_alias" \
  --query '{Version:Version,CodeSha256:CodeSha256,Runtime:Runtime,Handler:Handler}'

aws lambda list-function-url-configs \
  --region us-east-1 --function-name "$gridly_function" \
  --query 'FunctionUrlConfigs[].{FunctionUrl:FunctionUrl,FunctionArn:FunctionArn,AuthType:AuthType,Cors:Cors}'

gridly_url=$(aws lambda get-function-url-config \
  --region us-east-1 --function-name "$gridly_function" --qualifier "$gridly_alias" \
  --query FunctionUrl --output text)
curl --silent --show-error --max-time 15 --output /dev/null --write-out 'GET %{http_code}\n' "$gridly_url"
curl --silent --show-error --max-time 15 --output /dev/null --write-out 'POST %{http_code}\n' \
  --request POST --header 'content-type: application/json' --data '{}' "$gridly_url"
```

Report only the published version, alias target, URL, URL auth type, whether CORS is absent, and both HTTP status codes. The URL is configuration metadata, not a secret. Do not return Apple credentials, bridge secret values, signed transactions, or logs. After this checkpoint, privately set the matching Supabase bridge secrets and deploy only `gridly-verify-apple-subscription`.

## Stage 3 — bounded Lambda 502 diagnosis, after Supabase v26

Supabase Apple v24 reached the Lambda URL and received HTTP 502 after native authorization and challenge consumption. The default Lambda log group was absent. The temporary stage-probe ZIP changes only `verifier.mjs` from the already uploaded production ZIP. It adds fixed stage and numeric status headers to a generic 502; it does not change trust checks, successful responses, URL, alias policy, or secrets. Supabase Apple v26 is already source-parity matched and can log only allowlisted bounded header codes. Do not request another physical Retry until this temporary Lambda version is promoted.

Upload `.artifacts/lp24466s-aws-node-verifier-stage-probe.zip` from this workspace using CloudShell **Actions → Upload file**. Expected ZIP SHA-256: `e0ff040839072b91a93100798360e782f12654c5cdd386534234ac413268708a`. Expected Lambda `CodeSha256`: `4P8ECDkHK5GpMQB5g2DngvEmVMXN04ZTQjSsQTJocIo=`. Run in the same account's AWS CloudShell in `us-east-1`:

```bash
set -euo pipefail
f=gridly-apple-store-verifier
old_sha='zAZ6/3LpKppGdVTY05q42QBU7XA/sWY+0Q9vGw21nI8='
new_sha='4P8ECDkHK5GpMQB5g2DngvEmVMXN04ZTQjSsQTJocIo='
zip_sha='e0ff040839072b91a93100798360e782f12654c5cdd386534234ac413268708a'
test "$(sha256sum lp24466s-aws-node-verifier-stage-probe.zip | cut -d' ' -f1)" = "$zip_sha" || { echo 'STOP: ZIP mismatch'; exit 1; }
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 2 || { echo 'STOP: alias changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$old_sha" || { echo 'STOP: alias code changed'; exit 1; }
rev=$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query RevisionId --output text)
aws lambda update-function-code --region us-east-1 --function-name "$f" --zip-file fileb://lp24466s-aws-node-verifier-stage-probe.zip --query '{CodeSha256:CodeSha256,Version:Version}'
aws lambda wait function-updated-v2 --region us-east-1 --function-name "$f"
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: uploaded code mismatch'; exit 1; }
v=$(aws lambda publish-version --region us-east-1 --function-name "$f" --code-sha256 "$new_sha" --query Version --output text)
[[ "$v" =~ ^[1-9][0-9]*$ ]] || { echo 'STOP: invalid version'; exit 1; }
aws lambda update-alias --region us-east-1 --function-name "$f" --name production --function-version "$v" --revision-id "$rev" --query '{Name:Name,FunctionVersion:FunctionVersion}'
aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query '{Version:Version,CodeSha256:CodeSha256,Runtime:Runtime,Handler:Handler}'
url=$(aws lambda get-function-url-config --region us-east-1 --function-name "$f" --qualifier production --query FunctionUrl --output text)
curl --silent --show-error --max-time 15 --output /dev/null --write-out 'GET %{http_code}\n' "$url"
curl --silent --show-error --max-time 15 --output /dev/null --write-out 'POST %{http_code}\n' --request POST --header 'content-type: application/json' --data '{}' "$url"
```

Report only the ZIP SHA, new version, CodeSha, and GET/POST status codes. Do not share environment values, transaction evidence, keys, tokens, signed bodies, or provider responses. No URL, permission, role, secret, other function, or reporting change is part of this stage. After the fixed-code physical proof, remove the temporary diagnostics from Lambda and Supabase.

## Stage 4 — IAM-only Apple API signing check before another phone Retry

Supabase Apple v27 is active and fail-closed. The latest bounded Retry reached `lambda_status_api` with zero entitlements and reporting OFF. Upload `.artifacts/lp24466s-aws-node-api-status-probe.zip` through CloudShell **Actions → Upload file**. Its expected ZIP SHA-256 is `d11c4f392dd3e4792f5ccfa1e7a075f379d63ae74aa899563116cb9802b5fa5d`, and expected Lambda `CodeSha256` is `0RxPOS3T5HkvXM+h56B183nWOudKqJlWMRbLmAK1+l0=`. This stage uploads to `$LATEST`, directly invokes only a boolean configuration/signing check, and moves the existing `production` alias only if both booleans are true. It changes no URL, policy, secret, role, Supabase function, or reporting state.

```bash
set -euo pipefail
f=gridly-apple-store-verifier
old_sha='4P8ECDkHK5GpMQB5g2DngvEmVMXN04ZTQjSsQTJocIo='
new_sha='0RxPOS3T5HkvXM+h56B183nWOudKqJlWMRbLmAK1+l0='
zip_sha='d11c4f392dd3e4792f5ccfa1e7a075f379d63ae74aa899563116cb9802b5fa5d'
test "$(sha256sum lp24466s-aws-node-api-status-probe.zip | cut -d' ' -f1)" = "$zip_sha" || { echo 'STOP: ZIP mismatch'; exit 1; }
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 3 || { echo 'STOP: alias changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$old_sha" || { echo 'STOP: alias code changed'; exit 1; }
rev=$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query RevisionId --output text)
aws lambda update-function-code --region us-east-1 --function-name "$f" --zip-file fileb://lp24466s-aws-node-api-status-probe.zip --query '{CodeSha256:CodeSha256,Version:Version}'
aws lambda wait function-updated-v2 --region us-east-1 --function-name "$f"
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: uploaded code mismatch'; exit 1; }
probe_file=$(mktemp)
trap 'rm -f "$probe_file"' EXIT
aws lambda invoke --region us-east-1 --function-name "$f" --qualifier '$LATEST' --cli-binary-format raw-in-base64-out --payload '{"probe":"lp24466s_api_signing"}' --query '{StatusCode:StatusCode,FunctionError:FunctionError}' "$probe_file"
python3 - "$probe_file" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f:
    value=json.load(f)
configuration=value.get('configurationUsable') is True
signing=value.get('signingUsable') is True
print('configurationUsable:',str(configuration).lower())
print('signingUsable:',str(signing).lower())
if not (configuration and signing):
    sys.exit('STOP: alias remains on version 3')
PY
v=$(aws lambda publish-version --region us-east-1 --function-name "$f" --code-sha256 "$new_sha" --query Version --output text)
[[ "$v" =~ ^[1-9][0-9]*$ ]] || { echo 'STOP: invalid version'; exit 1; }
aws lambda update-alias --region us-east-1 --function-name "$f" --name production --function-version "$v" --revision-id "$rev" --query '{Name:Name,FunctionVersion:FunctionVersion}'
aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query '{Version:Version,CodeSha256:CodeSha256,Runtime:Runtime,Handler:Handler}'
url=$(aws lambda get-function-url-config --region us-east-1 --function-name "$f" --qualifier production --query FunctionUrl --output text)
curl --silent --show-error --max-time 15 --output /dev/null --write-out 'GET %{http_code}\n' "$url"
curl --silent --show-error --max-time 15 --output /dev/null --write-out 'POST %{http_code}\n' --request POST --header 'content-type: application/json' --data '{}' "$url"
```

Report only the two booleans and, if promoted, the version, CodeSha256, GET and POST status codes. Do not share the probe file, environment values, JWT, private key, signed transaction, transaction identifier, or log bodies. A false boolean leaves the existing production alias on version 3; do not run another iPhone Retry in that case. The temporary diagnostics must be removed after the final physical proof.

## Stage 4 continuation — repair only private key configuration, then resume

The owner reported `configurationUsable:true` and `signingUsable:false` from the `$LATEST` direct invocation, with `StatusCode 200` and no `FunctionError`. Nothing was published; `production` remains on version 3. The presence/shape check does not prove the `.p8` can sign ES256. In the AWS Lambda console for **gridly-apple-store-verifier** in **us-east-1**, privately replace only `GRIDLY_APPLE_PRIVATE_KEY_P8` in **Configuration → Environment variables** with the original, complete **In-App Purchase** `.p8` PEM from App Store Connect **Users and Access → Integrations → Keys → In-App Purchase**. Preserve the actual multiline PEM delimiters and line breaks. Use the key whose key ID matches the already configured `GRIDLY_APPLE_KEY_ID`; if the owner finds a mismatch, stop and report only that bounded mismatch, without sharing either value. Do not paste or print the key in chat, CloudShell, logs, or a repository file; do not change the other environment variables, alias, URL, permissions, or Supabase. Wait for the configuration update to finish, then run this continuation in CloudShell. It invokes only the boolean check and promotes the already uploaded diagnostic code only when both values are true. [Apple's App Store Server API key instructions](https://developer.apple.com/documentation/appstoreserverapi/creating-api-keys-to-authorize-api-requests).

```bash
set -euo pipefail
f=gridly-apple-store-verifier
old_sha='4P8ECDkHK5GpMQB5g2DngvEmVMXN04ZTQjSsQTJocIo='
new_sha='0RxPOS3T5HkvXM+h56B183nWOudKqJlWMRbLmAK1+l0='
aws lambda wait function-updated-v2 --region us-east-1 --function-name "$f"
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 3 || { echo 'STOP: alias changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$old_sha" || { echo 'STOP: alias code changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: diagnostic code changed'; exit 1; }
rev=$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query RevisionId --output text)
probe_file=$(mktemp)
trap 'rm -f "$probe_file"' EXIT
invoke_meta=$(aws lambda invoke --region us-east-1 --function-name "$f" --qualifier '$LATEST' --cli-binary-format raw-in-base64-out --payload '{"probe":"lp24466s_api_signing"}' --query '{StatusCode:StatusCode,FunctionError:FunctionError}' --output json "$probe_file")
python3 - "$probe_file" "$invoke_meta" <<'PY'
import json,sys
meta=json.loads(sys.argv[2])
with open(sys.argv[1],encoding='utf-8') as f:
    value=json.load(f)
configuration=value.get('configurationUsable') is True
signing=value.get('signingUsable') is True
print('configurationUsable:',str(configuration).lower())
print('signingUsable:',str(signing).lower())
if meta.get('StatusCode') != 200 or meta.get('FunctionError') is not None or not (configuration and signing):
    sys.exit('STOP: alias remains on version 3')
PY
v=$(aws lambda publish-version --region us-east-1 --function-name "$f" --code-sha256 "$new_sha" --query Version --output text)
[[ "$v" =~ ^[1-9][0-9]*$ ]] || { echo 'STOP: invalid version'; exit 1; }
aws lambda update-alias --region us-east-1 --function-name "$f" --name production --function-version "$v" --revision-id "$rev" --query '{Name:Name,FunctionVersion:FunctionVersion}'
aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query '{Version:Version,CodeSha256:CodeSha256,Runtime:Runtime,Handler:Handler}'
url=$(aws lambda get-function-url-config --region us-east-1 --function-name "$f" --qualifier production --query FunctionUrl --output text)
curl --silent --show-error --max-time 15 --output /dev/null --write-out 'GET %{http_code}\n' "$url"
curl --silent --show-error --max-time 15 --output /dev/null --write-out 'POST %{http_code}\n' --request POST --header 'content-type: application/json' --data '{}' "$url"
```

Report only `configurationUsable`, `signingUsable`, and, if promoted, the new version, CodeSha256, GET and POST status codes. The diagnostic ZIP already uploaded for `$LATEST` is `lp24466s-aws-node-api-status-probe.zip`, SHA-256 `d11c4f392dd3e4792f5ccfa1e7a075f379d63ae74aa899563116cb9802b5fa5d`. No phone Retry is needed until this continuation succeeds.

## Stage 5 — IAM-only private-key failure classification

The owner privately replaced the Lambda `.p8` with the complete downloaded In-App Purchase key and confirmed its key ID matched. The `$LATEST` boolean probe still returned `configurationUsable:true` and `signingUsable:false`; nothing was published or promoted, and no phone Retry occurred. The next diagnostic changes only `verifier.mjs` in the already staged Lambda package. It returns one fixed stage code from a direct IAM `Invoke` event; no key, JWT, signature, error message, length, digest, transaction, or credential is returned or logged. A Function URL event cannot trigger the probe because it is not the exact one-field direct event. The `production` alias remains on version 3 throughout this stage.

Upload `.artifacts/lp24466s-aws-node-key-stage-probe.zip` through CloudShell **Actions → Upload file**. Expected ZIP SHA-256: `08ec6ce1682f63a2a0db74eef8f8f90e8b035dee70c2c02dfa633dd9f3abb74d`. Expected Lambda `CodeSha256`: `COxs4WgvY6Kg23Tu+Pj5DosDXe5wwsAt+mM92fOrt00=`. Run in the same account's AWS CloudShell in `us-east-1`:

```bash
set -euo pipefail
f=gridly-apple-store-verifier
old_alias_sha='4P8ECDkHK5GpMQB5g2DngvEmVMXN04ZTQjSsQTJocIo='
old_latest_sha='0RxPOS3T5HkvXM+h56B183nWOudKqJlWMRbLmAK1+l0='
new_sha='COxs4WgvY6Kg23Tu+Pj5DosDXe5wwsAt+mM92fOrt00='
zip_sha='08ec6ce1682f63a2a0db74eef8f8f90e8b035dee70c2c02dfa633dd9f3abb74d'
test "$(sha256sum lp24466s-aws-node-key-stage-probe.zip | cut -d' ' -f1)" = "$zip_sha" || { echo 'STOP: ZIP mismatch'; exit 1; }
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 3 || { echo 'STOP: alias changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$old_alias_sha" || { echo 'STOP: alias code changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$old_latest_sha" || { echo 'STOP: latest code changed'; exit 1; }
aws lambda update-function-code --region us-east-1 --function-name "$f" --zip-file fileb://lp24466s-aws-node-key-stage-probe.zip --query '{CodeSha256:CodeSha256,Version:Version}' --output json > /dev/null
aws lambda wait function-updated-v2 --region us-east-1 --function-name "$f"
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: uploaded code mismatch'; exit 1; }
probe_file=$(mktemp)
trap 'rm -f "$probe_file"' EXIT
invoke_meta=$(aws lambda invoke --region us-east-1 --function-name "$f" --qualifier '$LATEST' --cli-binary-format raw-in-base64-out --payload '{"probe":"lp24466s_key_stage"}' --query '{StatusCode:StatusCode,FunctionError:FunctionError}' --output json "$probe_file")
python3 - "$probe_file" "$invoke_meta" <<'PY'
import json,sys
allowed={'configuration_unusable','pem_literal_newlines','pem_parse_failed','key_type_not_ec','curve_not_p256','node_sign_failed','api_client_init_failed','jwt_sign_failed','ready'}
meta=json.loads(sys.argv[2])
with open(sys.argv[1],encoding='utf-8') as f:
    value=json.load(f)
stage=value.get('stage') if isinstance(value,dict) and set(value)=={'stage'} else None
if meta.get('StatusCode')!=200 or meta.get('FunctionError') is not None or stage not in allowed:
    sys.exit('STOP: unclassified probe result; alias remains on version 3')
print('keyStage:',stage)
PY
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 3 || { echo 'STOP: alias changed'; exit 1; }
echo 'production alias: 3'
```

Report only the expected ZIP SHA-256, expected Lambda CodeSha256, the printed `keyStage`, and `production alias: 3`. Do not share the invocation file, private key, JWT, signature, error text, environment values, or logs. **Do not publish or move the alias, and do not run an iPhone Retry.** A `ready` code proves only local ES256 bearer-token construction; it does not prove Apple's API accepts the credential or that paid ownership has been verified.

## Stage 6 — private PEM source and Lambda encoding diagnosis

The owner reports Stage 5 `keyStage:pem_parse_failed` and confirms `production` remained on version 3. This stage compares two **fixed-code checks** without exposing the key. It first validates the original downloaded `.p8` on the machine that already holds it. Only if that file reports `ready` does the owner upload a new `$LATEST` diagnostic ZIP. The Lambda diagnostic tries trim, JSON unquoting, escaped-line-break conversion, and PEM rewrapping **in memory only**; it then classifies wrapper, base64, and DER failures. It returns one allowlisted `encodingStage`. It never returns key bytes, JWTs, signatures, parser messages, lengths, digests, paths, or environment values. It does not save a transformed key or change production behavior.

### 6A. Check the original `.p8` privately on the owner computer

On the Windows machine that already has the original downloaded In-App Purchase `.p8`, run in PowerShell. Enter **only the file path** at the prompt, never the key contents. The local script does not use the network and prints only `sourceKeyStage`.

```powershell
$lp24466sPrivateKeyPath = Read-Host 'Full path to the original In-App Purchase .p8 file'
& 'C:\Program Files\nodejs\node.exe' 'C:\GitHub\liberty-county-map\tools\apple-store-verifier-node\check-private-key-local.mjs' $lp24466sPrivateKeyPath
Remove-Variable lp24466sPrivateKeyPath -ErrorAction SilentlyContinue
```

If the `.p8` resides only on a Mac, transfer **only** `check-private-key-local.mjs` to that Mac and run `node check-private-key-local.mjs /private/path/to/original.p8` there. Do not transfer the `.p8` to CloudShell or this workspace. If `sourceKeyStage` is anything other than `ready`, stop and report only that code. A `ready` result establishes that the source file is a parseable, signing-capable P-256 EC private key; it does not identify or expose the key.

### 6B. Classify the current Lambda environment encoding without printing it

Run this only after 6A returns `sourceKeyStage: ready`. Upload `.artifacts/lp24466s-aws-node-pem-encoding-probe.zip` through CloudShell **Actions → Upload file**. Expected ZIP SHA-256: `0241fc3485352b50349f4202629847cd7e6c7d35d33383f21ef1b3fe321cbf77`. Expected Lambda `CodeSha256`: `AkH8NIU1K1A0n0ICYphHzX5sfTXTM4PyHvGz/jIcv3c=`. Its **1,071** entries match the Stage 5 ZIP except `verifier.mjs`. The probe is accessible only through the exact IAM direct-invocation event; a Function URL event cannot trigger it. Run in the same AWS account's CloudShell in `us-east-1`:

```bash
set -euo pipefail
f=gridly-apple-store-verifier
old_alias_sha='4P8ECDkHK5GpMQB5g2DngvEmVMXN04ZTQjSsQTJocIo='
old_latest_sha='COxs4WgvY6Kg23Tu+Pj5DosDXe5wwsAt+mM92fOrt00='
new_sha='AkH8NIU1K1A0n0ICYphHzX5sfTXTM4PyHvGz/jIcv3c='
zip_sha='0241fc3485352b50349f4202629847cd7e6c7d35d33383f21ef1b3fe321cbf77'
test "$(sha256sum lp24466s-aws-node-pem-encoding-probe.zip | cut -d' ' -f1)" = "$zip_sha" || { echo 'STOP: ZIP mismatch'; exit 1; }
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 3 || { echo 'STOP: alias changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$old_alias_sha" || { echo 'STOP: alias code changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$old_latest_sha" || { echo 'STOP: latest code changed'; exit 1; }
aws lambda update-function-code --region us-east-1 --function-name "$f" --zip-file fileb://lp24466s-aws-node-pem-encoding-probe.zip --query '{CodeSha256:CodeSha256,Version:Version}' --output json > /dev/null
aws lambda wait function-updated-v2 --region us-east-1 --function-name "$f"
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: uploaded code mismatch'; exit 1; }
probe_file=$(mktemp)
trap 'rm -f "$probe_file"' EXIT
invoke_meta=$(aws lambda invoke --region us-east-1 --function-name "$f" --qualifier '$LATEST' --cli-binary-format raw-in-base64-out --payload '{"probe":"lp24466s_pem_encoding"}' --query '{StatusCode:StatusCode,FunctionError:FunctionError}' --output json "$probe_file")
python3 - "$probe_file" "$invoke_meta" <<'PY'
import json,sys
allowed={'configuration_unusable','not_a_pem_parse_failure','trim_repairs_key','json_unquote_repairs_key','escaped_crlf_repairs_key','escaped_lf_repairs_key','pem_rewrap_repairs_key','pem_wrapper_invalid','pem_body_encoding_invalid','pem_der_unparseable','pem_der_wrong_type_or_curve','pem_der_sign_failed','pem_wrapper_unclassified'}
meta=json.loads(sys.argv[2])
with open(sys.argv[1],encoding='utf-8') as f:
    value=json.load(f)
stage=value.get('encodingStage') if isinstance(value,dict) and set(value)=={'encodingStage'} else None
if meta.get('StatusCode')!=200 or meta.get('FunctionError') is not None or stage not in allowed:
    sys.exit('STOP: unclassified probe result; alias remains on version 3')
print('encodingStage:',stage)
PY
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 3 || { echo 'STOP: alias changed'; exit 1; }
echo 'production alias: 3'
```

Report only `sourceKeyStage`, `encodingStage`, and `production alias: 3`. Do not publish, move the alias, change environment variables, print the key, or run an iPhone Retry. A `*_repairs_key` result identifies an **in-memory** encoding transformation that produced a parseable P-256 key and an ES256 JWT; it is not authorization to promote the diagnostic build. If the local source is `ready` but Lambda reports a damaged wrapper/base64/DER code, the environment copy differs from the valid downloaded file and needs a separately reviewed secure re-provisioning method.

## Stage 7 — byte-preserving private-key re-provisioning and signing gate

The owner reported `sourceKeyStage:ready`, `encodingStage:pem_rewrap_repairs_key`, and production alias **3**. The original downloaded In-App Purchase `.p8` is a valid P-256 signing key; the Lambda environment string has malformed PEM line structure. Re-entering multiline text through the Lambda console twice did not fix it. Stage 7 uses **canonical base64 as a transport encoding only**, not as encryption. The value remains a secret and is pasted only into the owner's AWS Lambda console. The verifier decodes the original file bytes in memory, checks canonical base64 and UTF-8 byte round trip, parses an EC P-256 private key, and then uses Apple's unchanged ES256 signing path. No PEM rewrapping, trust-policy relaxation, Apple API call, Supabase change, or physical Retry is part of this stage.

### 7A. Copy an exact encoding of the original file locally

Use the computer that already holds the downloaded In-App Purchase `.p8`. On Windows PowerShell, enter **only the file path** at the prompt; never enter the key contents into a shell command. The script validates the original bytes and copies `b64:` plus their canonical base64 encoding to the local clipboard through stdin. It prints only `consoleCopy: ready` or a fixed failure code; it does not print or save the encoded value. The clipboard value is still secret.

```powershell
$lp24466sPrivateKeyPath = Read-Host 'Full path to the original In-App Purchase .p8 file'
& 'C:\Program Files\nodejs\node.exe' 'C:\GitHub\liberty-county-map\tools\apple-store-verifier-node\prepare-private-key-console.mjs' $lp24466sPrivateKeyPath
Remove-Variable lp24466sPrivateKeyPath -ErrorAction SilentlyContinue
```

If the original file is only on the Mac, transfer **only** `prepare-private-key-console.mjs` to that Mac and run `node prepare-private-key-console.mjs /private/path/to/original.p8` there; it uses `pbcopy`. Do not move the `.p8` into CloudShell or the repository. Stop unless the result is `consoleCopy: ready`.

In the AWS Lambda console for **gridly-apple-store-verifier**, region **us-east-1**, open **Configuration → Environment variables → Edit**. Change **only** `GRIDLY_APPLE_PRIVATE_KEY_P8`: paste the local clipboard value into its value field, save, and wait until the function update completes. Do not put the value in CloudShell, chat, a repository file, a URL, or a log. Do not change `GRIDLY_APPLE_KEY_ID`, other secrets, the `production` alias, or the Function URL. After saving, clear the active clipboard locally with `Set-Clipboard -Value ''` on Windows or `printf '' | pbcopy` on Mac; clear the operating system's clipboard history if it is enabled. Do not report or screenshot the field value.

### 7B. Upload only the decoder probe to `$LATEST` and test signing

Upload `.artifacts/lp24466s-aws-node-p8-base64-probe.zip` through CloudShell **Actions → Upload file**. Expected ZIP SHA-256: `3ef73555e4cb1681cf097c9f4637a53cca42bf18643eb3d23e13333fbede8584`. Expected Lambda `CodeSha256`: `Pvc1VeTLFoHPCXyfRjelPMpCvxhkPrPSPhMzP77ehYQ=`. Its **1,071** entries match the Stage 6 diagnostic ZIP except `verifier.mjs`. The guards below require production alias **3** and the expected old `$LATEST` code. The probe prints only the two booleans; it does **not** publish or move the alias.

```bash
set -euo pipefail
f=gridly-apple-store-verifier
old_alias_sha='4P8ECDkHK5GpMQB5g2DngvEmVMXN04ZTQjSsQTJocIo='
old_latest_sha='AkH8NIU1K1A0n0ICYphHzX5sfTXTM4PyHvGz/jIcv3c='
new_sha='Pvc1VeTLFoHPCXyfRjelPMpCvxhkPrPSPhMzP77ehYQ='
zip_sha='3ef73555e4cb1681cf097c9f4637a53cca42bf18643eb3d23e13333fbede8584'
test "$(sha256sum lp24466s-aws-node-p8-base64-probe.zip | cut -d' ' -f1)" = "$zip_sha" || { echo 'STOP: ZIP mismatch'; exit 1; }
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 3 || { echo 'STOP: alias changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$old_alias_sha" || { echo 'STOP: alias code changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$old_latest_sha" || { echo 'STOP: latest code changed'; exit 1; }
aws lambda update-function-code --region us-east-1 --function-name "$f" --zip-file fileb://lp24466s-aws-node-p8-base64-probe.zip --query '{CodeSha256:CodeSha256,Version:Version}' --output json > /dev/null
aws lambda wait function-updated-v2 --region us-east-1 --function-name "$f"
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: uploaded code mismatch'; exit 1; }
probe_file=$(mktemp)
trap 'rm -f "$probe_file"' EXIT
invoke_meta=$(aws lambda invoke --region us-east-1 --function-name "$f" --qualifier '$LATEST' --cli-binary-format raw-in-base64-out --payload '{"probe":"lp24466s_api_signing"}' --query '{StatusCode:StatusCode,FunctionError:FunctionError}' --output json "$probe_file")
python3 - "$probe_file" "$invoke_meta" <<'PY'
import json,sys
meta=json.loads(sys.argv[2])
with open(sys.argv[1],encoding='utf-8') as f:
    value=json.load(f)
if meta.get('StatusCode')!=200 or meta.get('FunctionError') is not None or not isinstance(value,dict) or set(value)!={'configurationUsable','signingUsable'}:
    sys.exit('STOP: unclassified signing result; alias remains on version 3')
configuration=value.get('configurationUsable') is True
signing=value.get('signingUsable') is True
print('configurationUsable:',str(configuration).lower())
print('signingUsable:',str(signing).lower())
if not (configuration and signing):
    sys.exit('STOP: alias remains on version 3')
PY
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 3 || { echo 'STOP: alias changed'; exit 1; }
echo 'production alias: 3'
```

Report only `consoleCopy`, `configurationUsable`, `signingUsable`, and `production alias: 3`, or the exact bounded guard failure. Do not report the clipboard value, the key path, private-key bytes, JWT, environment values, or invocation file. A `true/true` signing result certifies only local credential parsing and ES256 JWT construction; it does not prove Apple's current-status response, paid ownership, entitlement persistence, or admission. Review that result before any publication, alias movement, or iPhone Retry.

## Stage 8 — guarded immutable promotion and bounded Sandbox status-path check

The owner reports Stage 7 `consoleCopy:ready`, `configurationUsable:true`, `signingUsable:true`, and `production` alias **3**. No version was published and no physical Retry occurred. This stage first publishes the **existing Stage 7 `$LATEST` code/configuration** as one immutable version and moves only the `production` alias after a second signing check against that published version. It preserves the alias Function URL, its two permission statements, no CORS, runtime/handler and existing secret configuration. It never prints environment values or queries their names; signing is checked on both `$LATEST` and the newly published version. The live URL denial checks remain GET **405** and unauthenticated POST **401**. [AWS version snapshots](https://docs.aws.amazon.com/lambda/latest/api/API_PublishVersion.html); [AWS aliases](https://docs.aws.amazon.com/lambda/latest/dg/configuration-aliases.html).

### 8A. Publish Stage 7 and move only `production`

Run in the same AWS account's CloudShell in `us-east-1`. Do not upload a ZIP or edit any environment variable in this step. The block stops before the alias move if any identity, hash, configuration, signing, URL or permission guard fails.

```bash
set -euo pipefail
f=gridly-apple-store-verifier
old_sha='4P8ECDkHK5GpMQB5g2DngvEmVMXN04ZTQjSsQTJocIo='
new_sha='Pvc1VeTLFoHPCXyfRjelPMpCvxhkPrPSPhMzP77ehYQ='
expected_url='https://65jtqq7ox5izj6fmtysi23uzbe0zonot.lambda-url.us-east-1.on.aws/'
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 3 || { echo 'STOP: alias changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$old_sha" || { echo 'STOP: alias code changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: latest code changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query Runtime --output text)" = nodejs24.x || { echo 'STOP: runtime changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query Handler --output text)" = verifier.handler || { echo 'STOP: handler changed'; exit 1; }
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query RoutingConfig --output json)" = null || { echo 'STOP: weighted alias routing exists'; exit 1; }
test "$(aws lambda list-function-url-configs --region us-east-1 --function-name "$f" --query 'length(FunctionUrlConfigs)' --output json)" = 1 || { echo 'STOP: URL inventory changed'; exit 1; }
url_before=$(aws lambda get-function-url-config --region us-east-1 --function-name "$f" --qualifier production --query FunctionUrl --output text)
test "$url_before" = "$expected_url" || { echo 'STOP: Function URL changed'; exit 1; }
test "$(aws lambda get-function-url-config --region us-east-1 --function-name "$f" --qualifier production --query AuthType --output text)" = NONE || { echo 'STOP: URL auth changed'; exit 1; }
test "$(aws lambda get-function-url-config --region us-east-1 --function-name "$f" --qualifier production --query Cors --output json)" = null || { echo 'STOP: CORS changed'; exit 1; }
policy_before=$(aws lambda get-policy --region us-east-1 --function-name "$f" --qualifier production --query Policy --output text)
alias_rev=$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query RevisionId --output text)
latest_rev=$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query RevisionId --output text)
probe_file=$(mktemp)
trap 'rm -f "$probe_file"' EXIT
check_signing() {
  local qualifier="$1" meta
  meta=$(aws lambda invoke --region us-east-1 --function-name "$f" --qualifier "$qualifier" --cli-binary-format raw-in-base64-out --payload '{"probe":"lp24466s_api_signing"}' --query '{StatusCode:StatusCode,FunctionError:FunctionError}' --output json "$probe_file")
  python3 - "$probe_file" "$meta" <<'PY'
import json,sys
meta=json.loads(sys.argv[2])
with open(sys.argv[1],encoding='utf-8') as f:
    value=json.load(f)
if meta.get('StatusCode')!=200 or meta.get('FunctionError') is not None or value!={'configurationUsable':True,'signingUsable':True}:
    sys.exit('STOP: signing probe failed before alias move')
print('signing: PASS')
PY
}
check_signing '$LATEST'
v=$(aws lambda publish-version --region us-east-1 --function-name "$f" --code-sha256 "$new_sha" --revision-id "$latest_rev" --query Version --output text)
[[ "$v" =~ ^[1-9][0-9]*$ ]] && (( v > 3 )) || { echo 'STOP: invalid published version'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier "$v" --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: published code mismatch'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier "$v" --query Runtime --output text)" = nodejs24.x || { echo 'STOP: published runtime mismatch'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier "$v" --query Handler --output text)" = verifier.handler || { echo 'STOP: published handler mismatch'; exit 1; }
check_signing "$v"
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = 3 || { echo 'STOP: alias moved concurrently'; exit 1; }
aws lambda update-alias --region us-east-1 --function-name "$f" --name production --function-version "$v" --revision-id "$alias_rev" --query '{Name:Name,FunctionVersion:FunctionVersion}'
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = "$v" || { echo 'STOP: alias target mismatch'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: alias code mismatch'; exit 1; }
test "$(aws lambda get-function-url-config --region us-east-1 --function-name "$f" --qualifier production --query FunctionUrl --output text)" = "$url_before" || { echo 'STOP: Function URL changed'; exit 1; }
test "$(aws lambda get-function-url-config --region us-east-1 --function-name "$f" --qualifier production --query AuthType --output text)" = NONE || { echo 'STOP: URL auth changed'; exit 1; }
test "$(aws lambda get-function-url-config --region us-east-1 --function-name "$f" --qualifier production --query Cors --output json)" = null || { echo 'STOP: CORS changed'; exit 1; }
test "$(aws lambda get-policy --region us-east-1 --function-name "$f" --qualifier production --query Policy --output text)" = "$policy_before" || { echo 'STOP: alias URL permissions changed'; exit 1; }
get_code=$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' "$url_before")
post_code=$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' --request POST --header 'content-type: application/json' --data '{}' "$url_before")
test "$get_code" = 405 && test "$post_code" = 401 || { echo 'STOP: URL denial postflight failed'; exit 1; }
echo "published version: $v"
echo "production alias: $v"
echo "CodeSha256: $new_sha"
echo "GET: $get_code"
echo "POST: $post_code"
```

If the alias moved and any postflight guard fails, stop and run this exact rollback guard. It moves **only** `production` back to version **3** if it still targets the newly published Stage 7 code. It does not change URL, policies, secrets, or the newly published immutable version. Report the original bounded failure and rollback result; do not run an iPhone Retry.

```bash
set -euo pipefail
f=gridly-apple-store-verifier
new_sha='Pvc1VeTLFoHPCXyfRjelPMpCvxhkPrPSPhMzP77ehYQ='
old_sha='4P8ECDkHK5GpMQB5g2DngvEmVMXN04ZTQjSsQTJocIo='
current=$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)
[[ "$current" =~ ^[1-9][0-9]*$ ]] && (( current > 3 )) || { echo 'STOP: alias no longer targets the new version'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: alias code changed'; exit 1; }
rev=$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query RevisionId --output text)
aws lambda update-alias --region us-east-1 --function-name "$f" --name production --function-version 3 --revision-id "$rev" --query '{Name:Name,FunctionVersion:FunctionVersion}'
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$old_sha" || { echo 'STOP: rollback code mismatch'; exit 1; }
echo 'rollback alias: 3'
```

### 8B. One direct Sandbox status-path check, without ownership data

Run only after 8A reports the new alias/version and GET **405** / POST **401**. This step uploads an **additional diagnostic only to `$LATEST`**; it does not publish or move `production`. The diagnostic calls Apple's Sandbox `Get All Subscription Statuses` once using the fixed all-zero reference `00000000000000000000`, which is not owner transaction evidence. It returns one fixed `statusPath` code and never returns provider response bodies, keys, JWTs, transaction data, or secrets. Apple's documented responses distinguish invalid transaction ID **400**, invalid JWT **401**, and transaction not found **404**; this probe cannot prove genuine ownership or entitlement. [Apple endpoint and response codes](https://developer.apple.com/documentation/appstoreserverapi/get-all-subscription-statuses); [InvalidTransactionIdError](https://developer.apple.com/documentation/appstoreserverapi/invalidtransactioniderror).

Upload `.artifacts/lp24466s-aws-node-status-path-probe.zip` through CloudShell **Actions → Upload file**. Expected ZIP SHA-256: `f3f39bb464e8dc4d2785c7fc6f93dc209113c40b505572be0c61fb7400be1916`. Expected Lambda `CodeSha256`: `8/ObtGTo3E0nhcf8b5PcIJETxAtQVXK+DGH7dAC+GRY=`. Its **1,071** entries match the Stage 7 ZIP except `verifier.mjs`, where the only added behavior is the exact-event IAM status probe. Run:

```bash
set -euo pipefail
f=gridly-apple-store-verifier
alias_sha='Pvc1VeTLFoHPCXyfRjelPMpCvxhkPrPSPhMzP77ehYQ='
new_sha='8/ObtGTo3E0nhcf8b5PcIJETxAtQVXK+DGH7dAC+GRY='
zip_sha='f3f39bb464e8dc4d2785c7fc6f93dc209113c40b505572be0c61fb7400be1916'
test "$(sha256sum lp24466s-aws-node-status-path-probe.zip | cut -d' ' -f1)" = "$zip_sha" || { echo 'STOP: ZIP mismatch'; exit 1; }
v=$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)
[[ "$v" =~ ^[1-9][0-9]*$ ]] && (( v > 3 )) || { echo 'STOP: alias not promoted'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$alias_sha" || { echo 'STOP: alias code changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$alias_sha" || { echo 'STOP: latest code changed'; exit 1; }
aws lambda update-function-code --region us-east-1 --function-name "$f" --zip-file fileb://lp24466s-aws-node-status-path-probe.zip --query '{CodeSha256:CodeSha256,Version:Version}' --output json > /dev/null
aws lambda wait function-updated-v2 --region us-east-1 --function-name "$f"
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --query CodeSha256 --output text)" = "$new_sha" || { echo 'STOP: diagnostic code mismatch'; exit 1; }
probe_file=$(mktemp)
trap 'rm -f "$probe_file"' EXIT
invoke_meta=$(aws lambda invoke --region us-east-1 --function-name "$f" --qualifier '$LATEST' --cli-binary-format raw-in-base64-out --payload '{"probe":"lp24466s_status_path"}' --query '{StatusCode:StatusCode,FunctionError:FunctionError}' --output json "$probe_file")
python3 - "$probe_file" "$invoke_meta" <<'PY'
import json,sys
allowed={'configuration_unusable','signing_unusable','unexpected_success','apple_invalid_transaction_id','apple_unauthorized','apple_transaction_not_found','apple_other_bad_request','apple_other_not_found','apple_rate_limited','apple_server_unavailable','transport_unavailable','unclassified_failure'}
meta=json.loads(sys.argv[2])
with open(sys.argv[1],encoding='utf-8') as f:
    value=json.load(f)
stage=value.get('statusPath') if isinstance(value,dict) and set(value)=={'statusPath'} else None
if meta.get('StatusCode')!=200 or meta.get('FunctionError') is not None or stage not in allowed:
    sys.exit('STOP: unclassified status probe; alias remains on the published Stage 7 version')
print('statusPath:',stage)
PY
test "$(aws lambda get-alias --region us-east-1 --function-name "$f" --name production --query FunctionVersion --output text)" = "$v" || { echo 'STOP: alias changed'; exit 1; }
test "$(aws lambda get-function-configuration --region us-east-1 --function-name "$f" --qualifier production --query CodeSha256 --output text)" = "$alias_sha" || { echo 'STOP: alias code changed'; exit 1; }
echo "production alias: $v"
```

Report only the 8A published version, CodeSha256, GET/POST statuses, then the 8B `statusPath` and unchanged alias target. **Do not run an iPhone Retry until this bounded result is reviewed.** A non-401 invalid-ID/not-found result supports the Sandbox status API request path but does not prove the existing purchase, challenge, entitlement or paid admission. An unauthorized, transport, rate-limit, server, or unclassified result is a blocker to investigate before any physical action.
