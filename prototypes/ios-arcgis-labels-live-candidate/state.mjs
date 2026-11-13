export const limits = Object.freeze({
  installationDaily: 500, lineageDaily: 1000, aggregateDaily: 10_000,
  perMinute: 60, perInstallationActive: 4, aggregateActive: 64
});

const minute = 60_000;
const day = 86_400_000;
const capacity = 10_000;
const replayCapacity = 512;

// Only for deterministic tests and local harnesses. Every mutation is
// synchronous, so reservations are atomic within a single Node event loop.
export function createMemoryState({ policy = limits } = {}) {
  const leases = new Map(), challenges = new Map(), work = new Map();
  const ingress = new Map(), installations = new Map(), lineages = new Map();
  let enabled = false, date = -1, attempts = 0, lastTime = -1;

  function tick(now) {
    if (now < lastTime) throw Error('clock_unavailable');
    lastTime = now;
    const utcDay = Math.floor(now / day);
    if (utcDay !== date) {
      date = utcDay;
      attempts = 0;
      installations.clear();
      lineages.clear();
    }
    for (const [id, lease] of leases) if (now >= lease.expiresAt) leases.delete(id);
    for (const [id, expiry] of challenges) if (now >= expiry) challenges.delete(id);
    for (const [id, arrivals] of ingress) if (arrivals.at(-1) <= now - minute) ingress.delete(id);
  }

  return Object.freeze({
    isEnabled: () => enabled,
    setEnabled(value) {
      if (enabled && value !== true) for (const lease of leases.values()) lease.revoked = true;
      enabled = value === true;
    },
    issue(lease, challengeId, challengeExpires, now) {
      tick(now);
      if (!enabled) return 'disabled';
      if (challenges.has(challengeId)) return 'denied';
      if (leases.size >= capacity || challenges.size >= capacity) return 'limited';
      challenges.set(challengeId, challengeExpires);
      leases.set(lease.id, { ...lease, seen: new Set(), revoked: false });
      return 'ok';
    },
    get(id) {
      const lease = leases.get(id);
      return lease && { spki: lease.spki, expiresAt: lease.expiresAt, revoked: lease.revoked };
    },
    revoke(id) {
      const lease = leases.get(id);
      if (lease) lease.revoked = true;
      return Boolean(lease);
    },
    reserve(id, requestId, now) {
      tick(now);
      if (!enabled) return 'disabled';
      const lease = leases.get(id);
      if (!lease || lease.revoked || lease.seen.has(requestId)) return 'denied';
      const { installation, lineage } = lease;
      if (!ingress.has(installation) && ingress.size >= capacity) return 'limited';
      const arrivals = (ingress.get(installation) ?? []).filter(time => time > now - minute);
      if (arrivals.length >= policy.perMinute) return 'limited';
      arrivals.push(now);
      ingress.set(installation, arrivals);
      const running = [...work.values()].filter(entry => entry.installation === installation).length;
      const perInstall = installations.get(installation) ?? 0;
      const perLineage = lineages.get(lineage) ?? 0;
      if (attempts >= policy.aggregateDaily || perInstall >= policy.installationDaily || perLineage >= policy.lineageDaily ||
          lease.seen.size >= replayCapacity || work.size >= policy.aggregateActive || running >= policy.perInstallationActive) {
        return 'limited';
      }
      lease.seen.add(requestId);
      work.set(id + ':' + requestId, { id, installation });
      installations.set(installation, perInstall + 1);
      lineages.set(lineage, perLineage + 1);
      attempts++;
      return 'ok';
    },
    finish(id, requestId, now) {
      const reserved = work.delete(id + ':' + requestId);
      tick(now);
      const lease = leases.get(id);
      return reserved && enabled && lease && !lease.revoked ? 'ok' : 'denied';
    },
    metrics: () => ({ attempts, active: work.size, leases: leases.size, challenges: challenges.size })
  });
}

// Use a dedicated server-side Postgres connection with the pilot role only.
// Pool management and the driver are supplied by the future deployment.
export function createPostgresState(query) {
  async function call(statement, values = []) {
    return (await query(statement, values)).rows[0]?.result;
  }
  return Object.freeze({
    isEnabled: () => call('select enabled as result from label_pilot.control where id'),
    issue: (lease, challenge, expiry, now) => call('select label_pilot.issue($1,$2,$3,$4) as result',
      [JSON.stringify(lease), challenge, expiry, now]),
    get: id => call('select label_pilot.get_lease($1) as result', [id]),
    revoke: id => call('select label_pilot.revoke($1) as result', [id]),
    reserve: (id, requestId, now) => call('select label_pilot.reserve($1,$2,$3) as result', [id, requestId, now]),
    finish: (id, requestId, now) => call('select label_pilot.finish($1,$2,$3) as result', [id, requestId, now])
  });
}
