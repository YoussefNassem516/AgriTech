/* Field Shift — core: state, constants, data fetchers (Open-Meteo, NASA POWER, OpenStreetMap), farm form, navigation.
   Vanilla JS, no keys, no backend. Other modules (smart.js, farmmap.js, chat.js) read window.FS and listen to FS.on("update"). */
(function(){
"use strict";
var $=function(i){return document.getElementById(i)};
var FS=window.FS=window.FS||{};var T=FS.T||function(a){return a};
FS.$=$;

/* ---------- small helpers ---------- */
FS.nz=function(x){return x==null||isNaN(x)?0:x};
FS.sum=function(a){return a.reduce(function(s,x){return s+x},0)};
FS.esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
FS.f0=function(x){return x==null||isNaN(x)?"—":(+x).toFixed(0)};
FS.f1=function(x){return x==null||isNaN(x)?"—":(+x).toFixed(1)};
/* number + unit, always rendered left-to-right so digits never get scrambled in RTL text */
FS.N=function(v,unit,d){var t=v==null||isNaN(v)?"—":(+v).toFixed(d==null?0:d);return'<span class="num">'+t+'</span>'+(unit?'<small> '+unit+'</small>':'')};
var BD={api:[T("بيانات API","Live data"),"b-api"],fc:[T("توقع","Forecast"),"b-fc"],calc:[T("محسوب","Calculated"),"b-calc"],est:[T("تقدير","Estimate"),"b-est"],na:[T("غير متاح","N/A"),"b-na"]};
FS.bd=function(t,title){var b=BD[t];return b?'<span class="badge '+b[1]+'"'+(title?' title="'+FS.esc(title)+'"':'')+'>'+b[0]+'</span>':''};
FS.toast=function(m){var t=$("toast");t.textContent=m;t.style.display="block";clearTimeout(FS._tt);FS._tt=setTimeout(function(){t.style.display="none"},4500)};
FS.icon=function(n){return'<svg><use href="#i-'+n+'"/></svg>'};
var hs={};FS.on=function(e,f){(hs[e]=hs[e]||[]).push(f)};
var pend={};FS.emit=function(e){if(pend[e])return;pend[e]=1;(window.requestAnimationFrame||setTimeout)(function(){pend[e]=0;(hs[e]||[]).forEach(function(f){try{f()}catch(x){console.error("[FS]",e,x)}})})};

/* ---------- agronomy constants ---------- */
/* Kc = FAO-56 table 12 values (initial / mid / end), rounded. Ky = FAO-33 whole-season yield response factor (approx.). */
FS.CROPS={
 potato:{n:"بطاطس",kc:[.5,1.15,.75],ky:1.1,rot:["potato","bean","wheat"],alt:["potato","wheat"]},
 wheat:{n:"قمح",kc:[.3,1.15,.3],ky:1.15,rot:["wheat","clover","corn"],alt:["wheat","corn"]},
 tomato:{n:"طماطم",kc:[.6,1.15,.8],ky:1.05,rot:["tomato","bean","wheat"],alt:["tomato","corn"]},
 corn:{n:"ذرة",kc:[.3,1.2,.6],ky:1.25,rot:["corn","bean","wheat"],alt:["corn","wheat"]},
 bean:{n:"فول",kc:[.5,1.15,.3],ky:1.15,rot:["bean","wheat","corn"],alt:["bean","wheat"]},
 clover:{n:"برسيم",kc:[.4,1.05,.9],ky:1.1,rot:["clover","corn","wheat"],alt:["clover","corn"]}
};
FS.STAGES={ini:"بداية النمو (إنبات / شتلات صغيرة)",dev:"نمو خضري",mid:"منتصف الموسم (إزهار / تكوين الثمار)",late:"نهاية الموسم (نضج)",unk:"مش عارف"};
FS.SOILS={sand:{n:"رملية",raw:20},loam:{n:"طميية",raw:35},clay:{n:"طينية",raw:45},unk:{n:"مش عارف (هنفترض طميية)",raw:35}};
FS.METHODS={flood:{n:"غمر / ري سطحي",eff:.6,cnt:1,depth:70},sprinkler:{n:"رش",eff:.75,cnt:2,depth:35},drip:{n:"تنقيط",eff:.9,cnt:3,depth:16}};
FS.kcOf=function(crop,stage){var k=FS.CROPS[crop].kc;return stage=="ini"?k[0]:stage=="dev"?(k[0]+k[1])/2:stage=="late"?k[2]:k[1]};
var CN=function(k){return FS.CROPS[k].n};FS.cn=CN;
var WC=[[0,"صافي"],[2,"غائم جزئيًا"],[3,"غائم"],[48,"ضباب"],[57,"رذاذ"],[67,"مطر"],[77,"ثلج"],[82,"زخات مطر"],[86,"زخات ثلج"],[99,"عواصف رعدية"]];
FS.wcode=function(c){if(c==null)return"—";for(var i=0;i<WC.length;i++)if(c<=WC[i][0])return WC[i][1];return"—"};
if(FS.lang==="en"){
 var CEN={potato:"Potato",wheat:"Wheat",tomato:"Tomato",corn:"Corn",bean:"Fava bean",clover:"Clover (berseem)"};
 Object.keys(CEN).forEach(function(k){FS.CROPS[k].n=CEN[k]});
 FS.STAGES={ini:"Initial (germination / young seedlings)",dev:"Vegetative growth",mid:"Mid-season (flowering / fruiting)",late:"Late season (ripening)",unk:"Not sure"};
 FS.SOILS.sand.n="Sandy";FS.SOILS.loam.n="Loam";FS.SOILS.clay.n="Clay";FS.SOILS.unk.n="Not sure (assume loam)";
 FS.METHODS.flood.n="Flood / surface";FS.METHODS.sprinkler.n="Sprinkler";FS.METHODS.drip.n="Drip";
 WC=[[0,"Clear"],[2,"Partly cloudy"],[3,"Cloudy"],[48,"Fog"],[57,"Drizzle"],[67,"Rain"],[77,"Snow"],[82,"Rain showers"],[86,"Snow showers"],[99,"Thunderstorms"]];
}
/* short label without the bracketed explanation, e.g. "Flood / surface" -> "Flood" */
FS.short=function(t){return String(t).split(/\s*[(\/]/)[0].trim()};

/* ---------- farm state (persisted in localStorage when available) ---------- */
var KEY="fs_farm_v2";
var DEF={lat:null,lng:null,name:"",crop:"wheat",stage:"unk",soil:"unk",method:"flood",areaFed:null,fieldFed:null,poly:null,cnt:1,depth:70,price:null,cu:false,last:"unk"};
FS.LAST={unk:T("مش فاكر","Don't remember"),0:T("النهارده","Today"),1:T("من يوم","1 day ago"),2:T("من يومين","2 days ago"),3:T("من 3 أيام","3 days ago"),4:T("من 4 أيام","4 days ago"),5:T("من 5 أيام","5 days ago"),6:T("من 6 أيام","6 days ago"),7:T("من أسبوع أو أكتر","A week or more")};
var farm=Object.assign({},DEF);
try{var sv=JSON.parse(localStorage.getItem(KEY)||"null");if(sv&&typeof sv=="object")farm=Object.assign(farm,sv)}catch(e){}
FS.farm=function(){return farm};
FS.hasFarm=function(){return farm.lat!=null&&farm.lng!=null};
FS.data={om:{st:"idle"},nasa:{st:"idle"},fields:{st:"idle",list:[]}};
FS.area=function(){var a=farm.areaFed>0?farm.areaFed:farm.fieldFed>0?farm.fieldFed:1;
 return{fed:a,ha:a*.42,m2:a*4200,src:farm.areaFed>0?"user":farm.fieldFed>0?"osm":"default"}};
function save(){try{localStorage.setItem(KEY,JSON.stringify(farm))}catch(e){}}
FS.setFarm=function(p,o){
 var moved=p.lat!=null&&(p.lat!==farm.lat||p.lng!==farm.lng);
 Object.assign(farm,p);
 if(moved){farm.poly=null;farm.fieldFed=null}
 save();
 if(moved||(o&&o.refetch))FS.refresh();
 FS.emit("update");syncForm(moved)
};

/* ---------- data fetchers ---------- */
async function jget(url,ms){
 var ac=new AbortController(),to=setTimeout(function(){ac.abort()},ms||15000);
 try{var r=await fetch(url,{signal:ac.signal});if(!r.ok)throw new Error("http "+r.status);return await r.json()}finally{clearTimeout(to)}
}
/* Open-Meteo forecast: current + daily (7 past + 7 forecast days) incl. FAO-56 ET0 */
FS.getOM=async function(lat,lng){
 var u="https://api.open-meteo.com/v1/forecast?latitude="+lat.toFixed(4)+"&longitude="+lng.toFixed(4)+
  "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"+
  "&hourly=soil_moisture_3_to_9cm"+
  "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration,wind_speed_10m_max,weather_code"+
  "&past_days=7&forecast_days=7&timezone=auto",o=null;
 for(var t=0;t<2&&!o;t++){try{o=await jget(u,15000)}catch(e){}}
 if(!o||!o.daily||!o.daily.time||!o.daily.et0_fao_evapotranspiration)return{st:"err"};
 var d=o.daily,ct=(o.current&&o.current.time)||"",i0=d.time.indexOf(ct.slice(0,10));if(i0<0)i0=Math.min(7,d.time.length-1);
 var sm=null;
 if(o.hourly&&o.hourly.soil_moisture_3_to_9cm){var hi=o.hourly.time.indexOf(ct.slice(0,13)+":00");if(hi>=0)sm=o.hourly.soil_moisture_3_to_9cm[hi]}
 return{st:"ok",cur:o.current||{},d:d,i0:i0,sm:sm,tz:o.timezone,ts:Date.now()}
};
/* NASA POWER: last 30 days vs same period in the last 5 years (historical climate, ~3 day latency) */
FS.getNASA=async function(lat,lng){
 var fmtD=function(d){return d.toISOString().slice(0,10).replace(/-/g,"")};
 var end=new Date();end.setDate(end.getDate()-3);var st=new Date(end);st.setDate(st.getDate()-29);
 var sh=function(d,y){var x=new Date(d);x.setFullYear(x.getFullYear()-y);return fmtD(x)};
 var base="https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,PRECTOTCORR,GWETROOT&community=AG&format=JSON&latitude="+lat.toFixed(4)+"&longitude="+lng.toFixed(4),p=null;
 try{p=(await jget(base+"&start="+sh(st,5)+"&end="+fmtD(end),25000)).properties.parameter}catch(e){}
 if(!p){try{p=(await jget(base+"&start="+fmtD(st)+"&end="+fmtD(end),25000)).properties.parameter}catch(e){}}
 if(!p||!p.T2M)return{st:"err"};
 try{
  var ks=Object.keys(p.T2M).sort(),ok=function(v){return v!=null&&v!==-999},sum=FS.sum;
  var stats=function(a,b){var w=ks.filter(function(k){return k>=a&&k<=b}),vals=function(o){return o?w.map(function(k){return o[k]}).filter(ok):[]};
   var T1=vals(p.T2M),R=vals(p.PRECTOTCORR),G=vals(p.GWETROOT);
   return{n:w.length,temp:T1.length?sum(T1)/T1.length:null,rain:R.length?sum(R):null,soil:G.length?sum(G)/G.length:null}};
  var cu=stats(fmtD(st),fmtD(end)),out={st:"ok",temp:cu.temp,rain:cu.rain,soil:cu.soil,from:fmtD(st),to:fmtD(end)};
  out.hot=ks.filter(function(k){return k>=fmtD(st)&&k<=fmtD(end)&&ok(p.T2M_MAX[k])&&p.T2M_MAX[k]>=35}).length;
  var ys=[];for(var y=1;y<=5;y++){var q=stats(sh(st,y),sh(end,y));if(q.n>=25&&q.temp!=null&&q.rain!=null&&q.soil!=null)ys.push(q)}
  var avg=function(f){return sum(ys.map(f))/ys.length};
  out.usual=ys.length>=3?{n:ys.length,temp:avg(function(q){return q.temp}),rain:avg(function(q){return q.rain}),soil:avg(function(q){return q.soil})}:null;
  if(cu.temp==null)return{st:"err"};
  return out
 }catch(e){return{st:"err"}}
};
/* OpenStreetMap farmland polygons near a point (Overpass) */
var OVP=["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];
FS.haOf=function(p){var k=111320,c=Math.cos(p[0][0]*Math.PI/180),a=0;for(var i=0;i<p.length;i++){var q=p[(i+1)%p.length];a+=(p[i][1]*k*c)*(q[0]*k)-(q[1]*k*c)*(p[i][0]*k)}return Math.abs(a/2)/1e4};
FS.inPoly=function(lat,lng,ll){var c=false;for(var i=0,j=ll.length-1;i<ll.length;j=i++){var a=ll[i],b=ll[j];if((a[1]>lng)!=(b[1]>lng)&&lat<(b[0]-a[0])*(lng-a[1])/(b[1]-a[1])+a[0])c=!c}return c};
FS.getFields=async function(bb){
 var q='[out:json][timeout:20];way["landuse"~"^(farmland|orchard|vineyard|greenhouse_horticulture)$"]('+bb.join(",")+');out geom 300;',data=null;
 for(var i=0;i<OVP.length&&!data;i++){try{data=await jget(OVP[i]+"?data="+encodeURIComponent(q),16000)}catch(e){}}
 if(!data)return null;
 return data.elements.filter(function(e){return e.geometry&&e.geometry.length>2}).map(function(e){var ll=e.geometry.map(function(p){return[p.lat,p.lon]});return{id:e.id,ll:ll,ha:FS.haOf(ll)}})
};
FS.getFieldsFor=function(lat,lng,r){r=r||.015;return FS.getFields([lat-r,lng-r,lat+r,lng+r])};

var rid=0,NEED=((document.body&&document.body.dataset.need)||"om").split(",");
/* tiny session cache so moving between pages is instant (10 min weather, 6 h climate) */
function cached(name,la,ln,ttl,fn,force){
 var k=la.toFixed(3)+","+ln.toFixed(3),key="fs_c_"+name;
 if(!force){try{var c=JSON.parse(sessionStorage.getItem(key)||"null");if(c&&c.k===k&&Date.now()-c.t<ttl&&c.v&&c.v.st==="ok")return Promise.resolve(c.v)}catch(e){}}
 return fn(la,ln).then(function(v){try{if(v&&v.st==="ok")sessionStorage.setItem(key,JSON.stringify({k:k,t:Date.now(),v:v}))}catch(e){}return v})
}
FS.refresh=async function(force){
 if(!FS.hasFarm())return;
 var id=++rid,la=farm.lat,ln=farm.lng,D=FS.data,nN=NEED.indexOf("nasa")>=0,nF=NEED.indexOf("fields")>=0;
 D.om={st:"load"};D.nasa={st:nN?"load":"idle"};D.fields={st:nF?"load":"idle",list:[]};FS.emit("update");
 cached("om",la,ln,600000,FS.getOM,force).then(function(r){if(id!==rid)return;D.om=r;FS.emit("update");if(r.st!="ok")FS.toast(T("تعذّر جلب الطقس من Open-Meteo. تأكد من الإنترنت.","Could not load weather from Open-Meteo. Check your connection."))});
 if(nN)cached("nasa",la,ln,21600000,FS.getNASA,force).then(function(r){if(id!==rid)return;D.nasa=r;FS.emit("update")});
 if(nF)FS.getFieldsFor(la,ln).then(function(list){
  if(id!==rid)return;
  if(!list){D.fields={st:"err",list:[]};FS.emit("update");return}
  D.fields={st:"ok",list:list};
  var hit=list.filter(function(f){return FS.inPoly(la,ln,f.ll)}).sort(function(a,b){return a.ha-b.ha})[0];
  if(hit){farm.poly=hit.ll;farm.fieldFed=hit.ha/.42;save();syncForm(false)}
  FS.emit("update")
 })
};
/* choose a mapped field as THE farm field (called from the map) */
FS.selectField=function(f){
 var c=f.ll.reduce(function(s,p){return[s[0]+p[0],s[1]+p[1]]},[0,0]);c=[c[0]/f.ll.length,c[1]/f.ll.length];
 var moved=Math.abs(c[0]-farm.lat)>1e-5||Math.abs(c[1]-farm.lng)>1e-5;
 Object.assign(farm,{lat:c[0],lng:c[1],poly:f.ll,fieldFed:f.ha/.42,areaFed:null});save();
 if(moved)FS.refresh();FS.emit("update");syncForm(true)
};

/* ---------- location search (Arabic or English) ---------- */
var GOV={"القاهرة":"Cairo","الجيزة":"Giza","الاسكندرية":"Alexandria","الإسكندرية":"Alexandria","الشرقية":"Sharqia","الدقهلية":"Dakahlia","الغربية":"Gharbia","المنوفية":"Monufia","القليوبية":"Qalyubia","البحيرة":"Beheira","كفر الشيخ":"Kafr El Sheikh","دمياط":"Damietta","بورسعيد":"Port Said","الاسماعيلية":"Ismailia","الإسماعيلية":"Ismailia","السويس":"Suez","الفيوم":"Faiyum","بني سويف":"Beni Suef","المنيا":"Minya","اسيوط":"Asyut","أسيوط":"Asyut","سوهاج":"Sohag","قنا":"Qena","الاقصر":"Luxor","الأقصر":"Luxor","اسوان":"Aswan","أسوان":"Aswan","الوادي الجديد":"New Valley","مطروح":"Matrouh","شمال سيناء":"North Sinai","جنوب سيناء":"South Sinai","البحر الاحمر":"Red Sea","البحر الأحمر":"Red Sea"};
var isAr=function(q){return /[؀-ۿ]/.test(q)};
var norm=function(q){return q.replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[ً-ْـ]/g,"").replace(/\s+/g," ").trim()};
var NG={};Object.keys(GOV).forEach(function(k){NG[norm(k)]=GOV[k]});
var uniq=function(a){return a.filter(function(x,i){return x&&a.indexOf(x)==i})};
var simp=function(q){return q.replace(/(مدينة|مدينه|محافظة|محافظه|مركز|قرية|قريه|مصر|جمهورية|العربية)/g," ").replace(/\s+/g," ").trim()};
async function viaPhoton(q){
 var j=await jget("https://photon.komoot.io/api/?limit=6&bbox=24.5,21.5,37.0,32.0&q="+encodeURIComponent(q),9000);
 return j.features.map(function(f){var p=f.properties;return{lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0],display_name:[p.name,p.district,p.city,p.county,p.state,T("مصر","Egypt")].filter(Boolean).join(T("، ",", "))}})
}
var lastNom=0;
async function viaNom(q){
 var w=1100-(Date.now()-lastNom);if(w>0)await new Promise(function(r){setTimeout(r,w)});lastNom=Date.now();
 return jget("https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=eg&accept-language="+(FS.lang==="en"?"en,ar":"ar,en")+"&q="+encodeURIComponent(q),9000)
}
FS.geo=async function(q){
 var s0=simp(q)||q,tries=[];
 if(isAr(q)){var en=NG[norm(s0)];if(en)tries.push([viaPhoton,en],[viaNom,en]);
  uniq([q,s0,s0.replace(/ه(?=\s|$)/g,"ة"),s0.replace(/ة(?=\s|$)/g,"ه")]).forEach(function(v){tries.push([viaNom,v])});tries.push([viaPhoton,s0],[viaNom,s0+"، مصر"])}
 else{var e2=q.replace(/\b(governorate|city|markaz|center|centre|village)\b/ig,"").replace(/\s+/g," ").trim()||q;tries.push([viaPhoton,q],[viaNom,q],[viaPhoton,e2+" Egypt"],[viaNom,e2+", Egypt"])}
 for(var i=0;i<tries.length;i++){try{var r=await tries[i][0](tries[i][1]);if(r&&r.length)return r}catch(e){}}
 return[]
};
FS.inEg=function(la,lo){return la>=21.5&&la<=32&&lo>=24.5&&lo<=37};

/* ---------- farm form + location picker ---------- */
var pm=null,pmk=null;
function opts(sel,obj,key){$(sel).innerHTML=Object.keys(obj).map(function(k){return'<option value="'+k+'">'+(key?obj[k][key]:obj[k])+'</option>'}).join("")}
function syncForm(moved){
 var set=function(id,v){var e=$(id);if(e&&document.activeElement!==e)e.value=v==null?"":v};
 set("crop",farm.crop);set("stage",farm.stage);set("last",farm.last);set("soil",farm.soil);set("method",farm.method);
 set("cnt",farm.cnt);set("depth",farm.depth);set("price",farm.price);set("area",farm.areaFed);
 var A=FS.area(),h=$("areahint");
 if(h)h.textContent=farm.areaFed>0?T("المساحة اللي أدخلتها هي المستخدمة في الحسابات.","The area you entered is used in the calculations."):farm.fieldFed>0?T("مساحة الحقل من حدوده في OpenStreetMap ≈ ","Field area from its OpenStreetMap boundary ≈ ")+FS.f1(farm.fieldFed)+T(" فدان (مستخدمة في الحسابات). اكتب رقم لتغييرها."," feddan (used in the calculations). Type a number to change it."):T("لو مش عارف المساحة، هنفترض فدان واحد ونوضح ده في النتائج.","If you don't know the area we assume one feddan and say so in the results.");
 var c=$("coord");
 if(c&&FS.hasFarm()&&!c.classList.contains("warn")){c.textContent="📍 "+(farm.name?farm.name+" · ":"")+"\u2066"+farm.lat.toFixed(4)+"°N, "+farm.lng.toFixed(4)+"°E\u2069 · "+T("المساحة المستخدمة: ","Area used: ")+FS.f1(A.fed)+" "+FS.U.fed+(A.src=="default"?T(" (افتراض)"," (assumed)"):"")}
 else if(c&&!FS.hasFarm())c.textContent="";
 if(pm&&FS.hasFarm()){var ll=[farm.lat,farm.lng];if(!pmk)pmk=mkPin(ll);else pmk.setLatLng(ll);if(moved)pm.setView(ll,Math.max(pm.getZoom(),14))}
}
function mkPin(ll){
 var ic=L.divIcon({className:"",html:'<svg class="pinicon" width="36" height="36" viewBox="0 0 34 34"><path d="M17 33C9 22 5 17 5 12a12 12 0 0124 0c0 5-4 10-12 21z" fill="#C93B3B"/><circle cx="17" cy="12" r="4.500" fill="#fff"/></svg>',iconSize:[36,36],iconAnchor:[18,34]});
 var m=L.marker(ll,{icon:ic,draggable:true}).addTo(pm);m.on("dragend",function(){var p=m.getLatLng();place(p.lat,p.lng,"")});return m
}
function place(la,lo,name){
 if(!FS.inEg(la,lo)){var c=$("coord");c.textContent=T("الموقع ده خارج مصر. اختار مكان جوه مصر.","This location is outside Egypt. Pick a place inside Egypt.");c.classList.add("warn");return false}
 $("coord").classList.remove("warn");FS.setFarm({lat:la,lng:lo,name:name||""});return true
}
FS.place=place;
async function search(q){
 if(!q)return;var sg=$("sug"),m=q.match(/^(-?\d+(\.\d+)?)\s*[,،]\s*(-?\d+(\.\d+)?)$/);
 if(m){if(place(parseFloat(m[1]),parseFloat(m[3]),"")&&pm)pm.setView([farm.lat,farm.lng],14);return}
 sg.style.display="block";sg.innerHTML="<div>"+T("جاري البحث…","Searching…")+"</div>";
 var res=await FS.geo(q);sg.innerHTML="";
 if(!res.length){sg.innerHTML="<div>"+T("مش لاقي المكان ده. جرّب اسم تاني أو اضغط على الخريطة.","Place not found. Try another name or tap the map.")+"</div>";return}
 var go=function(r){sg.style.display="none";$("q").value=r.display_name;if(place(parseFloat(r.lat),parseFloat(r.lon),r.display_name.split(/[،,]/)[0])&&pm)pm.setView([farm.lat,farm.lng],14)};
 res.forEach(function(r){var d=document.createElement("div");d.textContent=r.display_name;d.onclick=function(){go(r)};sg.appendChild(d)});
 if(res.length==1)go(res[0])
}
function initForm(){
 opts("crop",FS.CROPS,"n");opts("stage",FS.STAGES);opts("soil",FS.SOILS,"n");opts("method",FS.METHODS,"n");
 opts("last",FS.LAST);
 ["crop","stage","soil","last"].forEach(function(id){$(id).onchange=function(){var p={};p[id]=this.value;FS.setFarm(p)}});
 $("method").onchange=function(){var p={method:this.value};if(!farm.cu){p.cnt=FS.METHODS[this.value].cnt;p.depth=FS.METHODS[this.value].depth}FS.setFarm(p)};
 $("area").oninput=function(){var v=parseFloat(this.value);FS.setFarm({areaFed:v>0?v:null})};
 $("cnt").oninput=function(){var v=parseFloat(this.value);if(v>=0)FS.setFarm({cnt:v,cu:true})};
 $("depth").oninput=function(){var v=parseFloat(this.value);if(v>=0)FS.setFarm({depth:v,cu:true})};
 $("price").oninput=function(){var v=parseFloat(this.value);FS.setFarm({price:v>0?v:null})};
 $("farmform").onsubmit=function(e){e.preventDefault();
  if(!FS.hasFarm()){var c=$("coord");c.textContent=T("اختار مكان مزرعتك الأول: ابحث بالاسم أو اضغط على الخريطة.","Choose your farm location first: search by name or tap the map.");c.classList.add("warn");$("pick").scrollIntoView({behavior:"smooth",block:"center"});return}
  location.href="dashboard.html"};
 $("reset").onclick=function(){farm=Object.assign({},DEF);save();FS.data={om:{st:"idle"},nasa:{st:"idle"},fields:{st:"idle",list:[]}};rid++;if(pmk&&pm){pm.removeLayer(pmk);pmk=null}$("q").value="";syncForm(false);FS.emit("update");FS.toast(T("تم مسح بيانات المزرعة","Farm data cleared"))};
 $("sbtn").onclick=function(){search($("q").value.trim())};
 $("q").addEventListener("keydown",function(e){if(e.key=="Enter"){e.preventDefault();search(this.value.trim())}});
 document.addEventListener("click",function(e){if(!e.target.closest(".sbox"))$("sug").style.display="none"});
 $("locbtn").onclick=function(){
  var c=$("coord");c.classList.remove("warn");
  if(!navigator.geolocation){c.textContent=T("المتصفح مش بيدعم تحديد الموقع.","Your browser does not support location.");c.classList.add("warn");return}
  c.textContent=T("بحدد موقعك…","Finding your location…");
  navigator.geolocation.getCurrentPosition(function(p){if(place(p.coords.latitude,p.coords.longitude,T("موقعي الحالي","My location"))&&pm)pm.setView([farm.lat,farm.lng],15)},function(){c.textContent=T("مقدرتش أحدد موقعك. اسمح للمتصفح بالوصول للموقع أو ابحث بالاسم.","Could not get your location. Allow location access or search by name.");c.classList.add("warn")},{timeout:10000})
 };
 [].forEach.call(document.querySelectorAll("[data-demo]"),function(b){b.onclick=function(){var p=b.dataset.demo.split(",");place(parseFloat(p[0]),parseFloat(p[1]),FS.lang==="en"?b.textContent.trim():p[2]);if(pm)pm.setView([farm.lat,farm.lng],14)}});
 /* picker map */
 var el=$("pick");
 if(!window.L){el.innerHTML='<div style="padding:24px">'+T("تعذّر تحميل الخريطة. اكتب اسم المكان أو الإحداثيات في خانة البحث، مثال: 30.5, 31.2","The map could not load. Type the place name or coordinates in the search box, e.g. 30.5, 31.2")+'</div>';return}
 pm=L.map(el,{minZoom:5,maxZoom:19}).setView([27.2,31],6);pm.attributionControl.setPrefix(false);
 L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxNativeZoom:18,maxZoom:19,attribution:"Esri"}).addTo(pm);
 pm.createPane("lab").style.zIndex=450;pm.getPane("lab").style.pointerEvents="none";
 L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",{pane:"lab",maxNativeZoom:13,maxZoom:19}).addTo(pm);
 pm.on("click",function(e){place(e.latlng.lat,e.latlng.lng,"")});
 if(FS.hasFarm()){pmk=mkPin([farm.lat,farm.lng]);pm.setView([farm.lat,farm.lng],14)}
 var ps=$("pickstat");pm.on("zoomend",function(){ps.textContent=pm.getZoom()<12?T("قرّب أكتر عشان تحدد أرضك بدقة.","Zoom in to pin your land precisely."):""});
 var io=window.IntersectionObserver&&new IntersectionObserver(function(en){if(en[0].isIntersecting)pm.invalidateSize()});if(io)io.observe(el);
 window.addEventListener("resize",function(){pm.invalidateSize()})
}

if($("farmform"))initForm();syncForm(false);
if(FS.hasFarm())FS.refresh();
})();
