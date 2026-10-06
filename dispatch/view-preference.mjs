const valid=value=>['board','split','map'].includes(value);
export function initialView(override) {
  if(valid(override))return override; // Local demo deep link; does not overwrite saved preference.
  try {const stored=localStorage.getItem('gridlyDispatchView');return valid(stored)?stored:'board';}catch{return 'board';}
}
export function saveView(value) {
  if(!valid(value))return;
  try{localStorage.setItem('gridlyDispatchView',value);}catch{ /* Selection still works in memory. */ }
}
export function viewControl(mode) {
  return `<label class="view-control">View<select id="dispatch-view">${['board','split','map'].map(value=>`<option value="${value}" ${value===mode?'selected':''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></label>`;
}
