import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXPECTED_PROJECT_REF = 'nhwhkbkludzkuyxmkkcj';
const TEST_LABEL = 'Gridly Responder Auth Verification Test';
const action = process.argv[2] || '';

function fail(message) {
  throw new Error(String(message));
}

function env(name) {
  const value = process.env[name];
  if (!value) fail(`Required environment variable ${name} is not set.`);
  return value;
}

function requireUuid(value, label) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) {
    fail(`${label} must be one explicit UUID.`);
  }
  return value.toLowerCase();
}

function requireProject() {
  const projectRef = env('GRIDLY_SUPABASE_PROJECT_REF');
  const baseUrl = env('GRIDLY_SUPABASE_URL').replace(/\/+$/, '');
  if (projectRef !== EXPECTED_PROJECT_REF) fail('Refusing unexpected Supabase project reference.');
  if (baseUrl !== `https://${EXPECTED_PROJECT_REF}.supabase.co`) fail('Refusing unexpected Supabase URL.');
  return { baseUrl, projectRef };
}

function secretKey() {
  return process.env.GRIDLY_SUPABASE_SECRET_KEY || process.env.GRIDLY_SUPABASE_SERVICE_ROLE_KEY ||
    fail('GRIDLY_SUPABASE_SECRET_KEY or GRIDLY_SUPABASE_SERVICE_ROLE_KEY is required.');
}

function publishableKey() {
  return env('GRIDLY_SUPABASE_PUBLISHABLE_KEY');
}

function cleanErrorCode(value) {
  const code = value && typeof value === 'object' && (value.error_code || value.code);
  return typeof code === 'string' && /^[a-z0-9_.-]{1,80}$/i.test(code) ? code : 'unclassified';
}

async function request(baseUrl, endpoint, options = {}) {
  const apiKey = options.apiKey;
  const bearer = options.bearer || apiKey;
  const headers = { apikey: apiKey, Authorization: `Bearer ${bearer}` };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'error'
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  const accepted = options.accept || [200];
  if (!accepted.includes(response.status)) {
    fail(`${options.label || 'Supabase request'} failed: HTTP ${response.status}, code ${cleanErrorCode(data)}. Response body suppressed.`);
  }
  return { status: response.status, data };
}

function decodeClaims(accessToken) {
  const parts = String(accessToken || '').split('.');
  if (parts.length !== 3) fail('Issued access token was not a three-part JWT.');
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); }
  catch { fail('Issued access token payload could not be decoded.'); }
  const amrEntries = Array.isArray(claims.amr) ? claims.amr : [];
  const amrMethods = [...new Set(amrEntries.map((entry) =>
    typeof entry === 'string' ? entry : entry && typeof entry.method === 'string' ? entry.method : null
  ).filter(Boolean))].sort();
  return {
    claim_names: Object.keys(claims).sort(),
    sub_sha256_16: typeof claims.sub === 'string' ? createHash('sha256').update(claims.sub).digest('hex').slice(0, 16) : null,
    subject_uuid: typeof claims.sub === 'string' ? claims.sub : null,
    aal: typeof claims.aal === 'string' ? claims.aal : 'aal1',
    session_id: typeof claims.session_id === 'string' ? claims.session_id : null,
    iat: Number.isInteger(claims.iat) ? claims.iat : null,
    exp: Number.isInteger(claims.exp) ? claims.exp : null,
    amr_methods: amrMethods,
    amr_shape: Array.isArray(claims.amr) ? 'array' : claims.amr === undefined ? 'absent' : 'unexpected'
  };
}

function publicClaims(accessToken, expectedUserId) {
  const claims = decodeClaims(accessToken);
  if (expectedUserId && claims.subject_uuid !== expectedUserId) fail('Issued JWT subject did not match the supplied test user UUID.');
  delete claims.subject_uuid;
  return claims;
}

function normalizeFactors(data) {
  const values = Array.isArray(data) ? data : data && Array.isArray(data.all) ? data.all :
    data && Array.isArray(data.factors) ? data.factors : [];
  const seen = new Set();
  return values.filter((factor) => factor && typeof factor.id === 'string' && !seen.has(factor.id) && seen.add(factor.id)).map((factor) => ({
    id: factor.id,
    factor_type: factor.factor_type || factor.type || null,
    status: factor.status || null,
    created_at: factor.created_at || null,
    updated_at: factor.updated_at || null
  }));
}

