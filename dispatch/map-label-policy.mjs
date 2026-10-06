// Static presentation policy; no runtime geographic classification or shared state.
export function roadLabelPolicy(properties){
  const ref=properties.ref||'',name=properties.name||'';
  if(/\b(?:I|US)\s*\d/.test(ref))return {rank:1,minZoom:13,group:'major'};
  if(/\b(?:TX|SH)\s*\d/.test(ref))return {rank:2,minZoom:13,group:'state'};
  if(/\b(?:FM|RM)\s*\d/.test(ref))return {rank:3,minZoom:13,group:'farm'};
  if(/\bCR\s*\d/.test(ref)||/\bCounty (?:Road|Rd)\b/i.test(name))return {rank:6,minZoom:16,group:'county'};
  if(/Main|Winfree/.test(name))return {rank:4,minZoom:14,group:'city'};
  if(/^(primary|secondary|tertiary)/.test(properties.highway||''))return {rank:4.2,minZoom:14,group:'city'};
  return {rank:5,minZoom:15,group:'local'};
}
export const landmarkPolicy=Object.freeze({
  police:{minZoom:13,rank:3.4,symbol:'P',label:'Police facility'},
  fire:{minZoom:13,rank:3.4,symbol:'F',label:'Fire facility'},
  ems:{minZoom:13,rank:3.4,symbol:'+',label:'EMS facility'},
  hospital:{minZoom:13,rank:3.4,symbol:'+',label:'Hospital'},
  municipal:{minZoom:13,rank:3.4,symbol:'G',label:'Municipal facility'},
  school:{minZoom:15,rank:4.5,symbol:'S',label:'School'},
  park:{minZoom:15,rank:4.5,symbol:'◇',label:'Park'},
  civic:{minZoom:15,rank:4.5,symbol:'C',label:'Civic facility'}
});
