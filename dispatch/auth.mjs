// Fail closed: the existing delivery Worker has no browser authentication/session route.
// Do not reuse consumer auth, prototype tokens, or invitation endpoints here.
export async function signIn() {
  return {ok:false, message:'Sign in is not connected in this local visual preview. Use your organization’s approved access process.'};
}
export function recoveryMessage() { return 'Contact your organization administrator for account recovery. No recovery email has been sent from this preview.'; }
export function verificationMessage() { return 'Additional verification is required for operational access. This preview cannot verify a code or establish an AAL2 session.'; }
