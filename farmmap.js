/* Field Shift — interactive farm map. One indicator per layer (never mixed):
   heat = REAL forecast values from a 5x5 Open-Meteo grid, shown as a smooth colour surface (temperature / rain / ET0)
   risk = weather-risk cells from the same grid (forecast estimate, NOT field sensors)
   irr  = irrigation status from the FAO-56 water balance (calculated at the farm pin, applied to the field)
   ndvi = NASA GIBS MODIS NDVI image tiles (real satellite layer; no numeric value is sampled or invented)
   sat  = Esri satellite imagery only
   The satellite image is always the background. */
(function(){
"use strict";
var FS=window.FS,$=FS.$,nz=FS.nz,N=FS.N,bd=FS.bd,f0=FS.f0,f1=FS.f1,esc=FS.esc,tr=FS.T,U=FS.U;
var CL=["#2E9E4F","#F2B01E","#D64545"],LV=tr(["منخفض","متوسط","مرتفع"],["Low","Medium","High"]);
var M=null,layer="",L_={},pin=null,probeMk=null,fieldsG=null,key="",gridKey="",G=null,gc=null,gst="idle",pr=0,ndB=16,ndE=0,hold="",probeId=0,fitKey="";
var el=$("fmap");
var DIR=FS.lang==="en"?"90deg":"270deg"; /* gradient direction so "min" sits at the start side in both RTL and LTR */

/* ---------- NDVI (NASA GIBS MODIS Terra 8-day) ---------- */
function ndviDate(back){
 var d=new Date();d.setDate(d.getDate()-back);var s0=Date.UTC(d.getUTCFullYear(),0,1),doy=Math.floor((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-s0)/864e5)+1;
 return new Date(s0+Math.floor((doy-1)/8)*8*864e5).toISOString().slice(0,10)
}
var ndviUrl=function(b){return"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/"+ndviDate(b)+"/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png"};

function init(){
 if(M)return true;
 if(!window.L){el.innerHTML='<div style="padding:30px;color:#fff;height:100%">'+tr("تعذّر تحميل الخريطة. اتأكد من الإنترنت وحدّث الصفحة.","The map could not load. Check your connection and refresh the page.")+'</div>';return false}
 M=L.map(el,{minZoom:5,maxZoom:19,zoomControl:false,maxBounds:[[20,23],[33,38]],maxBoundsViscosity:.8}).setView([27.2,31],6);
 L.control.zoom({position:"bottomright",zoomInTitle:tr("تكبير","Zoom in"),zoomOutTitle:tr("تصغير","Zoom out")}).addTo(M);
 L.control.scale({position:"bottomright",imperial:false}).addTo(M);
 M.attributionControl.setPrefix(false);
 L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxNativeZoom:18,maxZoom:19,attribution:"Esri World Imagery"}).addTo(M);
 M.createPane("ndviP").style.zIndex=250;
 L_.ndvi=L.tileLayer(ndviUrl(ndB),{pane:"ndviP",maxNativeZoom:9,maxZoom:19,opacity:.85,attribution:"NASA GIBS · MODIS Terra NDVI"});
 L_.ndvi.on("tileerror",function(){if(++ndE===8&&ndB<64){ndB+=16;ndE=0;L_.ndvi.setUrl(ndviUrl(ndB));tag()}});
 M.createPane("riskP").style.zIndex=300;M.createPane("irrP").style.zIndex=310;M.createPane("heatP").style.zIndex=305;
 L_.risk=L.layerGroup();L_.irr=L.layerGroup();L_.heat=L.layerGroup();
 M.createPane("labP").style.zIndex=450;M.getPane("labP").style.pointerEvents="none";
 L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",{pane:"labP",maxNativeZoom:13,maxZoom:19}).addTo(M);
 fieldsG=L.layerGroup().addTo(M);
 M.on("click",function(e){probe(e.latlng.lat,e.latlng.lng)});
 var io=window.IntersectionObserver&&new IntersectionObserver(function(en){if(en[0].isIntersecting){M.invalidateSize();update()}},{threshold:.1});if(io)io.observe(el);
 window.addEventListener("resize",function(){M.invalidateSize()});
 return true
}

