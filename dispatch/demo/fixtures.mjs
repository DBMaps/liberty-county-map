// Synthetic, read-only browser fixtures. Served ONLY by the explicit loopback demo server.
export const organization = 'City of Dayton';
export const units = [
  {id:'police', name:'Dayton Police Department', member:true},
  {id:'fire', name:'Dayton Fire Department', member:false},
  {id:'ems', name:'Dayton EMS', member:false},
  {id:'works', name:'Dayton Public Works', member:true}
];
// Separate synthetic memberships; municipal membership never implies unit access.
export const memberships = ['police','works'];
export const records = [
  {id:'DEMO-001',title:'Flooded Roadway',location:'FM 1960 near Winfree Street',severity:'High',unit:'police',status:'Active',review:'Reviewed',source:'Agency-created',updated:'4 min ago',revision:3,created:'08:12',revised:'08:26',description:'Visual scenario: standing water affects the roadway near the intersection. This synthetic report illustrates an agency-created roadway condition.',timeline:[['08:12','Demo report created'],['08:24','Details revised · revision 3'],['08:26','Review recorded in fixture · internal only']]},
  {id:'DEMO-002',title:'Rail Crossing Blocked',location:'Main Street crossing',severity:'Moderate',unit:'police',status:'Active',review:'Needs review',source:'Community report',updated:'12 min ago',revision:2,created:'08:02',revised:'08:18',description:'Visual scenario: a blocked crossing has been reported on Main Street. The report is awaiting authorized review; the condition has not been independently verified.',timeline:[['08:02','Synthetic community report received'],['08:18','Location revised · revision 2'],['08:18','Awaiting authorized review']]},
  {id:'DEMO-003',title:'Signal Outage',location:'SH 146 at US 90',severity:'Moderate',unit:'works',status:'Monitoring',review:'Reviewed',source:'Agency-created',updated:'8 min ago',revision:1,created:'07:45',revised:'08:22',description:'Visual scenario: a traffic signal outage is being monitored by Public Works. No live field activity is represented.',timeline:[['07:45','Demo report created'],['08:22','Status changed to monitoring'],['08:22','Review recorded in fixture · internal only']]},
  {id:'DEMO-004',title:'Roadway Debris',location:'US 90 eastbound',severity:'Low',unit:'works',status:'Resolved',review:'Reviewed',source:'Community report',updated:'25 min ago',revision:2,created:'07:20',revised:'08:05',description:'Visual scenario: a roadway debris report has been marked resolved. This is a synthetic example of the report lifecycle.',timeline:[['07:20','Synthetic community report received'],['07:52','Review recorded in fixture'],['08:05','Status changed to resolved']]}
].map(item => Object.freeze({...item, mapCategory:({'DEMO-001':'flooding','DEMO-002':'rail_blockage_delay','DEMO-003':'signal_outage','DEMO-004':'debris'})[item.id], coordinates:({'DEMO-001':[30.0467,-94.8864],'DEMO-002':[30.0444,-94.8875],'DEMO-003':[30.0420,-94.8934],'DEMO-004':[30.0498,-94.8798]})[item.id], coordinateNote:'Approximate synthetic location; not a verified incident position', unitName:units.find(unit=>unit.id===item.unit).name}));
export function unitRecords(unit) { return memberships.includes(unit) ? records.filter(record=>record.unit===unit) : []; }
