/** ServiceHub Admin backend — standalone Apps Script project.
 * Bound to the ServiceHub spreadsheet by SPREADSHEET_ID below.
 * Deploy as Web app: Execute as Me; access: Anyone (the code gates sensitive data).
 */
const SPREADSHEET_ID = '1F7QIvE3SH-0eifmNrDp9zIDkMMd-eWm1odNjIMsoCrU';
const IDLE_MINUTES = 5;
const SESSION_HOURS = 12;
const MIN_AGE = 12;
const TAB = {
  admins: ['Admins', 'Admin', 'Admin info', 'Admin Info'],
  access: ['Access code', 'Access Code'],
  listings: ['Listings', 'Listing'],
  links: ['Manage Links (Private)', 'Manage Links', 'Manage Links (private)'],
  payments: ['Payments', 'Payment'],
  audit: ['AdminLog', 'Admin Log']
};
const ADMIN_FIELDS = [
  'First Name','Middle Name','Last Name','Date of Birth','Age','Gender','Email','Phone','Country','State and City',
  'Guardian Name','Guardian Relationship','Guardian Phone','Guardian Consent','Education','Currently in School','School or Field',
  'Occupation','Languages','Skills','Experience','Experience Details','Hours per Week','Preferred Time','Device','Heard From',
  'Why Admin','Referral','Username','Password Salt','Password Hash','Status','Role','Applied At','Reviewed At','Reviewed By','Last Login At'
];