/* ---------- forecast grid: ONE Open-Meteo request, 5x5 points ---------- */
var STEP=.08;
async function loadGrid(lat,lng){
 var id=++pr,la=[],lo=[],a,b;gst="load";G=null;gc={lat:lat,lng:lng};
 for(a=-2;a<=2;a++)for(b=-2;b<=2;b++){la.push((lat+a*STEP).toFixed(3));lo.push((lng+b*STEP).toFixed(3))}
 var u="https://api.open-meteo.com/v1/forecast?latitude="+la.join(",")+"&longitude="+lo.join(",")+"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,wind_speed_10m_max&past_days=7&forecast_days=7&timezone=auto",j=null;
 for(var t=0;t<2&&!j;t++){try{var r=await fetch(u);if(r.ok)j=await r.json()}catch(e){}}
 if(id!==pr)return;
 var arr=j?(Array.isArray(j)?j:[j]):[];
 G=arr.map(function(p,i){return p&&p.daily&&p.daily.et0_fao_evapotranspiration?{lat:+la[i],lng:+lo[i],om:{st:"ok",d:p.daily,i0:7}}:null}).filter(Boolean);
 gst=G.length?"ok":"err";if(!G.length)G=null;
 drawGrid();drawHeat();legend();panel()
}
function drawGrid(){
 L_.risk.clearLayers();if(!G)return;var f=FS.farm();
 G.forEach(function(p){
  var r=FS.risk(p.om,f),h=STEP/2;
  L.rectangle([[p.lat-h,p.lng-h],[p.lat+h,p.lng+h]],{pane:"riskP",stroke:true,color:"#fff",weight:1,opacity:.5,fillColor:CL[r.L],fillOpacity:.5}).addTo(L_.risk)
   .bindTooltip(tr("خطر ","Risk: ")+LV[r.L]+(r.why.length?" — "+r.why[0]:tr(" — لا مخاطر ملحوظة"," — nothing notable")),{sticky:true,direction:"top"})
 })
}

