#!/usr/bin/env node

const SUPABASE_URL = process.env.GRIDLY_SUPABASE_URL || 'https://nhwhkbkludzkuyxmkkcj.supabase.co';
const SUPABASE_PUBLIC_KEY = process.env.GRIDLY_SUPABASE_PUBLIC_KEY || 'sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO';
const ROAD_HAZARD_TYPES = ['flooding', 'ice', 'debris', 'crash', 'construction', 'road_closed', 'disabled_vehicle', 'traffic_backup', 'other_hazard', 'hazard_cleared', 'wreck'];
const now = new Date();
const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const params = new URLSearchParams({
  select: '*',
  order: 'created_at.asc',
  limit: String(Math.max(1, Math.min(1000, Number(process.env.GRIDLY_HAZARD_INVENTORY_LIMIT) || 1000)))
});
params.set('expires_at', `gt.${now.toISOString()}`);
params.set('report_type', `in.(${ROAD_HAZARD_TYPES.join(',')})`);

const normalizeType = (type = '') => String(type || '').trim().toLowerCase() === 'wreck' ? 'crash' : String(type || '').trim().toLowerCase() || 'unknown';
const roadName = (row = {}) => row.road_name || row.roadName || row.primary_road || row.primaryRoad || row.nearest_road || row.nearestRoad || row.location_name || row.locationName || row.crossing_name || row.crossingName || 'Unknown road';
const textBlob = (row = {}) => Object.values(row).filter((value) => value !== null && typeof value !== 'undefined').join(' ').toLowerCase();
const containsUs90Waco = (row = {}) => {
  const text = textBlob(row).replace(/\bu\.s\./g, 'us');
  return (/\bus\s*90\b|\bhighway\s*90\b|\bhwy\s*90\b/.test(text)) && /\bwaco\s*(street|st)?\b/.test(text);
};
const likelyTesting = (row = {}) => {
  const text = textBlob(row);
  const source = String(row.source || '').toLowerCase();
  return /\b(test|testing|patch\s*[12]|qa|debug|dev|fixture|sample|marker test|cleanup|audit)\b/.test(text) || ['test', 'testing', 'debug', 'dev', 'qa'].includes(source);
};
const increment = (target, key) => { target[key] = (target[key] || 0) + 1; };

try {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/reports?${params}`, {
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}` }
  });
  if (!response.ok) throw new Error(`Supabase inventory query failed: HTTP ${response.status} ${await response.text()}`);
  const rows = await response.json();
  const byType = {};
  const byRoadName = {};
  const createdToday = [];
  const olderThanToday = [];
  const likelyTestingRows = [];
  const us90WacoRows = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    increment(byType, normalizeType(row.report_type || row.type));
    increment(byRoadName, roadName(row));
    const createdAt = new Date(row.created_at || row.createdAt || 0);
    if (Number.isFinite(createdAt.getTime()) && createdAt >= todayStart) createdToday.push(row);
    else olderThanToday.push(row);
    if (likelyTesting(row)) likelyTestingRows.push(row);
    if (containsUs90Waco(row)) us90WacoRows.push(row);
  }

  const candidateRows = likelyTestingRows.length ? likelyTestingRows : rows.filter((row) => String(row.source || 'user').toLowerCase() === 'user');
  const compact = (row) => ({ id: row.id, type: normalizeType(row.report_type || row.type), roadName: roadName(row), source: row.source || 'user', createdAt: row.created_at || row.createdAt || null, expiresAt: row.expires_at || row.expiresAt || null, detail: row.detail || row.description || '' });
  const summary = {
    generatedAt: now.toISOString(),
    activeCriteria: { table: 'reports', expiresAt: `> ${now.toISOString()}`, reportTypeIn: ROAD_HAZARD_TYPES },
    totalActiveHazards: rows.length,
    activeHazardsByType: byType,
    activeHazardsByRoadNameOrPrimaryRoad: byRoadName,
    activeHazardsContainingUs90AtWacoStreet: us90WacoRows.map(compact),
    activeHazardsCreatedToday: { count: createdToday.length, rows: createdToday.map(compact) },
    activeHazardsOlderThanToday: { count: olderThanToday.length, rows: olderThanToday.map(compact) },
    hazardsLikelyCreatedDuringTesting: { count: likelyTestingRows.length, rows: likelyTestingRows.map(compact) },
    recommendedCleanupCandidates: { count: candidateRows.length, rows: candidateRows.map(compact) },
    cleanupHelperRecommendation: 'Review this output first. If candidates are all recent user-sourced road-hazard test rows, use window.gridlyDevPurgeRecentRoadHazards({ dryRun: true, hours: 24, radiusMiles: 0, sourceFilter: ["user"], deviceIdFilter: [], limit: 100 }) before any confirmed delete. For all active non-TxDOT shared road hazards, gridlyClearSupabaseTestHazards can delete after explicit confirmation but has a broader blast radius.'
  };
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message || String(error), generatedAt: now.toISOString() }, null, 2));
  process.exit(1);
}