function doGet() { return json_({ok:true,data:{service:'ServiceHub Admin API',version:1}}); }
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '').replace(/^admin_/, '');
    const data = route_(action, body);
    return json_({ok:true,data:data});
  } catch (err) {
    return json_({ok:false,code:err.code || 'ERROR',message:err.message || 'Something went wrong.'});
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail_(code,msg) { const e = new Error(msg || code); e.code=code; throw e; }
function ss_(){ return SpreadsheetApp.openById(SPREADSHEET_ID); }
function norm_(v){ return String(v == null ? '' : v).trim().toLowerCase().replace(/[^a-z0-9]/g,''); }
function tab_(key, createName) {
  const book=ss_(), names=TAB[key]||[];
  for (const n of names) { const sh=book.getSheetByName(n); if(sh) return sh; }
  if (!createName) return null;
  const sh=book.insertSheet(createName || names[0]);
  return sh;
}
function headerInfo_(sh) {
  if (!sh) return {headers:[],map:{}};
  const last=Math.max(1,sh.getLastColumn());
  let headers=sh.getRange(1,1,1,last).getDisplayValues()[0].map(x=>String(x||'').trim());
  if (!headers.some(Boolean)) { headers=[]; }
  const map={}; headers.forEach((h,i)=>{ if(h) map[norm_(h)]=i+1; });
  return {headers,map};
}
function ensureHeaders_(sh, required) {
  let hi=headerInfo_(sh), changed=false;
  required.forEach(h=>{ if(!hi.map[norm_(h)]) { hi.headers.push(h); changed=true; } });
  if(changed){ sh.getRange(1,1,1,hi.headers.length).setValues([hi.headers]); sh.setFrozenRows(1); hi=headerInfo_(sh); }
  return hi;
}
function col_(hi, aliases, fallback) {
  for (const a of aliases) { const c=hi.map[norm_(a)]; if(c) return c; }
  return fallback || 0;
}
function records_(sh) {
  if(!sh || sh.getLastRow()<2) return [];
  const hi=headerInfo_(sh), vals=sh.getRange(2,1,sh.getLastRow()-1,Math.max(1,sh.getLastColumn())).getValues();
  return vals.map((row,i)=>{const o={_row:i+2}; hi.headers.forEach((h,j)=>{if(h)o[h]=row[j];}); return o;});
}
function pick_(obj, aliases) { const keys=Object.keys(obj||{}); for(const a of aliases){const found=keys.find(k=>norm_(k)===norm_(a)); if(found)return obj[found];} return ''; }
function asMs_(v){ if(v instanceof Date)return v.getTime(); if(typeof v==='number')return v; const d=new Date(v); return isNaN(d.getTime())?null:d.getTime(); }
function dateCell_(v){ if(v===null||v===undefined||v==='')return ''; const n=Number(v); return isFinite(n)&&n>100000000000?new Date(n):v; }
function setByAliases_(sh, row, aliases, value, requiredHeader) {
  let hi=headerInfo_(sh), c=col_(hi,aliases);
  if(!c && requiredHeader){hi=ensureHeaders_(sh,[requiredHeader]);c=col_(hi,[requiredHeader]);}
  if(c)sh.getRange(row,c).setValue(value);
}
function adminSheet_(){ const sh=tab_('admins','Admins'); ensureHeaders_(sh,ADMIN_FIELDS); return sh; }
function adminRows_(){ const sh=adminSheet_(); return records_(sh).map(r=>adminObj_(r)); }
function adminObj_(r){
  const o={};
  const pairs={firstName:['First Name','FirstName'],middleName:['Middle Name','MiddleName'],lastName:['Last Name','LastName'],dob:['Date of Birth','DOB'],age:['Age'],gender:['Gender'],email:['Email'],phone:['Phone','Phone or WhatsApp'],country:['Country'],location:['State and City','Location'],guardianName:['Guardian Name'],guardianRelation:['Guardian Relationship','Guardian Relation'],guardianPhone:['Guardian Phone'],guardianOk:['Guardian Consent','Guardian OK'],education:['Education'],inSchool:['Currently in School','In School'],school:['School or Field','School'],occupation:['Occupation','What do you do now'],languages:['Languages'],skills:['Skills'],experience:['Experience'],experienceDetails:['Experience Details'],hours:['Hours per Week','Hours'],timeOfDay:['Preferred Time','Time of Day'],device:['Device'],heardFrom:['Heard From'],why:['Why Admin','Why'],referral:['Referral'],username:['Username','Admin Name'],status:['Status'],role:['Role'],appliedAt:['Applied At'],reviewedAt:['Reviewed At'],reviewedBy:['Reviewed By']};
  Object.keys(pairs).forEach(k=>o[k]=pick_(r,pairs[k]));
  o.age=o.age===''?null:Number(o.age); if(!isFinite(o.age))o.age=null;
  o.guardianOk=String(o.guardianOk).toLowerCase()==='true'||String(o.guardianOk).toLowerCase()==='yes';
  o.appliedAt=asMs_(o.appliedAt);o.reviewedAt=asMs_(o.reviewedAt);
  return o;
}
function adminRowByUsername_(username){ const sh=adminSheet_(), hi=headerInfo_(sh), c=col_(hi,['Username','Admin Name']); if(!c || sh.getLastRow()<2)return null; const target=norm_(username); if(!target)return null; const vals=sh.getRange(2,c,sh.getLastRow()-1,1).getDisplayValues(); for(let i=0;i<vals.length;i++)if(norm_(vals[i][0])===target)return {sh:sh,row:i+2,hi:hi}; return null; }
function salt_(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');}
function hash_(password,salt){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(salt)+'|'+String(password),Utilities.Charset.UTF_8);return bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function constantEq_(a,b){a=String(a);b=String(b);if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
function createSession_(username, displayName, role){const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');const now=Date.now();const s={username:username,displayName:displayName,role:role,created:now,last:now,exp:now+SESSION_HOURS*3600000};CacheService.getScriptCache().put('sess_'+token,JSON.stringify(s),21600);return {token:token,user:{username:username,displayName:displayName,role:role}};}
function session_(body){const token=String(body.token||'');if(!token)fail_('AUTH','Sign in again.');const cache=CacheService.getScriptCache(),raw=cache.get('sess_'+token);if(!raw)fail_('AUTH','Your session has ended. Sign in again.');const s=JSON.parse(raw),now=Date.now();if(now>s.exp||now-s.last>IDLE_MINUTES*60000){cache.remove('sess_'+token);fail_('AUTH','Your session has ended. Sign in again.');}s.last=now;cache.put('sess_'+token,JSON.stringify(s),21600);return s;}
function approvedAdmin_(username){const found=adminRowByUsername_(username);if(!found)return null;const row=records_(found.sh).find(r=>r._row===found.row);const status=String(pick_(row,['Status'])||'pending').toLowerCase();return {found:found,row:row,status:status,username:String(pick_(row,['Username','Admin Name'])||'')};}
function requireSession_(body){const s=session_(body);const a=approvedAdmin_(s.username);if(!a||a.status!=='approved')fail_('AUTH','This admin account is no longer approved.');return s;}
function verifyPassword_(body){const s=requireSession_(body);const supplied=String(body.username||'');if(!supplied||norm_(supplied)!==norm_(s.username))fail_('BAD_PASSWORD','Access denied. The remembered admin username does not match this session.');const found=adminRowByUsername_(s.username);if(!found)fail_('BAD_PASSWORD','Access denied.');const row=records_(found.sh).find(r=>r._row===found.row);const salt=pick_(row,['Password Salt']),expected=pick_(row,['Password Hash']);if(!salt||!expected||!constantEq_(hash_(String(body.password||''),salt),expected))fail_('BAD_PASSWORD','Access denied. The password is incorrect for the signed-in admin.');return s;}
function requireAccessCode_(code){const cache=CacheService.getScriptCache(),key='access_try_'+(Session.getTemporaryActiveUserKey()||'anonymous');const count=Number(cache.get(key)||0);if(count>=5)fail_('LOCKED','Too many incorrect access codes. Try again in a minute.');const sh=tab_('access',null);if(!sh)fail_('BAD_CODE','The Access code sheet does not exist yet.');const vals=sh.getRange(1,1,Math.max(1,sh.getLastRow()),1).getDisplayValues().flat().map(x=>String(x||'').trim()).filter(x=>x&&!['access code','code','accesscode'].includes(norm_(x)));const valid=vals.some(v=>constantEq_(v,String(code||'').trim()));if(!valid){cache.put(key,String(count+1),60);audit_('', 'ACCESS_CODE_DENIED','', 'Incorrect access code attempt');fail_('BAD_CODE','Access denied. The access code is incorrect.');}cache.remove(key);audit_('', 'ACCESS_CODE_CONFIRMED','', 'Admin directory access code accepted');}
function audit_(who,action,id,detail){try{const sh=tab_('audit','AdminLog');ensureHeaders_(sh,['Timestamp','Username','Action','Listing ID','Details']);sh.appendRow([new Date(),who||'',action||'',id||'',detail||'']);}catch(e){}}
function route_(a,b){switch(a){
 case 'login':return login_(b);
 case 'apply':return apply_(b);
 case 'info':case 'pendingAdmins':requireAccessCode_(b.code);return adminRows_().filter(x=>String(x.status||'pending').toLowerCase()!=='');
 case 'listings':return listListings_(b);
 case 'get':return getListing_(b);
 case 'search':return searchListing_(b);
 case 'getLink':return getLink_(b);
 case 'update':return updateListing_(b);
 case 'setStatus':return setStatus_(b);
 case 'writePayment':return writePayment_(b);
 case 'regenerateLink':return regenerateLink_(b);
 case 'extend':return extend_(b);
 case 'logout':if(b.token)CacheService.getScriptCache().remove('sess_'+b.token);return {loggedOut:true};
 default:fail_('NOT_FOUND','Unknown API action: '+a);
}}
function login_(b){const username=String(b.username||'').trim(),password=String(b.password||'');if(!username||!password)fail_('INVALID','Enter your admin name and password.');const f=adminRowByUsername_(username);if(!f)fail_('INVALID','Name or password is incorrect.');const row=records_(f.sh).find(r=>r._row===f.row);const status=String(pick_(row,['Status'])||'pending').toLowerCase();const salt=pick_(row,['Password Salt']),expected=pick_(row,['Password Hash']);if(!salt||!expected||!constantEq_(hash_(password,salt),expected))fail_('INVALID','Name or password is incorrect.');if(status!=='approved')fail_('PENDING','Your application is not approved yet.');const hi=headerInfo_(f.sh);setByAliases_(f.sh,f.row,['Last Login At'],new Date(),'Last Login At');const full=[pick_(row,['First Name']),pick_(row,['Middle Name']),pick_(row,['Last Name'])].filter(Boolean).join(' ')||username;const sess=createSession_(username,full,pick_(row,['Role'])||'admin');audit_(username,'LOGIN','','Signed in');return sess;}
function apply_(b){const f=b||{},username=String(f.username||'').trim();if(username.length<2||username.length>40)fail_('INVALID','Choose a username between 2 and 40 characters.');if(!f.password||String(f.password).length<8||!/[A-Za-z]/.test(f.password)||!/[0-9]/.test(f.password))fail_('INVALID','Password must be at least 8 characters with a letter and a number.');if(String(f.password)!==String(f.confirm||''))fail_('INVALID','Passwords do not match.');const age=Number(f.age);if(!isFinite(age)||age<MIN_AGE)fail_('INVALID','You do not meet the minimum age requirement.');const required=['firstName','middleName','lastName','dob','gender','email','phone','country','location','education','inSchool','school','occupation','languages','skills','experience','experienceDetails','hours','timeOfDay','device','heardFrom','why','referral'];for(const k of required){if(String(f[k]||'').trim()==='')fail_('INVALID','Every application field is required. Missing: '+k+'.');}const under=age<18;if(under&&(!f.guardianName||!f.guardianRelation||!f.guardianPhone||!(f.guardianOk===true||String(f.guardianOk)==='on'||String(f.guardianOk)==='true')))fail_('INVALID','Parent or guardian details and consent are required for applicants under 18.');const sh=adminSheet_();if(adminRowByUsername_(username))fail_('TAKEN','That admin name is already taken. Choose another.');const salt=salt_(),hash=hash_(f.password,salt);const hi=headerInfo_(sh);const row=Array(hi.headers.length).fill('');const vals={
 'First Name':f.firstName,'Middle Name':f.middleName,'Last Name':f.lastName,'Date of Birth':dateCell_(f.dob),'Age':age,'Gender':f.gender,'Email':f.email,'Phone':f.phone,'Country':f.country,'State and City':f.location,
 'Guardian Name':f.guardianName,'Guardian Relationship':f.guardianRelation,'Guardian Phone':f.guardianPhone,'Guardian Consent':under?'Yes':(f.guardianOk?'Yes':'No'),'Education':f.education,'Currently in School':f.inSchool,'School or Field':f.school,'Occupation':f.occupation,'Languages':f.languages,'Skills':f.skills,'Experience':f.experience,'Experience Details':f.experienceDetails,'Hours per Week':f.hours,'Preferred Time':f.timeOfDay,'Device':f.device,'Heard From':f.heardFrom,'Why Admin':f.why,'Referral':f.referral,'Username':username,'Password Salt':salt,'Password Hash':hash,'Status':'pending','Role':'admin','Applied At':new Date(),'Reviewed At':'','Reviewed By':'','Last Login At':''};
 hi.headers.forEach((h,i)=>{const key=Object.keys(vals).find(k=>norm_(k)===norm_(h));if(key)row[i]=vals[key]===undefined?'':vals[key];});sh.appendRow(row);audit_(username,'ADMIN_APPLICATION','','Application submitted');return {submitted:true,status:'pending'};}
function listingSheet_(){const sh=tab_('listings','Listings');ensureHeaders_(sh,['Listing ID','Service Name','Status','Type','Category','Description','Location','Company','Contact','Phone','WhatsApp','Email','About','Portfolio','Pricing','Custom Pricing','Currency','Payment Code','Created At','Expires At','Status Note']);return sh;}
function linkSheet_(){const sh=tab_('links','Manage Links (Private)');ensureHeaders_(sh,['Listing ID','Manage Link','Created At']);return sh;}
function listingRows_(){const sh=listingSheet_(),hi=headerInfo_(sh);return records_(sh).map(r=>listingObj_(r,hi));}
function listingObj_(r,hi){const get=aliases=>pick_(r,aliases);const id=String(get(['Listing ID','ID','Service ID'])||'');const l={id:id,title:String(get(['Service Name','Title','Listing Title','Name'])||''),type:String(get(['Type','Listing Type'])||'service'),category:String(get(['Category','Service Category'])||''),status:String(get(['Status','Listing Status'])||'pending'),description:String(get(['Description','About','Details'])||''),location:String(get(['Location','State and City'])||''),ownerName:String(get(['Company','Company Name','Provider Name','Owner Name','Business Name'])||''),phone:String(get(['Phone','Contact Phone'])||''),whatsapp:String(get(['WhatsApp','Whatsapp'])||''),email:String(get(['Email','Contact Email'])||''),pricing:String(get(['Pricing','Price'])||''),customPricing:String(get(['Custom Pricing','Custom Price'])||''),paymentCode:String(get(['Payment Code','Listing Code'])||''),createdAt:asMs_(get(['Created At','Date Created','Listed At'])),expiresAt:asMs_(get(['Expires At','Expiry Date','Subscription Expiry'])),statusNote:String(get(['Status Note','Admin Note'])||'')};const pay=paymentFor_(id,l.paymentCode);if(pay)l.payment=pay;const link=manageLinkFor_(id);l.hasLink=!!link;delete l.manageLink;return l;}
function manageLinkFor_(id){const sh=linkSheet_(),hi=headerInfo_(sh),cId=col_(hi,['Listing ID','ID']),cLink=col_(hi,['Manage Link','Link','Management Link']);if(!cId||!cLink)return '';const vals=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues():[];for(let i=vals.length-1;i>=0;i--)if(String(vals[i][cId-1])===String(id))return String(vals[i][cLink-1]||'');return '';}
function writeLink_(id,link){const sh=linkSheet_(),hi=ensureHeaders_(sh,['Listing ID','Manage Link','Created At']),cId=col_(hi,['Listing ID','ID']),cLink=col_(hi,['Manage Link','Link','Management Link']),cDate=col_(hi,['Created At','Date Created']);let row=0;for(let r=2;r<=sh.getLastRow();r++)if(String(sh.getRange(r,cId).getDisplayValue())===String(id)){row=r;break;}if(!row)row=sh.getLastRow()+1;sh.getRange(row,cId).setValue(id);sh.getRange(row,cLink).setValue(link);if(cDate)sh.getRange(row,cDate).setValue(new Date());}
function paymentFor_(id,code){const sh=tab_('payments',null);if(!sh)return null;const hi=headerInfo_(sh),vals=records_(sh);const r=vals.reverse().find(x=>String(pick_(x,['Listing ID','ID'])||'')===String(id)|| (code&&String(pick_(x,['Payment Code'])||'')===String(code)));if(!r)return null;return {txId:String(pick_(r,['Transaction ID','TX ID','Reference'])||''),amount:Number(pick_(r,['Amount','Price'])||0),currency:String(pick_(r,['Currency'])||'NGN'),method:String(pick_(r,['Payment Method','Method','Source'])||''),paidAt:asMs_(pick_(r,['Processed At','Paid At','Created At'])),updatedAt:asMs_(pick_(r,['Updated At'])),source:String(pick_(r,['Source'])||''),approvedBy:String(pick_(r,['Approved By'])||''),note:String(pick_(r,['Note','Rejection Reason'])||'')};}
function publicListing_(l){const o=Object.assign({},l);delete o.manageLink;return o;}
function listListings_(b){requireSession_(b);return listingRows_().map(l=>({id:l.id,title:l.title,type:l.type,category:l.category,status:l.status,ownerName:l.ownerName,createdAt:l.createdAt,expiresAt:l.expiresAt,hasPayment:!!l.payment}));}
function findListing_(id){const sh=listingSheet_(),hi=headerInfo_(sh),c=col_(hi,['Listing ID','ID','Service ID']);if(!c)fail_('NOT_FOUND','Listing ID column was not found.');for(let r=2;r<=sh.getLastRow();r++)if(String(sh.getRange(r,c).getDisplayValue()).trim()===String(id).trim()){const obj=records_(sh).find(x=>x._row===r);return {sh:sh,row:r,hi:hi,obj:listingObj_(obj,hi)};}fail_('NOT_FOUND','No listing matches that ID or link.');}
function getListing_(b){requireSession_(b);return publicListing_(findListing_(b.id).obj);}
function searchListing_(b){requireSession_(b);const q=String(b.q||'').trim();if(!q)fail_('NOT_FOUND','Enter a listing ID, payment code or manage link.');const rows=listingRows_();let hit=rows.find(l=>norm_(l.id)===norm_(q)||norm_(l.paymentCode)===norm_(q));if(!hit){const links=linkSheet_(),hi=headerInfo_(links),cId=col_(hi,['Listing ID','ID']),cLink=col_(hi,['Manage Link','Link','Management Link']);if(cId&&cLink){for(let r=2;r<=links.getLastRow();r++){const link=String(links.getRange(r,cLink).getDisplayValue()||'');if(link&&link===q){hit=rows.find(x=>String(x.id)===String(links.getRange(r,cId).getDisplayValue()));break;}}}}if(!hit)fail_('NOT_FOUND','No listing matches that ID or link.');return {id:hit.id};}
function getLink_(b){const s=verifyPassword_(b),found=findListing_(b.id),link=manageLinkFor_(b.id);if(!link)fail_('NOT_FOUND','This listing has no manage link yet.');audit_(s.username,'COPY_MANAGE_LINK',b.id,'Manage link released after password confirmation');return {manageLink:link};}
function updateListing_(b){const s=verifyPassword_(b),f=findListing_(b.id),changes=b.changes||{},allowed={title:['Service Name','Title','Listing Title'],'type':['Type','Listing Type'],'category':['Category','Service Category'],'description':['Description','About','Details'],'location':['Location','State and City'],'ownerName':['Company','Company Name','Provider Name','Owner Name','Business Name'],'phone':['Phone','Contact Phone'],'whatsapp':['WhatsApp','Whatsapp'],'email':['Email','Contact Email'],'pricing':['Pricing','Price'],'customPricing':['Custom Pricing','Custom Price']};const before=JSON.stringify(f.obj);Object.keys(allowed).forEach(k=>{if(Object.prototype.hasOwnProperty.call(changes,k))setByAliases_(f.sh,f.row,allowed[k],String(changes[k]),allowed[k][0]);});audit_(s.username,'UPDATE_LISTING',b.id,'Before '+before+'; changes '+JSON.stringify(changes));return publicListing_(findListing_(b.id).obj);}
function setStatus_(b){const s=verifyPassword_(b),f=findListing_(b.id),status=String(b.status||'').toLowerCase();if(!['approved','disapproved','pending','hidden'].includes(status))fail_('INVALID','Unsupported listing status.');setByAliases_(f.sh,f.row,['Status','Listing Status'],status,'Status');setByAliases_(f.sh,f.row,['Status Note','Admin Note'],String(b.note||''),'Status Note');audit_(s.username,'SET_STATUS',b.id,status+'; '+String(b.note||''));return publicListing_(findListing_(b.id).obj);}
function ensurePaymentHeaders_(sh){return ensureHeaders_(sh,['Transaction ID','Listing ID','Payment Code','Amount','Currency','Provider Reference','Payment Status','Rejection Reason','Processed At','Updated At','Source','Approved By','Note']);}
function writePayment_(b){const s=verifyPassword_(b),f=findListing_(b.id),amount=Number(b.amount);if(!isFinite(amount)||amount<0)fail_('INVALID','Enter an amount of zero or more.');const sh=tab_('payments','Payments'),hi=ensurePaymentHeaders_(sh),idc=col_(hi,['Listing ID','ID']),codec=col_(hi,['Payment Code']);let found=0;for(let r=2;r<=sh.getLastRow();r++){const sameId=idc&&String(sh.getRange(r,idc).getDisplayValue())===String(b.id);const sameCode=codec&&f.obj.paymentCode&&String(sh.getRange(r,codec).getDisplayValue())===String(f.obj.paymentCode);if(sameId||sameCode){found=r;break;}}const now=new Date();if(found){setByAliases_(sh,found,['Updated At'],now,'Updated At');}else{const tx='ADMIN-MANUAL-'+Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();const vals={'Transaction ID':tx,'Listing ID':b.id,'Payment Code':f.obj.paymentCode,'Amount':amount,'Currency':String(b.currency||'NGN'),'Provider Reference':'','Payment Status':'approved','Rejection Reason':'','Processed At':now,'Updated At':'','Source':'ADMIN','Approved By':s.username,'Note':String(b.note||'')};const row=Array(hi.headers.length).fill('');hi.headers.forEach((h,i)=>{const k=Object.keys(vals).find(x=>norm_(x)===norm_(h));if(k)row[i]=vals[k];});sh.appendRow(row);}setByAliases_(f.sh,f.row,['Status','Listing Status'],'approved','Status');setByAliases_(f.sh,f.row,['Status Note','Admin Note'],'','Status Note');const link=manageLinkFor_(b.id);if(!link)writeLink_(b.id,'https://solacediamond.github.io/Servicehub/manage.html#k='+Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'').slice(0,8));audit_(s.username,'WRITE_PAYMENT',b.id,'Manual payment record');return publicListing_(findListing_(b.id).obj);}
function regenerateLink_(b){const s=verifyPassword_(b),f=findListing_(b.id),link='https://solacediamond.github.io/Servicehub/manage.html#k='+Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'').slice(0,8);writeLink_(b.id,link);audit_(s.username,'REGENERATE_LINK',b.id,'New private manage link generated');return publicListing_(findListing_(b.id).obj);}
function extend_(b){const s=verifyPassword_(b),f=findListing_(b.id),months=Math.max(1,Math.min(24,Number(b.months)||6)),hi=f.hi;let c=col_(hi,['Expires At','Expiry Date','Subscription Expiry']);if(!c){ensureHeaders_(f.sh,['Expires At']);c=col_(headerInfo_(f.sh),['Expires At']);}const current=asMs_(f.sh.getRange(f.row,c).getValue())||0;const next=Math.max(Date.now(),current)+months*30*86400000;f.sh.getRange(f.row,c).setValue(new Date(next));if(String(f.obj.status).toLowerCase()==='expired')setByAliases_(f.sh,f.row,['Status','Listing Status'],'approved','Status');audit_(s.username,'EXTEND_SUBSCRIPTION',b.id,months+' months');return publicListing_(findListing_(b.id).obj);}
