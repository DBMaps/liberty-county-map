# Consumer projection invalidation contract

Only the public-safe view may be a future consumer input. This phase installs no consumer integration. Private unit identity, staff identity/contact, assignments, notes, priorities, operational status metadata/plans, audit, memberships, attachments and law-enforcement-sensitive data never belong in consumer output.

Every server read rechecks candidate state/deadline, source revision/status, organization status, unit readiness, scope status/version/evidence, verification/attestation and capability state/time. Withdrawal, capability revocation/expiry, authority loss, unit offboarding or source change invalidates server eligibility immediately. A periodic cleanup task is not the authority for visibility.

The future delivery adapter must use `Cache-Control: no-store`, prevent CDN/service-worker/private-to-public cache reuse, and target removal from connected/edge displays in under one minute. Any delivered representation has a maximum five-minute visibility lease, including offline clients. Rendering must enforce the earliest of source expiry, received-at plus five minutes and last successful validation plus five minutes. Reconnect, reload or reading a stored payload must not extend the original lease. If freshness cannot be established, hide the representation. Clock rollback fails closed; a production client should use a monotonic elapsed-time bound.

The pure `consumerVisible` model tests connected/offline expiry boundaries. The SQL candidate command caps source freshness at five minutes and the public view denies expired rows. Neither proves a deployed HTTP header, consumer renderer, edge SLA, or offline cache implementation. Those require a separately authorized consumer adapter and end-to-end checks; consumer runtime is unchanged here.

Internal shares use their own recipient and expiry contract. Internal eligibility never supplies consumer authorization, and public capabilities never supply internal recipient membership.