async function signIn(baseUrl, userId) {
  const response = await request(baseUrl, '/auth/v1/token?grant_type=password', {
    method: 'POST', apiKey: publishableKey(), label: 'Password sign-in',
    body: { email: env('GRIDLY_RESPONDER_TEST_EMAIL'), password: env('GRIDLY_RESPONDER_TEST_PASSWORD') }
  });
  if (!response.data?.access_token || !response.data?.refresh_token) fail('Sign-in response omitted required session tokens.');
  const raw = decodeClaims(response.data.access_token);
  if (raw.subject_uuid !== userId) fail('Sign-in returned a different Auth user.');
  return response.data;
}

async function listUserFactors(baseUrl, accessToken) {
  const result = await request(baseUrl, '/auth/v1/user', {
    apiKey: publishableKey(), bearer: accessToken, label: 'List MFA factors'
  });
  return normalizeFactors(result.data?.user || result.data);
}

async function elevateTotp(baseUrl, session, factorId) {
  const challenge = await request(baseUrl, `/auth/v1/factors/${encodeURIComponent(factorId)}/challenge`, {
    method: 'POST', apiKey: publishableKey(), bearer: session.access_token, body: {}, label: 'TOTP challenge'
  });
  const challengeId = challenge.data?.id;
  if (!challengeId) fail('Challenge response omitted its identifier.');
  const verified = await request(baseUrl, `/auth/v1/factors/${encodeURIComponent(factorId)}/verify`, {
    method: 'POST', apiKey: publishableKey(), bearer: session.access_token,
    body: { challenge_id: challengeId, code: env('GRIDLY_RESPONDER_TOTP_CODE') }, label: 'TOTP verification'
  });
  if (!verified.data?.access_token) fail('TOTP verification response omitted an access token.');
  return verified.data;
}

async function probeOldToken(baseUrl, accessToken) {
  const key = publishableKey();
  const auth = await request(baseUrl, '/auth/v1/user', {
    apiKey: key, bearer: accessToken, label: 'Old-token Auth user probe', accept: [200, 401, 403]
  });
  const rest = await request(baseUrl, '/rest/v1/reports?select=id&limit=0', {
    apiKey: key, bearer: accessToken, label: 'Old-token zero-row PostgREST probe', accept: [200, 206, 401, 403]
  });
  return {
    auth_user_http_status: auth.status,
    auth_user_accepted: auth.status === 200,
    postgrest_zero_row_http_status: rest.status,
    postgrest_jwt_accepted: rest.status === 200 || rest.status === 206
  };
}