/* ---------- heat map: real forecast values, smoothly blended between the 25 grid points ---------- */
var HV={
 tmax:{n:tr("أعلى حرارة متوقعة خلال 7 أيام","Highest expected temperature, next 7 days"),s:tr("الحرارة","Temperature"),u:U.c,k:"temperature_2m_max",ag:"max",c:["#2B6CB0","#7FD1AE","#F6E65B","#F29A2E","#D64545"]},
 rain:{n:tr("إجمالي المطر المتوقع خلال 7 أيام","Total expected rain, next 7 days"),s:tr("المطر","Rain"),u:U.mm,k:"precipitation_sum",ag:"sum",c:["#EEF3F8","#9CC8EE","#3F83D1","#1B3F9C"]},
 et0:{n:tr("إجمالي التبخر المرجعي ET₀ (7 أيام)","Total reference evaporation ET₀, 7 days"),s:tr("التبخر ET₀","Evaporation ET₀"),u:U.mm,k:"et0_fao_evapotranspiration",ag:"sum",c:["#E8F5EA","#BFE27A","#F0C94A","#C9741A"]}
},hv="tmax";
function today(){return new Date().toISOString().slice(0,10)}
function hex(c){return[1,3,5].map(function(i){return parseInt(c.substr(i,2),16)})}
function ramp(cs,t){t=Math.max(0,Math.min(1,t));var x=t*(cs.length-1),i=Math.min(cs.length-2,Math.floor(x)),u=x-i,a=hex(cs[i]),b=hex(cs[i+1]);return"rgb("+a.map(function(v,j){return Math.round(v+(b[j]-v)*u)}).join(",")+")"}
function heatVals(k){
 if(!G)return null;var v=HV[k||hv];
 var vals=G.map(function(p){var a=p.om.d[v.k].slice(p.om.i0).filter(function(x){return x!=null});return a.length?(v.ag=="max"?Math.max.apply(null,a):FS.sum(a)):null});
 var ok=vals.filter(function(x){return x!=null});if(!ok.length)return null;
 return{vals:vals,min:Math.min.apply(null,ok),max:Math.max.apply(null,ok)}
}
function drawHeat(){
 L_.heat.clearLayers();var r=heatVals();if(!r||!gc)return;var v=HV[hv],h=STEP/2,rng=r.max-r.min;
 /* one pixel per grid cell; the browser's bilinear scaling blends neighbouring cells into a smooth surface */
 var cv=document.createElement("canvas");cv.width=5;cv.height=5;var cx=cv.getContext("2d");
 G.forEach(function(p,i){var x=r.vals[i];if(x==null)return;
  var px=Math.round((p.lng-gc.lng)/STEP)+2,py=2-Math.round((p.lat-gc.lat)/STEP);
  cx.fillStyle=ramp(v.c,rng>0?(x-r.min)/rng:.5);cx.fillRect(px,py,1,1)});
 var b=[[gc.lat-2.5*STEP,gc.lng-2.5*STEP],[gc.lat+2.5*STEP,gc.lng+2.5*STEP]];
 L.imageOverlay(cv.toDataURL(),b,{pane:"heatP",opacity:.8,className:"heatimg",interactive:false}).addTo(L_.heat);
 G.forEach(function(p,i){var x=r.vals[i];if(x==null)return;
  L.rectangle([[p.lat-h,p.lng-h],[p.lat+h,p.lng+h]],{pane:"heatP",stroke:false,fill:true,fillColor:"#000",fillOpacity:0}).addTo(L_.heat)
   .bindTooltip(v.s+": "+x.toFixed(1)+" "+v.u,{sticky:true,direction:"top"})})
}
function heatLegend(){
 var v=HV[hv],r=heatVals();
 if(!r)return'<b class="t">'+v.n+'</b><div>'+bd("na")+' '+tr("مفيش بيانات كفاية لعرض خريطة حرارية. مبنولّدش بيانات بديلة.","Not enough data for a heat map. We never generate substitute data.")+'</div>';
 return'<b class="t">'+v.n+'</b><div class="grad" style="background:linear-gradient('+DIR+','+v.c.join(",")+')"></div><div class="ends"><span class="num">'+r.min.toFixed(1)+' '+v.u+' '+tr("(الأقل)","(lowest)")+'</span><span class="num">'+r.max.toFixed(1)+' '+v.u+' '+tr("(الأعلى)","(highest)")+'</span></div><div class="note">'+tr("اللون يتدرج من أقل قيمة لأعلى قيمة بين 25 نقطة توقع حوالين مزرعتك، ومتنعّم بينهم (مش مقياس مطلق). كل نقطة ≈ 9 كم من Open-Meteo، مش قياس حقلي. تحديث: ","Colour runs from the lowest to the highest of 25 forecast points around your farm and is smoothed between them (not an absolute scale). Each point is ≈ 9 km from Open-Meteo, not a field measurement. Updated: ")+today()+'.</div>'
}
function heatPanel(){
 if(gst=="load"||gst=="idle")return'<p><span class="spin"></span>'+tr("جاري جلب شبكة التوقعات…","Loading the forecast grid…")+'</p>';
 if(gst=="err"||!heatVals())return'<p>'+bd("na")+' '+tr("تعذّر جلب بيانات الشبكة من Open-Meteo، فمفيش خريطة حرارية بتتعرض.","The grid could not be loaded from Open-Meteo, so no heat map is shown.")+'</p>';
 var f=FS.farm(),cnt=[0,0,0];G.forEach(function(p){cnt[FS.risk(p.om,f).L]++});
 var rows=["tmax","rain","et0"].map(function(k){var r=heatVals(k),v=HV[k];return'<div><span>'+(k=="tmax"?"🌡 ":k=="rain"?"🌧 ":"💧 ")+v.s+'</span><b class="num">'+r.min.toFixed(0)+' – '+r.max.toFixed(0)+' '+v.u+'</b></div>'}).join("");
 return'<p class="mu sm">'+tr("المدى حوالين مزرعتك خلال 7 أيام ","Range around your farm over 7 days ")+bd("fc")+'</p><div class="stat3">'+rows+'</div>'+
  '<p class="mu sm" style="margin-top:12px">'+tr("مستوى الخطر في 25 نقطة","Risk level across the 25 points")+'</p><div class="stat3"><div><span>🟢 '+LV[0]+'</span><b class="num">'+cnt[0]+'</b></div><div><span>🟡 '+LV[1]+'</span><b class="num">'+cnt[1]+'</b></div><div><span>🔴 '+LV[2]+'</span><b class="num">'+cnt[2]+'</b></div></div>'+
  '<p class="note">'+tr("غيّر المؤشر من فوق الخريطة، واضغط أي نقطة لتحليلها.","Change the indicator above the map, and tap any point to analyse it.")+'</p>'
}

