export const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function icon(name) {
  const paths = {board:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', reports:'M6 3h9l3 3v15H6z M9 10h6 M9 14h6 M9 18h4', review:'M9 3h6v4H9z M7 5H5v16h14V5h-2 M8 14l3 3 5-6', activity:'M3 12h4l3-7 4 14 3-7h4', organization:'M3 21h18 M5 21V8h14v13 M3 8l9-5 9 5 M9 11v6 M15 11v6', pin:'M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z M12 7v4 M10 9h4', arrow:'M5 12h14 M14 7l5 5-5 5', lock:'M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3', close:'M6 6l12 12 M18 6 6 18', check:'M5 12l4 4L19 6', search:'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M15 15l6 6'};
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.board}"/></svg>`;
}
export function brand() { return '<div class="brand"><img src="./assets/gridly-logo.png" alt="Gridly"><span>DISPATCH</span></div>'; }
export function badge(value) {
  const tone = {High:'high',Critical:'critical',Moderate:'moderate',Low:'low',Reviewed:'reviewed',Resolved:'reviewed','Needs review':'pending',Active:'active',Monitoring:'low'}[value] || 'neutral';
  return `<span class="badge ${tone}"><span aria-hidden="true" class="dot"></span>${escape(value)}</span>`;
}
export function empty(title, description, action = '') { return `<div class="empty">${icon('check')}<h3>${title}</h3><p>${description}</p>${action}</div>`; }
export function statePanel(state) {
  if (state === 'loading') return '<div class="loading" role="status" aria-label="Loading Dispatch Board"><span>Loading Dispatch Board…</span>' + Array.from({length:4},()=>'<div class="skeleton"></div>').join('') + '</div>';
  const denied = state === 'denied';
  return `<div class="empty" role="alert">${icon(denied?'lock':'activity')}<h3>${denied?'Access could not be verified':'We couldn’t load the Dispatch Board.'}</h3><p>${denied?'Your current unit authorization must be verified before records can be shown. Contact your organization administrator.':'The connection is unavailable. Try again to reload your unit’s board.'}</p><button class="button" id="retry">${denied?'Return to sign in':'Retry'}</button></div>`;
}
export function incidentRow(item) {
  return `<tr><td><button class="record-link" data-record="${item.id}">${escape(item.title)}</button><small>${item.id} · ${escape(item.source)}</small></td><td>${badge(item.severity)}</td><td>${escape(item.location)}<small>${escape(item.unitName)}</small></td><td>${badge(item.status)}<small>${escape(item.review)}</small></td><td><strong>${escape(item.updated)}</strong><small>Internal only</small></td></tr>`;
}
export function reviewItem(item) {
  return `<button class="queue-item" data-record="${item.id}"><span class="queue-top">${badge(item.severity)}<span>${item.updated}</span></span><strong>${escape(item.title)}</strong><span>${escape(item.unitName)}</span><span class="review-label">Needs review ${icon('arrow')}</span><small>Eligibility requires live verification</small></button>`;
}