function writeQrFile(qrCode) {
  const target = path.resolve(env('GRIDLY_RESPONDER_QR_PATH'));
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!target.startsWith(tempRoot) || path.extname(target).toLowerCase() !== '.html') {
    fail('QR output must be one HTML file under the operating-system temporary directory.');
  }
  const source = String(qrCode || '');
  if (!source) fail('TOTP enrollment response omitted the QR code.');
  const imageSource = source.startsWith('data:image/') ? source :
    `data:image/svg+xml;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
  const html = '<!doctype html><meta charset="utf-8"><title>Gridly temporary TOTP enrollment</title>' +
    '<style>body{font-family:system-ui;text-align:center;padding:2rem}img{max-width:420px;width:90vw}</style>' +
    `<h1>${TEST_LABEL}</h1><p>Scan once. Close this window immediately.</p><img alt="Temporary TOTP QR" src=${JSON.stringify(imageSource)}>`;
  fs.writeFileSync(target, html, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}

async function preflight() {
  const { baseUrl, projectRef } = requireProject();
  const publicSettings = await request(baseUrl, '/auth/v1/settings', {
    apiKey: publishableKey(), label: 'Auth settings preflight'
  });
  await request(baseUrl, '/auth/v1/admin/users?page=1&per_page=1', {
    apiKey: secretKey(), label: 'Auth admin credential preflight'
  });
  return {
    mode: 'Preflight', project_ref: projectRef, production_project: 'Gridly Platform',
    auth_endpoint_reachable: true, admin_credential_accepted: true,
    external_email_enabled: Boolean(publicSettings.data?.external?.email),
    totp_setting_exposed: Object.hasOwn(publicSettings.data || {}, 'mfa_enabled') || Object.hasOwn(publicSettings.data || {}, 'mfa_totp_enabled'),
    secret_values_displayed: false
  };
}

async function createTestUser() {
  const { baseUrl } = requireProject();
  const result = await request(baseUrl, '/auth/v1/admin/users', {
    method: 'POST', apiKey: secretKey(), label: 'Create dedicated Auth test user',
    body: {
      email: env('GRIDLY_RESPONDER_TEST_EMAIL'), password: env('GRIDLY_RESPONDER_TEST_PASSWORD'), email_confirm: true,
      user_metadata: { display_name: TEST_LABEL },
      app_metadata: { gridly_operator_test: TEST_LABEL }
    }
  });
  const user = result.data?.user || result.data;
  if (!user?.id) fail('Create-user response omitted the user UUID.');
  return { mode: 'CreateTestUser', created: true, user_id: user.id, created_at: user.created_at || null, label: TEST_LABEL };
}

async function inspectAal1() {
  const { baseUrl } = requireProject();
  const userId = requireUuid(env('GRIDLY_RESPONDER_TEST_USER_ID'), 'Test user ID');
  const session = await signIn(baseUrl, userId);
  const factors = await listUserFactors(baseUrl, session.access_token);
  return { mode: 'InspectAal1', claims: publicClaims(session.access_token, userId), factors };
}

async function enrollTotp() {
  const { baseUrl } = requireProject();
  const userId = requireUuid(env('GRIDLY_RESPONDER_TEST_USER_ID'), 'Test user ID');
  const session = await signIn(baseUrl, userId);
  const existing = await listUserFactors(baseUrl, session.access_token);
  if (existing.length !== 0) fail('Refusing enrollment because this test user already has a factor; enter recovery instead.');
  const enrolled = await request(baseUrl, '/auth/v1/factors', {
    method: 'POST', apiKey: publishableKey(), bearer: session.access_token, label: 'Enroll TOTP factor',
    body: { factor_type: 'totp', friendly_name: TEST_LABEL }
  });
  const factorId = requireUuid(enrolled.data?.id, 'Enrolled factor ID');
  writeQrFile(enrolled.data?.totp?.qr_code);
  return { mode: 'EnrollTotp', factor_id: factorId, factor_type: enrolled.data?.type || 'totp', status: 'unverified', qr_written_to_temporary_file: true };
}

async function verifyTotp() {
  const { baseUrl } = requireProject();
  const userId = requireUuid(env('GRIDLY_RESPONDER_TEST_USER_ID'), 'Test user ID');
  const factorId = requireUuid(env('GRIDLY_RESPONDER_FACTOR_ID'), 'Factor ID');
  const before = await signIn(baseUrl, userId);
  const after = await elevateTotp(baseUrl, before, factorId);
  const beforeClaims = publicClaims(before.access_token, userId);
  const afterClaims = publicClaims(after.access_token, userId);
  const factors = await listUserFactors(baseUrl, after.access_token);
  return {
    mode: 'VerifyTotp', before: beforeClaims, after: afterClaims,
    same_session_id: beforeClaims.session_id === afterClaims.session_id,
    totp_in_amr: afterClaims.amr_methods.includes('totp'), factors
  };
}

async function revokeSession() {
  const { baseUrl } = requireProject();
  const userId = requireUuid(env('GRIDLY_RESPONDER_TEST_USER_ID'), 'Test user ID');
  const factorId = requireUuid(env('GRIDLY_RESPONDER_FACTOR_ID'), 'Factor ID');
  const aal1 = await signIn(baseUrl, userId);
  const aal2 = await elevateTotp(baseUrl, aal1, factorId);
  const oldAccessToken = aal2.access_token;
  const before = publicClaims(oldAccessToken, userId);
  const logout = await request(baseUrl, '/auth/v1/logout?scope=local', {
    method: 'POST', apiKey: publishableKey(), bearer: oldAccessToken, label: 'Local session revocation', accept: [204]
  });
  return { mode: 'RevokeSession', revoked_session: before.session_id, claims_before: before, logout_http_status: logout.status, old_token_probe: await probeOldToken(baseUrl, oldAccessToken) };
}

async function removeFactor() {
  const { baseUrl } = requireProject();
  const userId = requireUuid(env('GRIDLY_RESPONDER_TEST_USER_ID'), 'Test user ID');
  const factorId = requireUuid(env('GRIDLY_RESPONDER_FACTOR_ID'), 'Factor ID');
  const aal1 = await signIn(baseUrl, userId);
  const aal2 = await elevateTotp(baseUrl, aal1, factorId);
  const oldAccessToken = aal2.access_token;
  const oldRefreshToken = aal2.refresh_token;
  const before = publicClaims(oldAccessToken, userId);
  await request(baseUrl, `/auth/v1/factors/${encodeURIComponent(factorId)}`, {
    method: 'DELETE', apiKey: publishableKey(), bearer: oldAccessToken, label: 'Remove TOTP factor'
  });
  const probe = await probeOldToken(baseUrl, oldAccessToken);
  let refresh;
  try {
    const refreshed = await request(baseUrl, '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', apiKey: publishableKey(), body: { refresh_token: oldRefreshToken }, label: 'Post-removal refresh'
    });
    refresh = { accepted: true, claims: publicClaims(refreshed.data?.access_token, userId) };
  } catch {
    refresh = { accepted: false, claims: null };
  }
  const fresh = await signIn(baseUrl, userId);
  const factors = await listUserFactors(baseUrl, fresh.access_token);
  return { mode: 'RemoveFactor', removed_factor_id: factorId, claims_before: before, old_token_probe: probe, post_removal_refresh: refresh, fresh_sign_in_claims: publicClaims(fresh.access_token, userId), factors };
}

async function recoverUnverifiedTotpFactor() {
  const { baseUrl } = requireProject();
  const userId = requireUuid(env('GRIDLY_RESPONDER_TEST_USER_ID'), 'Test user ID');
  const factorId = requireUuid(env('GRIDLY_RESPONDER_FACTOR_ID'), 'Factor ID');
  const key = secretKey();

  const exact = await request(baseUrl, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    apiKey: key, label: 'Read exact TOTP recovery user'
  });
  const user = exact.data?.user || exact.data;
  if (String(user?.id || '').toLowerCase() !== userId) {
    fail('TOTP recovery refused: admin response did not match the supplied test user UUID.');
  }
  if (user?.app_metadata?.gridly_operator_test !== TEST_LABEL) {
    fail('TOTP recovery refused: supplied UUID is not marked as the dedicated Gridly test identity.');
  }

  const factorResponse = await request(baseUrl, `/auth/v1/admin/users/${encodeURIComponent(userId)}/factors`, {
    apiKey: key, label: 'List exact TOTP recovery user factors'
  });
  const values = Array.isArray(factorResponse.data) ? factorResponse.data :
    factorResponse.data && Array.isArray(factorResponse.data.all) ? factorResponse.data.all :
    factorResponse.data && Array.isArray(factorResponse.data.factors) ? factorResponse.data.factors : [];
  const matching = values.filter((factor) =>
    factor && typeof factor.id === 'string' && factor.id.toLowerCase() === factorId
  );
  if (matching.length !== 1) {
    fail(`TOTP recovery refused: expected exactly one factor matching the supplied UUID; found ${matching.length}.`);
  }
  const factor = matching[0];
  if (factor.user_id && String(factor.user_id).toLowerCase() !== userId) {
    fail('TOTP recovery refused: supplied factor does not belong to the supplied test user.');
  }
  const factorType = factor.factor_type || factor.type || null;
  if (factorType !== 'totp') fail('TOTP recovery refused: supplied factor is not TOTP.');
  if (factor.status !== 'unverified') fail('TOTP recovery refused: supplied factor is not unverified.');

  await request(baseUrl, `/auth/v1/admin/users/${encodeURIComponent(userId)}/factors/${encodeURIComponent(factorId)}`, {
    method: 'DELETE', apiKey: key, label: 'Delete exact unverified TOTP recovery factor'
  });
  return {
    mode: 'RecoverUnverifiedTotpFactor', user_id: userId, user_marker_verified: true,
    factor_id: factorId, matching_factor_count: matching.length, factor_type: factorType,
    prior_status: factor.status, deleted: true, session_operation_performed: false,
    refresh_token_operation_performed: false, user_delete_operation_performed: false,
    password_sign_in_performed: false, totp_challenge_performed: false
  };
}

async function cleanup() {
  const { baseUrl } = requireProject();
  const userId = requireUuid(env('GRIDLY_RESPONDER_TEST_USER_ID'), 'Test user ID');
  const key = secretKey();
  const exact = await request(baseUrl, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    apiKey: key, label: 'Read exact cleanup user'
  });
  const user = exact.data?.user || exact.data;
  if (user?.app_metadata?.gridly_operator_test !== TEST_LABEL) fail('Cleanup refused: supplied UUID is not marked as the dedicated Gridly test identity.');
  if (String(user?.email || '').toLowerCase() !== env('GRIDLY_RESPONDER_TEST_EMAIL').toLowerCase()) fail('Cleanup refused: supplied UUID and test email do not match.');
  let globalLogout = 'not-established';
  try {
    const session = await signIn(baseUrl, userId);
    await request(baseUrl, '/auth/v1/logout?scope=global', {
      method: 'POST', apiKey: publishableKey(), bearer: session.access_token, label: 'Global test-user session revocation', accept: [204]
    });
    globalLogout = 'completed';
  } catch {
    globalLogout = 'sign-in-unavailable-admin-delete-will-cascade';
  }
  const factorResponse = await request(baseUrl, `/auth/v1/admin/users/${encodeURIComponent(userId)}/factors`, {
    apiKey: key, label: 'List exact cleanup user factors'
  });
  const factors = normalizeFactors(factorResponse.data);
  for (const factor of factors) {
    await request(baseUrl, `/auth/v1/admin/users/${encodeURIComponent(userId)}/factors/${encodeURIComponent(factor.id)}`, {
      method: 'DELETE', apiKey: key, label: 'Delete exact cleanup user factor'
    });
  }
  await request(baseUrl, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE', apiKey: key, body: { should_soft_delete: false }, label: 'Delete exact dedicated Auth test user'
  });
  return { mode: 'Cleanup', user_id: userId, sessions_revocation: globalLogout, factors_removed: factors.length, hard_deleted: true };
}

function simulateCutoff() {
  const oldIat = Number(process.argv[3]);
  const candidateIat = process.argv[4] === undefined ? null : Number(process.argv[4]);
  if (!Number.isSafeInteger(oldIat) || oldIat < 1) fail('Observed old JWT iat must be a positive integer.');
  if (candidateIat !== null && (!Number.isSafeInteger(candidateIat) || candidateIat < 1)) fail('Candidate new JWT iat must be a positive integer.');
  const minimumIat = oldIat + 1;
  return {
    mode: 'SimulateCutoff', comparison: 'jwt.iat >= minimum_iat', observed_old_iat: oldIat,
    minimum_iat: minimumIat, old_token_allowed: oldIat >= minimumIat,
    same_second_reissue_allowed: oldIat >= minimumIat,
    equality_at_boundary_allowed: minimumIat >= minimumIat,
    candidate_new_iat: candidateIat,
    candidate_new_token_allowed: candidateIat === null ? null : candidateIat >= minimumIat
  };
}

const actions = {
  preflight, 'create-test-user': createTestUser, 'inspect-aal1': inspectAal1,
  'enroll-totp': enrollTotp, 'verify-totp': verifyTotp,
  'revoke-session': revokeSession, 'remove-factor': removeFactor, cleanup,
  'recover-unverified-totp-factor': recoverUnverifiedTotpFactor,
  'simulate-cutoff': simulateCutoff
};

try {
  if (!Object.hasOwn(actions, action)) fail('Unknown helper action.');
  const result = await actions[action]();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const safe = String(error?.message || 'Unknown failure')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/otpauth:\/\/[^\s"']+/gi, '[REDACTED_TOTP_URI]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]');
  process.stderr.write(`PHASE15A_HELPER_FAILED: ${safe}\n`);
  process.exitCode = 1;
}