/* ---------- irrigation layer: field polygon (or an approximate, clearly-labelled square) ---------- */
function drawIrr(){
 L_.irr.clearLayers();var a=FS.analysis(),f=FS.farm();if(a.st!="ok")return;
 var S=a.rec.due?a.rec.S:0,col=CL[S],txt=tr("حالة الري: ","Irrigation status: ")+(a.rec.due?a.rec.head:tr("مفيش ري مطلوب خلال 7 أيام","no irrigation needed in 7 days"));
 if(f.poly)L.polygon(f.poly,{pane:"irrP",color:"#fff",weight:3,fillColor:col,fillOpacity:.55}).addTo(L_.irr).bindTooltip(txt,{sticky:true});
 else{
  var A=FS.area(),side=Math.sqrt(A.m2)/2,dla=side/111320,dlo=side/(111320*Math.cos(f.lat*Math.PI/180));
  L.rectangle([[f.lat-dla,f.lng-dlo],[f.lat+dla,f.lng+dlo]],{pane:"irrP",color:"#fff",weight:3,dashArray:"8 6",fillColor:col,fillOpacity:.55}).addTo(L_.irr).bindTooltip(txt+tr(" (مساحة تقريبية حسب إدخالك، مش حدود فعلية)"," (approximate area from your input, not a real boundary)"),{sticky:true})
 }
}

/* ---------- field boundaries (OpenStreetMap) ---------- */
function drawFields(){
 fieldsG.clearLayers();var D=FS.data.fields,f=FS.farm();if(!D||D.st!="ok")return;
 D.list.forEach(function(fl){
  var mine=f.poly&&fl.ll.length==f.poly.length&&fl.ll[0][0]==f.poly[0][0];
  var pl=L.polygon(fl.ll,{color:mine?"#fff":"#CFF5A6",weight:mine?3:1.5,fill:true,fillColor:"#fff",fillOpacity:.03}).addTo(fieldsG);
  pl.bindTooltip(tr("حقل مسجّل في OpenStreetMap · ≈ "+f1(fl.ha/.42)+" فدان · اضغط لاختياره","Field mapped in OpenStreetMap · ≈ "+f1(fl.ha/.42)+" feddan · tap to select"),{sticky:true});
  pl.on("click",function(e){L.DomEvent.stopPropagation(e);FS.selectField(fl);FS.toast(tr("تم اختيار الحقل: ≈ "+f1(fl.ha/.42)+" فدان","Field selected: ≈ "+f1(fl.ha/.42)+" feddan"))})
 })
}

/* ---------- pin ---------- */
function drawPin(){
 var f=FS.farm();if(pin){M.removeLayer(pin);pin=null}
 var ic=L.divIcon({className:"",html:'<svg class="pinicon" width="40" height="40" viewBox="0 0 34 34"><path d="M17 33C9 22 5 17 5 12a12 12 0 0124 0c0 5-4 10-12 21z" fill="#C93B3B"/><circle cx="17" cy="12" r="4.5" fill="#fff"/></svg>',iconSize:[40,40],iconAnchor:[20,38]});
 pin=L.marker([f.lat,f.lng],{icon:ic,keyboard:false}).addTo(M).bindTooltip(tr("مزرعتك","Your farm"),{direction:"top",offset:[0,-34]})
}

/* ---------- legend / tag / panel ---------- */
function legend(){
 var h="";
 if(layer=="sat")h='<b class="t">'+tr("قمر صناعي","Satellite")+'</b><div>'+tr("صور Esri الحقيقية. الدبوس الأحمر = مزرعتك، والخط الأبيض = حدود الحقل (لو متسجل).","Real Esri imagery. Red pin = your farm, white outline = field boundary (when mapped).")+'</div>';
 else if(layer=="ndvi")h='<b class="t">'+tr("صحة النبات (NDVI)","Crop health (NDVI)")+'</b><div class="grad" style="background:linear-gradient('+DIR+',#8B5A2B,#D9B96B,#E8E37A,#8FC95B,#1B7A2E)"></div><div class="ends"><span>'+tr("تربة جرداء","Bare soil")+'</span><span>'+tr("نبات كثيف","Dense vegetation")+'</span></div>'+
  '<div class="note">'+tr("بني: قليل أو معدوم نبات · أصفر: ضعيف أو متوسط · أخضر غامق: كثيف وصحي. ألوان ناسا الأصلية، دقة ≈ 250 م، تركيب 8 أيام. مؤشر للمقارنة مش تشخيص مرض، والقيمة الدقيقة لنقطة غير متاحة.","Brown: little or no vegetation · yellow: weak or moderate · dark green: dense and healthy. Original NASA colours, ≈ 250 m, 8-day composite. An indicator for comparison, not a disease diagnosis; the exact value at a point is not available.")+'</div>';
 else if(layer=="risk")h='<b class="t">'+tr("مخاطر الطقس (توقع 7 أيام)","Weather risk (7-day forecast)")+'</b><div class="row"><i class="sw" style="background:'+CL[0]+'"></i>'+tr("أخضر: خطر منخفض","Green: low risk")+'</div><div class="row"><i class="sw" style="background:'+CL[1]+'"></i>'+tr("أصفر: خطر متوسط","Yellow: medium risk")+'</div><div class="row"><i class="sw" style="background:'+CL[2]+'"></i>'+tr("أحمر: خطر مرتفع","Red: high risk")+'</div><div class="note">'+tr("كل مربع ≈ 9 كم، من توقعات Open-Meteo. تقدير توقعات، مش قياس من حساسات.","Each square ≈ 9 km, from Open-Meteo forecasts. A forecast estimate, not sensor data.")+'</div>';
 else if(layer=="heat")h=heatLegend();
 else h='<b class="t">'+tr("حالة الري (حساب)","Irrigation status (calculated)")+'</b><div class="row"><i class="sw" style="background:'+CL[0]+'"></i>'+tr("أخضر: مفيش ري قريب","Green: no irrigation soon")+'</div><div class="row"><i class="sw" style="background:'+CL[1]+'"></i>'+tr("أصفر: ري خلال 3–6 أيام","Yellow: irrigation in 3–6 days")+'</div><div class="row"><i class="sw" style="background:'+CL[2]+'"></i>'+tr("أحمر: ري خلال يومين أو أقل","Red: irrigation within 2 days")+'</div><div class="note">'+tr("حساب ميزان مائي عند الدبوس، مطبّق على الحقل كله. مش قراءة حساس.","Water balance calculated at the pin and applied to the whole field. Not a sensor reading.")+'</div>';
 $("legend").innerHTML=h
}
function tag(){
 var t={sat:tr("صور قمر صناعي · Esri","Satellite imagery · Esri"),
  ndvi:tr("NDVI · NASA MODIS · تركيب 8 أيام يبدأ "+ndviDate(ndB)+" · دقة ≈ 250 م","NDVI · NASA MODIS · 8-day composite from "+ndviDate(ndB)+" · ≈ 250 m"),
  risk:tr("مخاطر الطقس · شبكة Open-Meteo ≈ 9 كم · توقع من "+today(),"Weather risk · Open-Meteo grid ≈ 9 km · forecast from "+today()),
  heat:tr("خريطة حرارية · ","Heat map · ")+HV[hv].s+" · Open-Meteo · "+tr("توقع من ","forecast from ")+today(),
  irr:tr("حالة الري · حساب FAO-56 · ","Irrigation status · FAO-56 calculation · ")+today()}[layer];
 $("maptag").textContent=t||""
}
function panel(extra){
 var el2=$("mpanel"),f=FS.farm(),a=FS.analysis();
 if(extra){hold=extra;el2.innerHTML=extra;return}
 if(hold){el2.innerHTML=hold;return}
 if(!FS.hasFarm())return el2.innerHTML='<h3>'+tr("مفيش مزرعة محددة","No farm set")+'</h3><p class="mu">'+tr("حدّد مكان مزرعتك الأول عشان تتعرض على الخريطة.","Set your farm location first so it can be shown on the map.")+'</p><a class="btn" href="farm.html" style="margin-top:10px">'+tr("إدخال بيانات المزرعة","Set up my farm")+'</a>';
 var s='';
 if(layer=="heat")s+='<h3>'+tr("الخريطة الحرارية","Heat map")+'</h3>'+heatPanel();
 if(layer=="sat")s+='<h3>'+tr("قمر صناعي","Satellite")+'</h3><p class="mu">'+tr("اضغط على أي نقطة في الخريطة لتحليل الطقس والخطر والري فيها.","Tap any point on the map to analyse weather, risk and irrigation there.")+'</p>';
 if(layer=="ndvi")s+='<h3>'+tr("صحة المحصول (NDVI)","Crop health (NDVI)")+'</h3><p class="mu">'+tr("كل ما اللون أخضر أغمق، النبات أكتر وأصح. ","The darker the green, the more and healthier the vegetation. ")+bd("na")+' '+tr("القيمة الرقمية لنقطة أو لحقل غير متاحة ومبنقدّرهاش. الدقة ≈ 250 م فمش بتفصل الحقول الصغيرة. قارن اللون حوالين أرضك بالمناطق القريبة.","The numeric value for a point or field is not available and we never estimate it. At ≈ 250 m it cannot separate small fields. Compare the colour around your land with nearby areas.")+'</p>';
 if(layer=="risk"){
  s+='<h3>'+tr("مخاطر الطقس","Weather risk")+'</h3>';
  if(gst=="load"||gst=="idle")s+='<p><span class="spin"></span>'+tr("جاري جلب شبكة التوقعات…","Loading the forecast grid…")+'</p>';
  else if(gst=="err")s+='<p>'+bd("na")+' '+tr("تعذّر جلب شبكة التوقعات من Open-Meteo. مفيش مخاطر بتتعرض.","The forecast grid could not be loaded. No risk is shown.")+'</p>';
  else{var c=[0,0,0];G.forEach(function(p){c[FS.risk(p.om,f).L]++});s+='<p class="mu sm">'+tr("25 مربع حوالين مزرعتك:","25 squares around your farm:")+'</p><div class="stat3"><div><span>🟢 '+LV[0]+'</span><b class="num">'+c[0]+'</b></div><div><span>🟡 '+LV[1]+'</span><b class="num">'+c[1]+'</b></div><div><span>🔴 '+LV[2]+'</span><b class="num">'+c[2]+'</b></div></div><p class="note">'+bd("fc")+' '+tr("توقعات نموذج، مش قياسات حقلية. اضغط على مربع لتفاصيله.","Model forecasts, not field measurements. Tap a square for details.")+'</p>'}}
 if(layer=="irr"){
  s+='<h3>'+tr("حالة الري","Irrigation status")+'</h3>';
  if(a.st!="ok")s+='<p>'+bd("na")+' '+tr("بيانات الطقس مش جاهزة لحساب حالة الري.","Weather data is not ready to calculate irrigation status.")+'</p>';
  else{var r=a.rec;s+='<div class="headline">'+esc(r.head)+'</div><p class="sm mu">'+(r.due?esc(r.date)+" · "+esc(r.tod):tr("الاستنزاف "+f0(a.c.D0)+" من "+a.c.raw+" مم","Depletion "+f0(a.c.D0)+" of "+a.c.raw+" mm"))+'</p><p class="note">'+bd("calc")+' '+(f.poly?tr("المضلع هو حدود حقلك من OpenStreetMap.","The polygon is your field boundary from OpenStreetMap."):tr("المربع المتقطع مساحة تقريبية من إدخالك، مش حدود فعلية.","The dashed square is an approximate area from your input, not a real boundary."))+' '+tr("الحالة محسوبة عند الدبوس وتنطبق على الحقل كله.","The status is calculated at the pin and applies to the whole field.")+'</p>'}}
 s+='<hr><p class="note">'+(FS.data.fields.st=="ok"?tr(FS.data.fields.list.length+" حقل مسجّل قريب. اضغط على حقل لاختياره كحقلك.",FS.data.fields.list.length+" mapped field(s) nearby. Tap a field to make it yours."):FS.data.fields.st=="load"?tr("جاري تحميل حدود الحقول…","Loading field boundaries…"):tr("حدود الحقول غير متاحة حاليًا (OpenStreetMap).","Field boundaries are not available right now (OpenStreetMap)."))+'</p>';
 el2.innerHTML=s
}

/* ---------- click: point analysis ---------- */
async function probe(lat,lng){
 var my=++probeId;
 if(probeMk)M.removeLayer(probeMk);
 probeMk=L.circleMarker([lat,lng],{radius:8,color:"#fff",weight:3,fillColor:"#2B6CB0",fillOpacity:1}).addTo(M);
 var ttl=tr("تحليل النقطة","Point analysis");
 panel('<h3>'+ttl+'</h3><p><span class="spin"></span>'+tr("جاري جلب بيانات الطقس للنقطة…","Loading weather for this point…")+'</p><p class="note num">'+lat.toFixed(4)+'°N, '+lng.toFixed(4)+'°E</p>');
 var om=await FS.getOM(lat,lng);if(my!==probeId)return;
 if(om.st!="ok")return panel('<h3>'+ttl+'</h3><p>'+bd("na")+' '+tr("تعذّر جلب بيانات الطقس لهذه النقطة. جرّب تاني.","Weather could not be loaded for this point. Try again.")+'</p>');
 var f=FS.farm(),w=FS.risk(om,f),c=w.c,T=w.T,sv=FS.SEV[w.L],rec=FS.irrRec(c,om,f);
 var kv=function(a,b){return'<div class="kv"><span>'+a+'</span><b>'+b+'</b></div>'};
 var act=w.L==0?tr("لا إجراء عاجل. تابع التوقعات.","No urgent action. Keep following the forecast."):w.L==1?tr("تابع وجهّز الري أو الحماية حسب الأسباب.","Keep watching and prepare irrigation or protection depending on the reasons."):tr("اتخذ إجراء قريب: راجع الإنذار المبكر وجدول الري.","Act soon: review the early warnings and the irrigation schedule.");
 var d=om.d,i0=om.i0;
 panel('<h3>'+ttl+' '+bd("fc")+'</h3><p class="note num" style="text-align:start">'+lat.toFixed(4)+'°N, '+lng.toFixed(4)+'°E</p>'+
  '<p style="margin:8px 0"><span class="sev '+sv.c+'">'+sv.s+' '+tr("الخطر: ","Risk: ")+sv.t+'</span></p>'+
  (w.why.length?'<p class="sm"><b>'+tr("ليه؟","Why?")+'</b></p><ul class="cl sm">'+w.why.map(function(x){return'<li>'+esc(x)+'</li>'}).join("")+'</ul>':'<p class="sm">'+tr("مفيش خطر ملحوظ خلال 7 أيام (الحرارة والمطر والرياح والري ضمن الحدود).","No notable risk in the next 7 days (temperature, rain, wind and irrigation are within limits).")+'</p>')+
  '<p class="sm" style="margin-top:8px"><b>'+tr("التوصية:","Advice:")+'</b> '+act+'</p>'+
  '<p class="sm"><b>'+tr("الري","Irrigation")+' ('+(f.crop?esc(FS.cn(f.crop)):"")+'):</b> '+(rec.due?esc(rec.head)+' ('+esc(rec.date)+') ≈ '+f0(rec.perFed)+' '+U.m3+'/'+tr("فدان","feddan")+' '+bd("calc"):tr("مفيش ري مطلوب خلال 7 أيام.","No irrigation needed in the next 7 days."))+'</p>'+
  '<div style="margin-top:8px">'+kv(tr("الحرارة الآن","Temperature now"),om.cur.temperature_2m!=null?N(om.cur.temperature_2m,U.c,1):"—")+kv(tr("عظمى / صغرى اليوم","High / low today"),'<span class="num">'+f0(d.temperature_2m_max[i0])+' / '+f0(d.temperature_2m_min[i0])+'</span> '+U.c)+kv(tr("مطر متوقع (7 أيام)","Expected rain (7 days)"),N(T.sumR,U.mm,1))+kv(tr("أقوى رياح","Strongest wind"),N(T.mxW,U.kmh))+kv(tr("التبخر ET₀ (7 أيام)","Evaporation ET₀ (7 days)"),N(c.et0,U.mm,1))+kv(tr("رطوبة التربة 3–9 سم","Soil moisture 3–9 cm"),om.sm!=null?N(om.sm*100,"%"):bd("na"))+'</div>'+
  '<p class="note" style="margin-top:8px">'+tr("بيانات نموذج توقعات بدقة عدة كيلومترات، مش قياس من حقلك. راجع مهندس زراعي قبل التنفيذ.","Forecast-model data at a few kilometres of resolution, not a measurement from your field. Consult an agronomist before acting.")+'</p>')
}

/* ---------- layer switching ---------- */
function setOpacity(){var v=$("op").value/100;["ndviP","riskP","irrP","heatP"].forEach(function(p){if(M&&M.getPane(p))M.getPane(p).style.opacity=v})}
function setLayer(l){
 if(l==layer)return;
 layer=l;hold="";
 [].forEach.call($("layers").children,function(b){b.setAttribute("aria-pressed",b.dataset.l==l)});
 $("hv").style.display=l=="heat"?"":"none";$("mapop").style.display=l=="sat"?"none":"";
 if(!init())return;
 ["ndvi","risk","irr","heat"].forEach(function(k){if(M.hasLayer(L_[k]))M.removeLayer(L_[k])});
 if(l!="sat")L_[l].addTo(M);
 if((l=="risk"||l=="heat")&&FS.hasFarm()&&gridKey!==key)startGrid();
 setOpacity();legend();tag();panel();drawIrr();drawHeat()
}
FS.mapLayer=function(l){setLayer(l)};
function startGrid(){var f=FS.farm();gridKey=key;loadGrid(f.lat,f.lng)}

function update(){
 if(!M&&!init())return;
 var f=FS.farm();
 if(!FS.hasFarm()){panel();legend();tag();return}
 var k=f.lat.toFixed(4)+","+f.lng.toFixed(4);
 if(k!==key){key=k;hold="";G=null;gst="idle";gridKey="";L_.risk.clearLayers();L_.heat.clearLayers();
  M.setView([f.lat,f.lng],11);if(probeMk){M.removeLayer(probeMk);probeMk=null}
  if(layer=="risk"||layer=="heat")startGrid()}
 drawPin();drawFields();drawIrr();if(layer=="risk"&&G)drawGrid();if(layer=="heat"&&G)drawHeat();
 panel();
 if(f.poly&&fitKey!==key){fitKey=key;try{M.fitBounds(L.polygon(f.poly).getBounds(),{maxZoom:15,padding:[50,50]})}catch(e){}}
}

$("layers").onclick=function(e){var b=e.target.closest("button[data-l]");if(b)setLayer(b.dataset.l)};
$("hv").onclick=function(e){var b=e.target.closest("button[data-v]");if(!b)return;hv=b.dataset.v;[].forEach.call(this.children,function(x){x.setAttribute("aria-pressed",x===b)});hold="";drawHeat();legend();tag();panel()};
$("op").oninput=setOpacity;
init();setLayer("heat");
FS.on("update",update);update();
})();
