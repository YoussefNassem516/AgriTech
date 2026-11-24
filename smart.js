/* Field Shift — smart farm engine + dashboard + analytics + home snapshot.
   Water balance (FAO-56), early warnings, what-if scenarios. Real data only: Open-Meteo forecast + NASA POWER history.
   Anything that is an assumption is labelled "estimate". Nothing here is a sensor measurement.
   Every user-visible string is bilingual via tr(arabic, english). */
(function(){
"use strict";
var FS=window.FS,$=FS.$,nz=FS.nz,N=FS.N,bd=FS.bd,f0=FS.f0,f1=FS.f1,esc=FS.esc,tr=FS.T,U=FS.U;
var WD=tr(["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"],["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]);
FS.dayName=function(iso){var d=new Date(iso+"T12:00:00");return WD[d.getDay()]+" "+iso.slice(8,10)+"/"+iso.slice(5,7)};
FS.rel=function(c,i){var x=i-c.i0;return x<=0?tr("النهارده","today"):x==1?tr("بكرة","tomorrow"):x==2?tr("بعد يومين","in 2 days"):tr("بعد "+x+" أيام","in "+x+" days")};
var SEV=[{c:"g",t:tr("منخفض","Low"),s:"✓"},{c:"y",t:tr("متوسط","Medium"),s:"!"},{c:"r",t:tr("مرتفع","High"),s:"▲"}];
FS.SEV=SEV;

/* ================= FAO-56 water balance =================
   ETc = Kc x ET0 ; effective rain = 80% of days with >= 2 mm ; Dr = root-zone depletion (mm), irrigation when Dr >= RAW. */
function water(om,f){
 var d=om.d,n=d.time.length,i0=om.i0,kc=FS.kcOf(f.crop,f.stage),raw=FS.SOILS[f.soil].raw,eff=FS.METHODS[f.method].eff,i,x=0,etc=[],pe=[];
 for(i=0;i<n;i++){etc[i]=kc*nz(d.et0_fao_evapotranspiration[i]);var p=nz(d.precipitation_sum[i]);pe[i]=p<2?0:.8*p}
 var back=(f.last!=null&&f.last!=="unk"&&+f.last>=0)?Math.min(7,+f.last):7,start=Math.max(0,i0-back);
 for(i=start;i<i0;i++)x=Math.min(raw,Math.max(0,x+etc[i]-pe[i]));
 var D0=x,ev=[],dr=[],e7=0,p7=0,et0=0;
 for(i=i0;i<n;i++){x=Math.max(0,x+etc[i]-pe[i]);e7+=etc[i];p7+=pe[i];et0+=nz(d.et0_fao_evapotranspiration[i]);dr.push(Math.min(x,raw));if(x>=raw){ev.push(i);x=0}}
 var net=Math.max(0,e7-p7);
 return{n:n,i0:i0,kc:kc,raw:raw,eff:eff,D0:D0,ev:ev,dr:dr,etc:etc,pe:pe,e7:e7,p7:p7,et0:et0,net:net,gross:net/eff,back:back}
}
FS.water=water;

function fcSlice(om,k){return om.d[k].slice(om.i0).filter(function(v){return v!=null})}
function stats(om){
 var tx=fcSlice(om,"temperature_2m_max"),tn=fcSlice(om,"temperature_2m_min"),r=fcSlice(om,"precipitation_sum"),w=fcSlice(om,"wind_speed_10m_max"),pp=fcSlice(om,"precipitation_probability_max");
 var mx=function(a){return a.length?Math.max.apply(null,a):null},mi=function(a){return a.length?Math.min.apply(null,a):null};
 var ix=function(a,v){return a.indexOf(v)+om.i0};
 var T={mxT:mx(tx),mnT:mi(tn),mxR:mx(r)||0,sumR:FS.sum(r),mxW:mx(w),mxP:mx(pp),hot:tx.filter(function(v){return v>=35}).length};
 T.iT=T.mxT==null?om.i0:ix(tx,T.mxT);T.iN=T.mnT==null?om.i0:ix(tn,T.mnT);T.iR=ix(r,T.mxR);T.iW=T.mxW==null?om.i0:ix(w,T.mxW);
 return T
}
FS.stats=stats;

/* ================= early-warning rules (each needs supporting data) ================= */
function warnings(om,f,nasa){
 var c=water(om,f),T=stats(om),d=om.d,W=[],cn=FS.cn(f.crop),dn=FS.dayName,C=U.c,MM=U.mm;
 var add=function(sev,key,title,what,why,act,data){W.push({sev:sev,key:key,title:title,what:what,why:why,act:act,data:data})};
 var srcOM=tr("المصدر: توقع Open-Meteo","Source: Open-Meteo forecast"),srcFAO=tr("المصدر: حساب FAO-56 (محسوب)","Source: FAO-56 calculation");
 if(T.mxT!=null&&T.mxT>=35){
  add(T.mxT>=40?2:1,"heat",tr("ارتفاع الحرارة","High temperature"),
   tr("أعلى حرارة متوقعة "+f0(T.mxT)+" °م يوم "+dn(d.time[T.iT])+" ("+T.hot+" يوم فوق 35 °م خلال 7 أيام).","Highest expected temperature is "+f0(T.mxT)+" °C on "+dn(d.time[T.iT])+" ("+T.hot+" day(s) above 35 °C in the next 7 days)."),
   tr("الحرارة العالية بتزوّد استهلاك "+cn+" للمياه وبتجهد النبات"+(f.crop=="tomato"?"، وممكن تسبب تساقط الأزهار.":f.crop=="potato"?"، وبتقلل تكوين الدرنات.":f.crop=="wheat"?"، وبتقصّر فترة امتلاء الحبوب.":"."),
      "High heat increases water use of "+cn.toLowerCase()+" and stresses the plant"+(f.crop=="tomato"?", and can cause flower drop.":f.crop=="potato"?", and reduces tuber formation.":f.crop=="wheat"?", and shortens grain filling.":".")),
   tr("اروي بعد الغروب أو بالليل، أجّل التسميد والرش، وراقب الذبول وقت الظهر.","Irrigate after sunset or at night, postpone fertilising and spraying, and watch for midday wilting."),
   [tr("أعلى حرارة: "+f0(T.mxT)+" °م","Highest temperature: "+f0(T.mxT)+" °C"),tr("عدد الأيام فوق 35 °م: "+T.hot,"Days above 35 °C: "+T.hot),srcOM])}
 if(T.mnT!=null&&T.mnT<=4){
  add(T.mnT<=2?2:1,"cold",tr("خطر برودة أو صقيع","Cold or frost risk"),
   tr("أدنى حرارة متوقعة "+f0(T.mnT)+" °م ليلة "+dn(d.time[T.iN])+".","Lowest expected temperature is "+f0(T.mnT)+" °C on the night of "+dn(d.time[T.iN])+"."),
   tr("البرودة بتضر الشتلات الصغيرة والأزهار، والصقيع بيحرق الأوراق.","Cold damages young seedlings and flowers, and frost burns leaves."),
   tr("غطّي الشتلات الحساسة، وتجنب الري الليلي في الأيام الباردة.","Cover sensitive seedlings and avoid night irrigation on cold days."),
   [tr("أدنى حرارة: "+f0(T.mnT)+" °م","Lowest temperature: "+f0(T.mnT)+" °C"),srcOM])}
 if(T.mxR>=10){
  add(T.mxR>=20?2:1,"rain",tr("أمطار غزيرة","Heavy rain"),
   tr("أقصى مطر يومي متوقع "+f1(T.mxR)+" مم يوم "+dn(d.time[T.iR])+" (إجمالي 7 أيام: "+f1(T.sumR)+" مم).","Heaviest expected daily rain is "+f1(T.mxR)+" mm on "+dn(d.time[T.iR])+" (7-day total: "+f1(T.sumR)+" mm)."),
   tr("المطر الغزير ممكن يعمل تغريق وتآكل للتربة ويغسل السماد، وبيزوّد الأمراض الفطرية.","Heavy rain can waterlog and erode soil, wash away fertiliser and favour fungal diseases."),
   tr("أجّل الري والتسميد والرش قبل المطر، وتأكد من تصريف المياه من الأرض.","Postpone irrigation, fertilising and spraying before the rain, and make sure the field drains."),
   [tr("أقصى مطر يومي: "+f1(T.mxR)+" مم","Max daily rain: "+f1(T.mxR)+" mm"),tr("احتمال المطر الأقصى: "+(T.mxP==null?"غير متاح":f0(T.mxP)+"%"),"Max rain probability: "+(T.mxP==null?"N/A":f0(T.mxP)+"%")),srcOM])}
 if(c.ev.length&&c.ev[0]-c.i0<=6){
  var dd=c.ev[0]-c.i0,sev=dd<=2?2:1;
  add(sev,"irr",sev==2?tr("احتمال إجهاد مائي","Possible water stress"):tr("ريّة مطلوبة قريبًا","Irrigation needed soon"),
   tr("رصيد المياه المتاح للنبات في التربة بيوصل للحد الحرج "+FS.rel(c,c.ev[0])+" ("+dn(d.time[c.ev[0]])+") لو متروّيتش.","Plant-available soil water reaches the critical level "+FS.rel(c,c.ev[0])+" ("+dn(d.time[c.ev[0]])+") if you do not irrigate."),
   tr("لو الرطوبة نزلت عن الحد الحرج، النبات بيقفل مسامه ويقل نموه وإنتاجه.","Below the critical level the plant closes its stomata and growth and yield drop."),
   tr("جهّز الري حسب موعد «محسّن الري». لو متوقع مطر قبل الموعد، استنى.","Prepare irrigation using the Irrigation tab date. If rain is expected before then, wait."),
   [tr("الاستنزاف الحالي: "+f0(c.D0)+" من "+c.raw+" مم (الحد الحرج)","Current depletion: "+f0(c.D0)+" of "+c.raw+" mm (critical level)"),tr("استهلاك المحصول ETc لـ 7 أيام: "+f1(c.e7)+" مم","Crop use ETc for 7 days: "+f1(c.e7)+" mm"),tr("المطر الفعّال المتوقع: "+f1(c.p7)+" مم","Expected effective rain: "+f1(c.p7)+" mm"),srcFAO])}
 else if(!c.ev.length&&c.D0>=.8*c.raw){
  add(1,"irr",tr("استنزاف مرتفع للرطوبة","High soil moisture depletion"),
   tr("الاستنزاف الحالي "+f0(c.D0)+" من "+c.raw+" مم، قريب من الحد الحرج.","Current depletion is "+f0(c.D0)+" of "+c.raw+" mm, close to the critical level."),
   tr("التربة قربت تفقد الماء المتاح للنبات.","The soil is close to running out of plant-available water."),
   tr("خطّط لريّة خفيفة قريبة.","Plan a light irrigation soon."),
   [tr("الاستنزاف: "+f0(c.D0)+" / "+c.raw+" مم","Depletion: "+f0(c.D0)+" / "+c.raw+" mm"),srcFAO])}
 if(T.mxW!=null&&T.mxW>=40){
  add(T.mxW>=60?2:1,"wind",tr("رياح قوية","Strong wind"),
   tr("أقوى رياح متوقعة "+f0(T.mxW)+" كم/س يوم "+dn(d.time[T.iW])+".","Strongest expected wind is "+f0(T.mxW)+" km/h on "+dn(d.time[T.iW])+"."),
   tr("الرياح القوية بتكسّر النباتات الطويلة (زي الذرة)، وبتبعثر مياه الرش وبتزوّد البخر.","Strong wind breaks tall plants (like corn), scatters sprinkler water and increases evaporation."),
   tr("تجنب الري بالرش والرش بالمبيدات في وقت الرياح، وادعم النباتات الطويلة.","Avoid sprinkler irrigation and spraying during the wind, and support tall plants."),
   [tr("أقوى رياح: "+f0(T.mxW)+" كم/س","Strongest wind: "+f0(T.mxW)+" km/h"),srcOM])}
 if(nasa&&nasa.st=="ok"&&nasa.usual){
  var df=nasa.temp-nasa.usual.temp,nd=[tr("آخر 30 يوم: "+f1(nasa.temp)+" °م","Last 30 days: "+f1(nasa.temp)+" °C"),tr("المعتاد ("+nasa.usual.n+" سنين): "+f1(nasa.usual.temp)+" °م","Usual ("+nasa.usual.n+" yrs): "+f1(nasa.usual.temp)+" °C"),tr("المصدر: NASA POWER (بيانات تاريخية)","Source: NASA POWER (historical data)")];
  if(df>=2)add(df>=4?2:1,"unusual",tr("حرارة أعلى من المعتاد","Warmer than usual"),
   tr("متوسط حرارة آخر 30 يوم "+f1(nasa.temp)+" °م، أعلى من المعتاد بـ "+f1(df)+" °م.","The 30-day average temperature is "+f1(nasa.temp)+" °C, "+f1(df)+" °C above usual."),
   tr("الطقس غير معتاد لنفس الفترة، فمواعيد النمو والري ممكن تتغير.","The weather is unusual for this period, so growth and irrigation timing may shift."),
   tr("راقب النبات أكتر وزوّد متابعة رطوبة التربة.","Watch the crop more closely and check soil moisture more often."),nd);
  else if(df<=-3)add(1,"unusual",tr("برودة أكتر من المعتاد","Cooler than usual"),
   tr("متوسط حرارة آخر 30 يوم "+f1(nasa.temp)+" °م، أقل من المعتاد بـ "+f1(-df)+" °م.","The 30-day average temperature is "+f1(nasa.temp)+" °C, "+f1(-df)+" °C below usual."),
   tr("النمو ممكن يتأخر عن الميعاد المعتاد.","Growth may be later than usual."),
   tr("تابع مواعيد الإنبات والتسميد وأجّلها لو لزم.","Track germination and fertilising dates and postpone them if needed."),nd)}
 W.sort(function(a,b){return b.sev-a.sev});
 var L=W.length?W[0].sev:0;
 if(!W.length)W.push({sev:0,key:"ok",title:tr("مفيش خطر ملحوظ خلال 7 أيام","No notable risk in the next 7 days"),
  what:tr("الحرارة والمطر والرياح والميزان المائي ضمن الحدود المقبولة.","Temperature, rain, wind and the water balance are within acceptable limits."),
  why:tr("مفيش ظرف جوي أو مائي بيهدد المحصول حسب التوقعات الحالية.","No weather or water condition threatens the crop in the current forecast."),
  act:tr("كمّل متابعتك العادية وراجع اللوحة كل يوم.","Carry on as usual and check the dashboard daily."),
  data:[tr("الحرارة: بين "+f0(T.mnT)+" و "+f0(T.mxT)+" °م","Temperature: "+f0(T.mnT)+" to "+f0(T.mxT)+" °C"),tr("المطر المتوقع: "+f1(T.sumR)+" مم","Expected rain: "+f1(T.sumR)+" mm"),tr("أقوى رياح: "+f0(T.mxW)+" كم/س","Strongest wind: "+f0(T.mxW)+" km/h"),tr("الاستنزاف الحالي: "+f0(c.D0)+" من "+c.raw+" مم","Current depletion: "+f0(c.D0)+" of "+c.raw+" mm")]});
 return{W:W,L:L,c:c,T:T}
}
FS.risk=function(om,f){var r=warnings(om,f,null);return{L:r.L,why:r.W.filter(function(w){return w.sev>0}).map(function(w){return w.title+": "+w.what}),c:r.c,T:r.T}};

/* ================= irrigation recommendation ================= */
function irrRec(c,om,f){
 var A=FS.area(),d=om.d,g=c.raw/c.eff,r={c:c,g:g,perFed:g*4.2,total:g*A.ha*10};
 if(c.ev.length){
  var i=c.ev[0],dd=i-c.i0,tmx=nz(d.temperature_2m_max[i]),rn=nz(d.precipitation_sum[i])+nz(d.precipitation_sum[i+1]);
  r.due=true;r.i=i;r.dd=dd;r.S=dd<=2?2:dd<=6?1:0;r.when=FS.rel(c,i);r.date=FS.dayName(d.time[i]);
  r.tod=tmx>=32?tr("بعد الغروب أو بالليل (لتقليل التبخر)","after sunset or at night (less evaporation)"):tr("بدري الصبح","early morning");
  r.rainNote=rn>=5?tr("متوقع مطر "+f1(rn)+" مم حوالين الموعد ده، فيفضل تستنى وتشوف.",f1(rn)+" mm of rain is expected around this date, so it is better to wait and see."):"";
  r.windNote=nz(d.wind_speed_10m_max[i])>=30?tr("رياح قوية متوقعة: تجنب الري بالرش.","Strong wind expected: avoid sprinkler irrigation."):"";
  r.head=dd<=0?tr("اروي النهارده","Irrigate today"):dd==1?tr("اروي بكرة","Irrigate tomorrow"):tr("الريّة الجاية "+r.when,"Next irrigation "+r.when)
 }else{r.due=false;r.S=0;r.head=tr("مفيش ري مطلوب خلال 7 أيام","No irrigation needed in the next 7 days");r.when=tr("مش مطلوب","not needed")}
 return r
}
FS.irrRec=irrRec;

/* ================= what-if scenarios (next 7 days) ================= */
FS.cover=.9;
function scenarios(c,f){
 var A=FS.area(),ha=A.ha,ky=FS.CROPS[f.crop].ky,m=FS.METHODS[f.method],net=c.net,price=f.price>0?f.price:null;
 var mk=function(name,short,tag,gross,eff,note){
  var applied=gross*eff,ratio=c.e7>0?Math.min(1,(applied+c.p7)/c.e7):1,m3=gross*ha*10,loss=ky*(1-ratio)*100,over=Math.max(0,applied-net);
  return{name:name,short:short,tag:tag,gross:gross,applied:applied,ratio:ratio,m3:m3,perFed:gross*4.2,cost:price?m3*price:null,loss:loss,over:over,overM3:over/eff*ha*10,note:note}};
 var cur=mk(tr("الري الحالي","Current irrigation"),tr("الحالي","Current"),tr("طريقتك الحالية: ","Your method: ")+m.n,nz(f.cnt)*nz(f.depth),m.eff,tr("زي ما أدخلته: "+f0(f.cnt)+" ريّة × "+f0(f.depth)+" مم في الأسبوع","As entered: "+f0(f.cnt)+" irrigations × "+f0(f.depth)+" mm per week"));
 var opt=mk(tr("الري المحسّن","Optimised irrigation"),tr("المحسّن","Optimised"),tr("نفس طريقتك لكن بالاحتياج الفعلي","Same method, actual crop need"),net/m.eff,m.eff,tr("الاحتياج الصافي ÷ كفاءة طريقتك","Net need ÷ your method's efficiency"));
 var sav=mk(tr("سيناريو توفير المياه","Water-saving scenario"),tr("التوفير","Saving"),tr("تنقيط + تغطية "+Math.round(FS.cover*100)+"% من الاحتياج","Drip + "+Math.round(FS.cover*100)+"% of need"),FS.cover*net/.9,.9,tr("ري ناقص متحكَّم فيه بالتنقيط","Controlled deficit irrigation with drip"));
 return{cur:cur,opt:opt,sav:sav,A:A,price:price}
}
FS.scenarios=scenarios;

/* ================= analysis cache (used by dashboard, map, chat) ================= */
var cache=null,ckey="";
FS.analysis=function(){
 var D=FS.data,f=FS.farm();
 if(!FS.hasFarm())return{st:"nofarm"};
 if(!D.om||D.om.st=="load"||D.om.st=="idle")return{st:"load"};
 if(D.om.st!="ok")return{st:"err"};
 var k=JSON.stringify([f,D.om.ts,D.nasa&&D.nasa.st,FS.cover]);
 if(k===ckey&&cache)return cache;
 var w=warnings(D.om,f,D.nasa),c=w.c,rec=irrRec(c,D.om,f);
 cache={st:"ok",om:D.om,f:f,c:c,W:w.W,L:w.L,T:w.T,rec:rec,sc:scenarios(c,f),A:FS.area()};ckey=k;return cache
};

/* ================= SVG chart (theme-aware: colours come from CSS variables) ================= */
function nice(mx){if(mx<=0)return 1;var p=Math.pow(10,Math.floor(Math.log10(mx))),m=mx/p;return(m<=1?1:m<=2?2:m<=5?5:10)*p}
function chart(o){
 var W=640,H=o.h||300,ml=58,mr=14,mt=26,mb=54,n=o.dates.length,pw=W-ml-mr,ph=H-mt-mb,all=[0];
 (o.bars||[]).forEach(function(b){all=all.concat(b.v.map(nz))});(o.lines||[]).forEach(function(l){all=all.concat(l.v.filter(function(x){return x!=null}))});if(o.hline!=null)all.push(o.hline);
 var mx=Math.max.apply(null,all),mn=o.min!=null?o.min:Math.min.apply(null,all.concat([0]));
 if(o.min==null&&mn<0)mn=Math.floor(mn/5)*5;
 var span=mx-mn||1,step=nice(span/4),top=Math.ceil(mx/step)*step;if(top<=mn)top=mn+step;
 var X=function(i){return ml+(i+.5)*pw/n},Y=function(v){return mt+(top-v)/(top-mn)*ph},s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.label)+'" style="direction:ltr" font-family="Cairo,Inter,sans-serif">';
 s+='<rect x="'+(ml+o.i0*pw/n)+'" y="'+mt+'" width="'+((n-o.i0)*pw/n)+'" height="'+ph+'" fill="var(--band)"/>';
 for(var v=mn;v<=top+1e-9;v+=step){var y=Y(v);s+='<line x1="'+ml+'" x2="'+(W-mr)+'" y1="'+y+'" y2="'+y+'" stroke="var(--ln)"/><text x="'+(ml-8)+'" y="'+(y+5)+'" font-size="17" text-anchor="end" fill="var(--mu)">'+(+v.toFixed(1))+'</text>'}
 s+='<text x="6" y="'+(mt-6)+'" font-size="15" fill="var(--mu)">'+o.unit+'</text>';
 (o.bars||[]).forEach(function(b){var bw=Math.min(22,pw/n*.6);b.v.forEach(function(x,i){var h=Math.max(0,Y(0)-Y(nz(x)));if(h>0)s+='<rect x="'+(X(i)-bw/2)+'" y="'+Y(nz(x))+'" width="'+bw+'" height="'+h+'" rx="3" fill="'+b.c+'" opacity="'+(i<o.i0?.55:.95)+'"/>'})});
 if(o.hline!=null){var hy=Y(o.hline);s+='<line x1="'+ml+'" x2="'+(W-mr)+'" y1="'+hy+'" y2="'+hy+'" stroke="'+(o.hc||"#D64545")+'" stroke-width="2" stroke-dasharray="6 5"/><text x="'+(W-mr-2)+'" y="'+(hy-6)+'" font-size="15" font-weight="700" text-anchor="end" fill="'+(o.hc||"#D64545")+'">'+o.hl+'</text>'}
 (o.lines||[]).forEach(function(l){var pts=l.v.map(function(x,i){return x==null?null:X(i).toFixed(1)+","+Y(x).toFixed(1)}).filter(Boolean);
  s+='<polyline fill="none" stroke="'+l.c+'" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"'+(l.dash?' stroke-dasharray="7 5"':'')+' points="'+pts.join(" ")+'"/>';
  l.v.forEach(function(x,i){if(x!=null&&(i==o.i0||l.dots))s+='<circle cx="'+X(i)+'" cy="'+Y(x)+'" r="5" fill="var(--sf)" stroke="'+l.c+'" stroke-width="3"/>'})});
 o.dates.forEach(function(dt,i){var lab=dt.slice(8,10)+"/"+dt.slice(5,7);if(i%2==(o.i0%2)||i==n-1&&n<9)s+='<text x="'+X(i)+'" y="'+(H-mb+24)+'" font-size="15" text-anchor="middle" fill="'+(i==o.i0?"var(--g)":"var(--mu)")+'" font-weight="'+(i==o.i0?800:400)+'">'+(i==o.i0?tr("اليوم","Today"):lab)+'</text>';
  var tip=dt+" — "+(o.bars||[]).map(function(b){return b.l+": "+f1(nz(b.v[i]))+" "+o.unit}).concat((o.lines||[]).map(function(l){return l.l+": "+(l.v[i]==null?"—":f1(l.v[i]))+" "+o.unit})).join(" · ");
  s+='<rect x="'+(X(i)-pw/n/2)+'" y="'+mt+'" width="'+(pw/n)+'" height="'+ph+'" fill="transparent"><title>'+esc(tip)+'</title></rect>'});
 s+='<text x="'+(ml+4)+'" y="'+(H-6)+'" font-size="15" fill="var(--mu)">◀ '+tr("الأيام الماضية","Past days")+'</text><text x="'+(W-mr-4)+'" y="'+(H-6)+'" font-size="15" font-weight="700" text-anchor="end" fill="var(--g)">'+tr("التوقع","Forecast")+' ▶</text></svg>';
 return s
}
var lg=function(a){return'<div class="lg">'+a.map(function(x){return'<span><i style="background:'+x[0]+'"></i>'+x[1]+'</span>'}).join("")+'</div>'};
FS.chart=chart;

/* ================= shared bits ================= */
function empty(t,p,btn,href){return'<div class="empty"><h3>'+t+'</h3><p class="mu">'+p+'</p>'+(btn?'<a class="btn lg" href="'+href+'">'+btn+'</a>':'')+'</div>'}
var NOFARM=function(){return empty(tr("لسه مفيش مزرعة محددة","No farm set yet"),tr("حدّد مكان مزرعتك والمحصول عشان نحسب لك الري والمخاطر.","Set your farm location and crop so we can work out irrigation and risks."),tr("إدخال بيانات المزرعة","Set up my farm"),"farm.html")};
var LOADING=function(t){return'<div class="empty"><h3><span class="spin"></span>'+t+'</h3></div>'};
var ERR=function(){return'<div class="empty"><h3>'+tr("تعذّر جلب بيانات الطقس","Could not load weather data")+'</h3><p class="mu">'+tr("مقدرناش نوصل لخدمة Open-Meteo. اتأكد من الإنترنت وجرّب تاني. مبنعرضش أرقام بديلة.","We could not reach Open-Meteo. Check your connection and try again. We never show made-up numbers.")+'</p><button class="btn lg" id="retry">'+tr("إعادة المحاولة","Try again")+'</button></div>'};
function hookRetry(){var b=$("retry");if(b)b.onclick=function(){FS.refresh(true)}}
function timeStr(ts){return ts?new Date(ts).toLocaleTimeString(FS.lang==="en"?"en-GB":"ar-EG-u-nu-latn",{hour:"2-digit",minute:"2-digit"}):"—"}

/* ================= Dashboard (simplified: one decision, four numbers, alerts, two charts) ================= */
function kpi(o){return'<div class="card kpi s-'+(o.s||"n")+'"><div class="kh"><span class="ico">'+FS.icon(o.i)+'</span><b>'+o.t+'</b>'+(o.b||"")+'<span class="info" title="'+esc(o.w)+'" tabindex="0">'+FS.icon("info")+'</span></div><div class="v">'+o.v+'</div><div class="s">'+o.sub+'</div>'+(o.x||"")+'</div>'}
function renderDash(){
 var el=$("dash");if(!el)return;
 var a=FS.analysis(),f=FS.farm();
 if(a.st=="nofarm")return el.innerHTML=NOFARM();
 if(a.st=="load")return el.innerHTML=LOADING(tr("جاري جلب بيانات الطقس لمزرعتك…","Loading your farm's weather…"));
 if(a.st=="err"){el.innerHTML=ERR();return hookRetry()}
 var om=a.om,cur=om.cur||{},c=a.c,T=a.T,A=a.A,rec=a.rec,d=om.d,i0=om.i0,cn=FS.cn(f.crop),C=U.c,MM=U.mm,M3=U.m3;
 var tdMax=d.temperature_2m_max[i0],tdMin=d.temperature_2m_min[i0],nAct=a.W.filter(function(w){return w.sev>0}),shown=(nAct.length?nAct:[a.W[0]]).slice(0,3);
 var h='<div class="dhead"><div><h2>'+esc(f.name||tr("مزرعتك","Your farm"))+' · '+esc(cn)+'</h2><div class="dmeta"><span class="pill">'+N(A.fed,U.fed,1)+(A.src=="default"?" ("+tr("افتراض","assumed")+")":"")+'</span><span class="pill">'+esc(FS.short(FS.SOILS[f.soil].n))+'</span><span class="pill">'+esc(FS.short(FS.METHODS[f.method].n))+'</span><span class="t">'+tr("آخر تحديث ","Updated ")+timeStr(om.ts)+'</span></div></div>'+
  '<div class="dact"><button class="btn gh sm" id="refresh" type="button">'+FS.icon("refresh")+tr("تحديث","Refresh")+'</button><a class="btn gh sm" href="farm.html">'+tr("تعديل المزرعة","Edit farm")+'</a></div></div>';
 /* top row: the decision + weather now */
 h+='<div class="dtop"><div class="card rec"><div class="lab">'+FS.icon("drop")+tr("نصيحة الري","Irrigation advice")+'</div><div class="head">'+esc(rec.head)+'</div>'+
  '<div class="when">'+(rec.due?esc(rec.date)+' · '+tr("الأفضل: ","Best: ")+esc(rec.tod):tr("الاستنزاف "+f0(c.D0)+" من "+c.raw+" مم، ومش هيوصل للحد الحرج.","Depletion is "+f0(c.D0)+" of "+c.raw+" mm and will not reach the critical level."))+'</div>'+
  (rec.due?'<div class="nums"><div><small>'+tr("للفدان","Per feddan")+'</small><b>'+N(rec.perFed,M3)+'</b></div><div><small>'+tr("للمساحة كلها","Whole area")+'</small><b>'+N(rec.total,M3)+'</b></div></div>':'')+
  (rec.rainNote?'<p class="nt">🌧 '+esc(rec.rainNote)+'</p>':'')+(rec.windNote?'<p class="nt">💨 '+esc(rec.windNote)+'</p>':'')+
  '<a class="btn wh sm" href="analytics.html#irrigation">'+tr("شوف الحساب","See the calculation")+'</a></div>'+
  '<div class="card now"><div class="kh"><span class="ico">'+FS.icon("sun")+'</span><b>'+tr("الطقس دلوقتي","Weather now")+'</b>'+bd("api")+'</div><div class="big">'+N(cur.temperature_2m,C,0)+'</div><div class="cond">'+esc(FS.wcode(cur.weather_code))+'</div>'+
  '<div class="row3"><div><b>'+N(cur.relative_humidity_2m,"%")+'</b>'+tr("رطوبة","Humidity")+'</div><div><b>'+N(cur.wind_speed_10m,U.kmh)+'</b>'+tr("رياح","Wind")+'</div><div><b>'+N(cur.apparent_temperature,"°")+'</b>'+tr("الإحساس","Feels like")+'</div></div></div></div>';
 /* four key numbers */
 h+='<div class="grid g4" style="margin-bottom:16px">'+
  kpi({i:"temp",t:tr("الحرارة","Temperature"),b:bd("fc"),s:T.mxT>=40?"r":T.mxT>=35||T.mnT<=4?"y":"g",v:N(tdMax,C),sub:tr("صغرى "+f0(tdMin)+" · أعلى حرارة في 7 أيام "+f0(T.mxT),"Low "+f0(tdMin)+" · 7-day high "+f0(T.mxT)),w:tr("الحرارة فوق 35°م بتجهد أغلب المحاصيل، وتحت 4°م فيها خطر برودة.","Above 35 °C stresses most crops; below 4 °C there is a cold risk.")})+
  kpi({i:"rain",t:tr("مطر 7 أيام","Rain, 7 days"),b:bd("fc"),s:T.mxR>=20?"r":T.mxR>=10?"y":"g",v:N(T.sumR,MM,1),sub:T.sumR<1?tr("مفيش مطر متوقع","No rain expected"):tr("أقصى يوم "+f1(T.mxR)+" مم ("+FS.dayName(d.time[T.iR])+")","Heaviest day "+f1(T.mxR)+" mm ("+FS.dayName(d.time[T.iR])+")"),w:tr("المطر الفعّال هو اللي النبات بيستفيد منه: 80% من الأيام اللي فيها 2 مم أو أكتر.","Effective rain is what the plant can use: 80% of days with 2 mm or more.")})+
  kpi({i:"chart",t:tr("احتياج المياه","Water need"),b:bd("calc"),s:"n",v:N(c.net*A.ha*10,M3),sub:tr("للمساحة كلها هذا الأسبوع ("+f1(c.net)+" مم صافي)","for the whole area this week ("+f1(c.net)+" mm net)"),w:tr("الاحتياج = (Kc × ET₀) − المطر الفعّال. 1 مم = 4.2 م³ للفدان. كفاءة طريقتك "+Math.round(c.eff*100)+"%.","Need = (Kc × ET₀) − effective rain. 1 mm = 4.2 m³ per feddan. Your method's efficiency is "+Math.round(c.eff*100)+"%.")})+
  kpi({i:"grid",t:tr("رطوبة التربة","Soil moisture"),b:bd("calc"),s:c.D0>=.8*c.raw?"y":"g",v:N(c.D0,MM),sub:tr("استنزاف من الحد الحرج "+c.raw+" مم","depleted of the "+c.raw+" mm critical level"),x:'<div class="meter" role="img" aria-label="'+Math.round(c.D0/c.raw*100)+'%"><i style="width:'+Math.min(100,Math.max(3,c.D0/c.raw*100))+'%"></i></div>',w:tr("حساب ميزان مائي FAO-56، مش قراءة حساس في أرضك.","FAO-56 water balance — not a sensor reading from your field.")})+'</div>';
 /* alerts */
 h+='<div class="card" style="margin-bottom:16px"><div class="hd2"><h3>'+tr("التنبيهات","Alerts")+'</h3><span class="sev '+SEV[a.L].c+'">'+SEV[a.L].s+' '+SEV[a.L].t+'</span></div>'+
  shown.map(function(w){var sv=SEV[w.sev];return'<div class="al"><i class="dot '+sv.c+'"></i><div><b>'+esc(w.title)+'</b><span>'+esc(w.act)+'</span></div></div>'}).join("")+
  '<p style="margin-top:12px"><a class="btn sm gh" href="analytics.html#warnings">'+tr("كل التنبيهات والبيانات","All alerts and data")+'</a></p></div>';
 /* charts */
 h+='<div class="grid g2"><div class="card chart"><h3>'+tr("درجات الحرارة","Temperature")+' '+bd("fc")+'</h3><p class="note" style="margin-bottom:8px">'+tr("الخط الأحمر المتقطع هو 35°م: فوقه الحرارة بتجهد النبات.","The dashed red line is 35 °C: above it heat stresses the plant.")+'</p>'+
  chart({dates:d.time,i0:i0,unit:C,label:tr("درجات الحرارة العظمى والصغرى","Maximum and minimum temperature"),lines:[{v:d.temperature_2m_max,c:"#D64545",l:tr("العظمى","High"),dots:true},{v:d.temperature_2m_min,c:"#3B82D0",l:tr("الصغرى","Low"),dots:true}],hline:35,hl:"35"+C,min:0})+lg([["#D64545",tr("العظمى","High")],["#3B82D0",tr("الصغرى","Low")]])+'</div>'+
  '<div class="card chart"><h3>'+tr("المطر مقابل احتياج المحصول","Rain vs. crop need")+' '+bd("calc")+'</h3><p class="note" style="margin-bottom:8px">'+tr("لما الخط الأخضر (ETc) يعلا عن الأعمدة الزرقاء (المطر) النبات محتاج ري.","When the green line (ETc) rises above the blue bars (rain), the crop needs irrigation.")+'</p>'+
  chart({dates:d.time,i0:i0,unit:MM,label:tr("المطر واحتياج المحصول","Rain and crop need"),bars:[{v:d.precipitation_sum,c:"#3B82D0",l:tr("المطر","Rain")}],lines:[{v:c.etc,c:"#2FA34F",l:"ETc"}],min:0})+lg([["#3B82D0",tr("مطر (مم)","Rain (mm)")],["#2FA34F",tr("احتياج المحصول ETc (مم/يوم)","Crop need ETc (mm/day)")]])+'</div></div>';
 el.innerHTML=h;
 $("refresh").onclick=function(){FS.refresh(true);FS.toast(tr("بنحدّث البيانات…","Refreshing data…"))};
}

/* ================= Analytics ================= */
function tbl(rows,head){return'<table class="t">'+(head?'<tr>'+head.map(function(x,i){return'<th'+(i?' class="v"':'')+'>'+x+'</th>'}).join("")+'</tr>':'')+rows.map(function(r){return'<tr>'+r.map(function(x,i){return'<td'+(i?' class="v"':'')+'>'+x+'</td>'}).join("")+'</tr>'}).join("")+'</table>'}
function blockIrr(a){
 var c=a.c,r=a.rec,A=a.A,om=a.om,f=a.f,C=U.c,MM=U.mm,M3=U.m3;
 var h='<div class="ablock" id="irrigation"><h3>'+tr("محسّن الري الذكي","Smart irrigation planner")+'</h3><p class="lead">'+tr("متى تروي وكام مياه؟ حساب علمي من الطقس المتوقع.","When to irrigate and how much water — a scientific calculation from the forecast.")+'</p><div class="grid g2">';
 h+='<div class="card rec-card"><span class="eyebrow">'+tr("التوصية","Recommendation")+'</span> '+bd("calc")+'<div class="headline">'+esc(r.head)+'</div>';
 if(r.due){
  h+='<p class="sm mu">'+esc(r.date)+' · '+tr("الأفضل: ","Best: ")+esc(r.tod)+'</p><table class="t"><tr><td>'+tr("عمق الريّة الصافي","Net irrigation depth")+'</td><td class="v">'+N(c.raw,MM)+'</td></tr><tr><td>'+tr("الإجمالي بعد كفاءة طريقتك ("+Math.round(c.eff*100)+"%)","Gross after your method's efficiency ("+Math.round(c.eff*100)+"%)")+'</td><td class="v">'+N(r.g,MM,0)+'</td></tr><tr><td>'+tr("الكمية للفدان","Per feddan")+'</td><td class="v">'+N(r.perFed,M3)+'</td></tr><tr><td><b>'+tr("الكمية للمساحة كلها ("+f1(A.fed)+" فدان)","Whole area ("+f1(A.fed)+" feddan)")+'</b></td><td class="v"><b>'+N(r.total,M3)+'</b></td></tr></table>';
  if(r.rainNote)h+='<p class="note" style="margin-top:8px">🌧 '+esc(r.rainNote)+'</p>';if(r.windNote)h+='<p class="note">💨 '+esc(r.windNote)+'</p>';
 }else h+='<p class="mu">'+tr("الاستنزاف الحالي "+f0(c.D0)+" من "+c.raw+" مم، والمطر والتبخر المتوقعين مش هيوصّلوه للحد الحرج خلال 7 أيام.","Current depletion is "+f0(c.D0)+" of "+c.raw+" mm. Expected rain and evaporation will not reach the critical level within 7 days.")+'</p>';
 h+='</div><div class="card"><h3>'+tr("ميزان المياه لـ 7 أيام قادمة","Water balance, next 7 days")+'</h3>'+tbl([
  [tr("التبخر المرجعي ET₀ ","Reference evaporation ET₀ ")+bd("fc"),N(c.et0,MM,1)],[tr("معامل المحصول Kc ","Crop coefficient Kc ")+bd("est"),'<span class="num">'+c.kc.toFixed(2)+'</span>'],[tr("احتياج المحصول ETc = Kc × ET₀","Crop need ETc = Kc × ET₀"),N(c.e7,MM,1)],
  [tr("المطر الفعّال المتوقع ","Expected effective rain ")+bd("fc"),'− '+N(c.p7,MM,1)],['<b>'+tr("الاحتياج الصافي","Net need")+'</b>','<b>'+N(c.net,MM,1)+'</b>'],[tr("الإجمالي ÷ كفاءة "+Math.round(c.eff*100)+"%","Gross ÷ efficiency "+Math.round(c.eff*100)+"%"),N(c.gross,MM,1)],
  [tr("الحجم للمساحة كلها","Volume for the whole area"),'<b>'+N(c.gross*A.ha*10,M3)+'</b>']])+'</div></div>';
 h+='<div class="grid g2" style="margin-top:16px"><div class="card chart"><h3>'+tr("توقع استنزاف رطوبة التربة ","Soil moisture depletion forecast ")+bd("calc")+'</h3><p class="note" style="margin-bottom:8px">'+tr("لما العمود يوصل للخط الأحمر (الحد الحرج) لازم ريّة، وبعدها بيرجع للصفر.","When a bar reaches the red line (critical level) an irrigation is due, then it resets to zero.")+'</p>'+
  chart({dates:om.d.time.slice(om.i0),i0:0,unit:MM,label:tr("استنزاف رطوبة التربة المتوقع","Forecast soil moisture depletion"),bars:[{v:c.dr,c:"#D69A12",l:tr("الاستنزاف","Depletion")}],hline:c.raw,hl:tr("الحد الحرج "+c.raw+" مم","Critical "+c.raw+" mm"),min:0})+lg([["#D69A12",tr("استنزاف رطوبة التربة (مم)","Soil moisture depletion (mm)")],["#D64545",tr("الحد الحرج للتربة","Critical level")]])+'</div>';
 h+='<div class="card"><h3>'+tr("إزاي وصلنا للتوصية دي؟","How we got this")+'</h3><ul class="cl sm"><li>'+tr("التبخر المرجعي ET₀ جاي جاهز من Open-Meteo (معادلة FAO-56 Penman-Monteith لموقعك).","ET₀ comes ready from Open-Meteo (FAO-56 Penman-Monteith for your location).")+'</li><li>'+tr("احتياج المحصول = Kc × ET₀، حيث Kc = ","Crop need = Kc × ET₀, where Kc = ")+'<b>'+c.kc.toFixed(2)+'</b> '+(f.stage=="unk"?'<b>'+tr("(افتراض منتصف الموسم لأنك مختارتش مرحلة النمو)","(mid-season assumed because no growth stage was chosen)")+'</b>':tr("حسب مرحلة النمو اللي اخترتها","from the growth stage you chose"))+'.</li><li>'+tr("المطر الفعّال = 80% من أيام المطر 2 مم أو أكتر.","Effective rain = 80% of rain on days with 2 mm or more.")+'</li><li>'+tr("الريّة بتتحدد لما استنزاف الماء يوصل ","Irrigation is due when depletion reaches ")+'<b>'+c.raw+' '+MM+'</b> '+(f.soil=="unk"?tr("(افتراض تربة طميية)","(loam soil assumed)"):tr("حسب نوع تربتك","for your soil type"))+'.</li><li>'+tr("بداية الحساب: ","Starting point: ")+(f.last!=null&&f.last!=="unk"&&f.last<7?tr("آخر ريّة من "+f.last+" يوم (من إدخالك).","last irrigation "+f.last+" day(s) ago (your input)."):'<b>'+tr("افتراض","assumed")+'</b> '+tr("إن الأرض كانت مروية بالكامل من 7 أيام. لو رويت من قريب، اختار «آخر ريّة» في بيانات المزرعة.","the field was fully irrigated 7 days ago. If you irrigated more recently, set “Last irrigation” in My farm."))+'</li></ul>'+
  '<h3 style="margin-top:14px">'+tr("معلومات مش متاحة لنا","What we do not know")+'</h3><ul class="cl sm"><li>'+tr("رطوبة التربة الفعلية في حقلك (مفيش حساس).","Actual soil moisture in your field (no sensor).")+'</li><li>'+tr("تاريخ زراعة المحصول بالضبط ومرحلته ","Exact planting date and growth stage ")+(f.stage=="unk"?tr("(مش مدخلة)","(not entered)"):"")+'.</li><li>'+tr("ملوحة التربة وجودة المياه.","Soil salinity and water quality.")+'</li></ul></div></div></div>';
 return h
}
function blockWhatIf(a){
 var s=a.sc,sc=[s.cur,s.opt,s.sav],mx=Math.max.apply(null,sc.map(function(x){return x.m3}).concat([1])),f=a.f,price=s.price,M3=U.m3,MM=U.mm;
 var save=function(x){var dlt=s.cur.m3-x.m3;return dlt>=0?'<span class="sev g">✓ '+tr("توفير ","Saves ")+N(dlt,M3)+'</span>':'<span class="sev y">! '+tr("أكتر بـ ","+")+N(-dlt,M3)+'</span>'};
 var h='<div class="ablock" id="whatif"><h3>'+tr("ماذا لو غيّرت طريقة الري؟","What if you change how you irrigate?")+'</h3><p class="lead">'+tr("مقارنة ثلاث سيناريوهات لأسبوع الري القادم لمساحتك ("+f1(s.A.fed)+" فدان). الأرقام تقديرات، مش وعود.","Three scenarios for the coming week on your area ("+f1(s.A.fed)+" feddan). Figures are estimates, not promises.")+'</p><div class="scen">';
 sc.forEach(function(x,i){
  h+='<div class="card'+(i==1?' best':'')+'"><span class="tag">'+esc(x.tag)+'</span><h3>'+x.name+'</h3><div class="v">'+N(x.m3,M3)+'<small> / '+tr("أسبوع","week")+'</small></div><div class="sm mu">'+N(x.perFed,M3,0)+' '+tr("للفدان","per feddan")+' · '+N(x.gross,MM,0)+'</div>'+
   (i?'<div>'+save(x)+'</div>':'<div class="note">'+tr("نقطة المقارنة","Baseline")+'</div>')+
   '<div class="sm">'+(price?tr("التكلفة: ","Cost: ")+'<b>'+N(x.cost,U.egp)+'</b>':'<span class="note">'+tr("أدخل سعر المتر المكعب في «إعدادات متقدمة» لعرض التكلفة","Enter the water price under “Advanced” in My farm to see cost")+'</span>')+'</div>'+
   '<div class="sm">'+(x.loss>=0.5?tr("نقص إنتاج محتمل من عجز المياه: ","Possible yield loss from water deficit: ")+'<b>≈ '+N(x.loss,"%",1)+'</b>':x.over>0.5&&i==0?tr("ري زائد عن الاحتياج ≈ ","Irrigation above need ≈ ")+'<b>'+N(x.overM3,M3)+'</b> '+tr("(فاقد مياه)","(wasted water)"):tr("مفيش عجز مائي متوقع","No water deficit expected"))+'</div><p class="note">'+esc(x.note)+'</p></div>'});
 h+='</div><div class="card" style="margin-top:16px"><h3>'+tr("استهلاك المياه الأسبوعي (م³)","Weekly water use (m³)")+'</h3>';
 var cols=["#D69A12","#2FA34F","#3B82D0"];
 sc.forEach(function(x,i){h+='<div class="bar"><span>'+x.short+'</span><div class="track"><div class="fill" style="width:'+Math.max(1.5,x.m3/mx*100)+'%;background:'+cols[i]+'"></div></div><b class="num">'+f0(x.m3)+'</b></div>'});
 h+='<div class="sliderrow" style="margin-top:16px"><label for="cov"><b>'+tr("نسبة تغطية الاحتياج في سيناريو التوفير: ","Share of need covered in the saving scenario: ")+'</b> <b class="num" id="covv">'+Math.round(FS.cover*100)+'%</b></label><input type="range" id="cov" min="70" max="100" step="5" value="'+Math.round(FS.cover*100)+'" aria-label="'+tr("نسبة تغطية الاحتياج","Share of need covered")+'"></div></div>';
 h+='<div class="card" style="margin-top:16px"><h3>'+tr("الافتراضات والمعادلات ","Assumptions and formulas ")+bd("est")+'</h3><ul class="cl sm"><li><b>'+tr("الحالي","Current")+'</b> = '+f0(f.cnt)+' × '+f0(f.depth)+' '+MM+' '+(f.cu?tr("من إدخالك.","from your input."):tr("(قيم افتراضية لطريقتك — عدّلها في الإعدادات المتقدمة).","(defaults for your method — change them under Advanced)."))+'</li><li><b>'+tr("المحسّن","Optimised")+'</b> = '+tr("الاحتياج الصافي (ETc − مطر فعّال) ÷ كفاءة طريقتك.","net need (ETc − effective rain) ÷ your method's efficiency.")+'</li><li><b>'+tr("التوفير","Saving")+'</b> = '+tr("ري بالتنقيط (كفاءة 90%) يغطي "+Math.round(FS.cover*100)+"% من الاحتياج الصافي.","drip irrigation (90% efficiency) covering "+Math.round(FS.cover*100)+"% of net need.")+'</li><li>'+tr("الحجم (م³) = العمق (مم) × المساحة (هكتار) × 10.","Volume (m³) = depth (mm) × area (ha) × 10.")+'</li><li><b>'+tr("أثر الإنتاج","Yield effect")+'</b> (FAO-33): '+tr("الفقد = Ky × (1 − ETa/ETc)، حيث Ky = ","loss = Ky × (1 − ETa/ETc), where Ky = ")+'<b>'+FS.CROPS[f.crop].ky+'</b> ('+esc(FS.cn(f.crop))+'). '+tr("هو تقدير تقريبي لأسبوع واحد، مش توقع لإنتاج الموسم.","This is a rough one-week estimate, not a season yield forecast.")+'</li><li>'+tr("مش محسوب: مخزون الماء في التربة، الملوحة، وتكلفة الطاقة أو العمالة.","Not included: stored soil water, salinity, and energy or labour cost.")+'</li></ul></div></div>';
 return h
}
function blockWarn(a){
 var h='<div class="ablock" id="warnings"><h3>'+tr("نظام الإنذار المبكر","Early warning system")+'</h3><p class="lead">'+tr("كل تنبيه معاه السبب والإجراء والبيانات اللي اتبنى عليها. المنصة ","Every alert comes with the reason, the action and the data behind it. The platform ")+'<b>'+tr("مبتكتشفش أمراض النبات","does not detect plant diseases")+'</b>'+tr(": مفيش بيانات أو نموذج موثّق لده.",": there is no documented data or model for that.")+'</p>';
 a.W.forEach(function(w){var sv=SEV[w.sev];h+='<div class="warn '+sv.c+'"><div class="top2"><span class="sev '+sv.c+'">'+sv.s+' '+tr("مستوى الخطر: ","Risk level: ")+sv.t+'</span><h4>'+esc(w.title)+'</h4></div><dl><dt>'+tr("اللي بيحصل","What is happening")+'</dt><dd>'+esc(w.what)+'</dd><dt>'+tr("ليه ده مهم","Why it matters")+'</dt><dd>'+esc(w.why)+'</dd><dt>'+tr("الإجراء المقترح","Suggested action")+'</dt><dd><b>'+esc(w.act)+'</b></dd><dt>'+tr("البيانات","Data")+'</dt><dd><ul class="cl" style="margin:0">'+w.data.map(function(x){return'<li>'+esc(x)+'</li>'}).join("")+'</ul></dd></dl></div>'});
 return h+'</div>'
}
function blockClimate(){
 var n=FS.data.nasa,h='<div class="ablock" id="climate"><h3>'+tr("مقارنة بالمعتاد (NASA POWER)","Compared with normal (NASA POWER)")+'</h3><p class="lead">'+tr("إزاي آخر 30 يوم مقارنة بنفس الفترة في السنين اللي فاتت لموقعك.","How the last 30 days compare with the same period in previous years at your location.")+'</p><div class="card">';
 if(!n||n.st=="load"||n.st=="idle")h+='<p><span class="spin"></span>'+tr("جاري جلب بيانات NASA POWER…","Loading NASA POWER data…")+'</p>';
 else if(n.st!="ok")h+='<p>'+bd("na")+' '+tr("تعذّر جلب بيانات NASA POWER دلوقتي. مفيش أرقام بديلة بتتعرض.","NASA POWER data could not be loaded right now. No substitute numbers are shown.")+'</p>';
 else{
  var u=n.usual,row=function(l,c,us,d,un,m){return[l,N(c*m,un,d),us==null?"—":N(us*m,un,d),us==null?"—":'<span class="num">'+((c-us)*m>=0?"+":"")+((c-us)*m).toFixed(d)+'</span>']};
  h+=tbl([row(tr("متوسط الحرارة","Average temperature"),n.temp,u&&u.temp,1,U.c,1),row(tr("إجمالي المطر","Total rain"),n.rain,u&&u.rain,1,U.mm,1),row(tr("رطوبة منطقة الجذور","Root-zone moisture"),n.soil,u&&u.soil,0,"%",100),[tr("أيام عدّت 35°م","Days above 35 °C"),N(n.hot,""),"—","—"]],[tr("المؤشر","Indicator"),tr("آخر 30 يوم","Last 30 days"),tr("المعتاد","Usual"),tr("الفرق","Difference")]);
  var dt=function(x){return x.replace(/(\d{4})(\d\d)(\d\d)/,'$1-$2-$3')};
  h+='<p class="note" style="margin-top:10px">'+bd("api")+' '+tr("بيانات NASA POWER من "+dt(n.from)+" إلى "+dt(n.to)+". ","NASA POWER data from "+dt(n.from)+" to "+dt(n.to)+". ")+(u?tr("المعتاد = متوسط نفس الفترة في آخر "+u.n+" سنين.","Usual = average of the same period over the last "+u.n+" years."):tr("مفيش بيانات سنين سابقة كفاية للمقارنة.","Not enough past years to compare."))+' '+tr("الدقة المكانية حوالي نصف درجة (≈ 50 كم)، فهي مؤشر مناخي عام مش قياس لحقلك.","Spatial resolution is about half a degree (≈ 50 km), so this is a general climate indicator, not a measurement of your field.")+'</p>'}
 return h+'</div></div>'
}
function blockMethod(a){
 var f=FS.farm(),r=FS.CROPS[f.crop].rot,ar=function(x){return x.map(FS.cn).join(tr(" ← "," → "))};
 var legend='<div class="card" style="margin-bottom:16px"><h3>'+tr("إزاي تقرا الشارات","How to read the badges")+'</h3><p class="sm" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">'+bd("api")+' '+tr("بيانات فعلية من خدمة خارجية","real data from an external service")+' · '+bd("fc")+' '+tr("توقعات نموذج الطقس","weather-model forecast")+' · '+bd("calc")+' '+tr("حساب من بيانات فعلية","calculated from real data")+' · '+bd("est")+' '+tr("افتراض قابل للتعديل","adjustable assumption")+' · '+bd("na")+'</p></div>';
 return'<div class="ablock" id="method"><h3>'+tr("المنهجية ومصادر البيانات","Method and data sources")+'</h3><p class="lead">'+tr("إيه اللي حقيقي، وإيه اللي محسوب، وإيه اللي تقديري.","What is real, what is calculated and what is estimated.")+'</p>'+legend+'<div class="grid g2"><div class="card"><h3>'+tr("مصادر البيانات","Data sources")+'</h3>'+tbl([
  ["Open-Meteo "+bd("api"),tr("طقس حالي وتوقع 7 أيام، ET₀، رطوبة تربة (نموذج)","Current weather, 7-day forecast, ET₀, soil moisture (model)")],["NASA POWER "+bd("api"),tr("مناخ تاريخي: حرارة، مطر، رطوبة جذور (≈ 50 كم)","Historical climate: temperature, rain, root moisture (≈ 50 km)")],["NASA GIBS · MODIS "+bd("api"),tr("صور NDVI بدقة ≈ 250 م، تركيب 8 أيام","NDVI imagery at ≈ 250 m, 8-day composite")],["OpenStreetMap "+bd("api"),tr("حدود الحقول (لو متسجلة)","Field boundaries (when mapped)")],["Esri World Imagery",tr("صور القمر الصناعي كخلفية للخريطة","Satellite imagery as the map background")]])+'</div>'+
  '<div class="card"><h3>'+tr("حدود التحليل","Limits of the analysis")+'</h3><ul class="cl sm"><li>'+tr("مفيش حساسات في أرضك: كل أرقام الجو والتربة من نماذج بدقة عدة كيلومترات.","There are no sensors in your field: all weather and soil numbers come from models a few kilometres wide.")+'</li><li>'+tr("NDVI صورة فضائية للمقارنة، مش رقم دقيق لحقل صغير.","NDVI is a satellite image for comparison, not an exact figure for a small field.")+'</li><li>'+tr("مخاطر الطقس على الخريطة من توقعات شبكية، مش قياس حقلي.","Weather risk on the map comes from gridded forecasts, not field measurements.")+'</li><li>'+tr("التوصيات إرشادية، راجع مهندس زراعي قبل التنفيذ.","Recommendations are guidance only — consult an agronomist before acting.")+'</li></ul>'+
  '<h3 style="margin-top:14px">'+tr("دورة زراعية مقترحة (محصولك: "+esc(FS.cn(f.crop))+") ","Suggested crop rotation (your crop: "+esc(FS.cn(f.crop))+") ")+'<span class="note">'+tr("(إرشاد عام)","(general guidance)")+'</span></h3><p class="sm">'+ar(r)+'</p><p class="note">'+tr("تناوب المحاصيل (خصوصًا البقوليات) بيعوّض نيتروجين التربة وبيكسر دورة الآفات. مفيش نسب إنتاج متوقعة هنا لأنها محتاجة بيانات حقلك.","Rotating crops (especially legumes) restores soil nitrogen and breaks pest cycles. No yield figures are given because they need your field's data.")+'</p></div></div></div>'
}
var TABS=["irrigation","whatif","warnings","climate","method"];
function curTab(){var h=location.hash.slice(1);return TABS.indexOf(h)>=0?h:"irrigation"}
function showTab(){
 var t=curTab();
 [].forEach.call(document.querySelectorAll(".ablock"),function(b){b.classList.toggle("show",b.id===t)});
 [].forEach.call(document.querySelectorAll("#antabs .tab"),function(b){b.setAttribute("aria-selected",b.dataset.tab===t)})
}
function renderAn(){
 var el=$("an");if(!el)return;
 var a=FS.analysis(),tabs=$("antabs");
 if(tabs)tabs.style.display=a.st=="ok"?"":"none";
 if(a.st=="nofarm")return el.innerHTML=NOFARM();
 if(a.st=="load")return el.innerHTML=LOADING(tr("جاري تجهيز التحليلات…","Preparing the analysis…"));
 if(a.st=="err"){el.innerHTML=ERR();return hookRetry()}
 el.innerHTML=blockIrr(a)+blockWhatIf(a)+blockWarn(a)+blockClimate()+blockMethod(a);
 showTab();
 var cv=$("cov");if(cv){cv.oninput=function(){$("covv").textContent=this.value+"%"};cv.onchange=function(){FS.cover=this.value/100;FS.emit("update")}}
}

/* ================= Home snapshot ================= */
function renderHome(){
 var g=$("glance"),gr=$("greet");if(!g&&!gr)return;
 if(gr){var hr=new Date().getHours();gr.textContent=hr<12?tr("صباح الخير 👋","Good morning 👋"):hr<18?tr("أهلاً بيك 👋","Welcome 👋"):tr("مساء الخير 👋","Good evening 👋")}
 var cta=$("heroCta"),a=FS.analysis(),f=FS.farm();
 if(cta&&FS.hasFarm()){cta.href="dashboard.html";cta.textContent=tr("افتح لوحة التحكم","Open the dashboard")}
 if(!g)return;
 if(a.st=="nofarm")return g.innerHTML='<div class="empty-g"><h3>'+tr("ابدأ من هنا","Start here")+'</h3><p>'+tr("حدّد مكان مزرعتك والمحصول، وهتشوف نصيحة الري والتنبيهات هنا فورًا.","Set your farm location and crop and you will see today's irrigation advice and alerts right here.")+'</p><a class="btn wh" href="farm.html">'+tr("أضف مزرعتك","Add your farm")+'</a></div>';
 if(a.st=="load")return g.innerHTML='<div class="empty-g"><p><span class="spin"></span>'+tr("جاري جلب بيانات مزرعتك…","Loading your farm's data…")+'</p></div>';
 if(a.st=="err")return g.innerHTML='<div class="empty-g"><p>'+tr("تعذّر جلب الطقس دلوقتي.","Weather could not be loaded right now.")+'</p><a class="btn wh sm" href="dashboard.html">'+tr("جرّب من لوحة التحكم","Try from the dashboard")+'</a></div>';
 var cur=a.om.cur||{},sv=SEV[a.L];
 g.innerHTML='<h3>'+esc(f.name||tr("مزرعتك","Your farm"))+' · '+esc(FS.cn(f.crop))+'</h3><div class="gl-grid"><div class="gl wide"><small>'+tr("الري","Irrigation")+'</small><b>'+esc(a.rec.head)+'</b></div><div class="gl"><small>'+tr("الحرارة دلوقتي","Temperature now")+'</small><b>'+N(cur.temperature_2m,U.c,0)+'</b></div><div class="gl"><small>'+tr("مستوى الخطر","Risk level")+'</small><b>'+sv.s+' '+sv.t+'</b></div></div><p style="margin-top:12px"><a class="btn wh sm" href="dashboard.html">'+tr("التفاصيل في لوحة التحكم","Details on the dashboard")+'</a></p>'
}

function all(){renderDash();renderAn();renderHome()}
FS.on("update",all);all();
if($("antabs")){
 $("antabs").addEventListener("click",function(e){var b=e.target.closest(".tab");if(!b)return;try{history.replaceState(null,"","#"+b.dataset.tab)}catch(x){location.hash=b.dataset.tab}showTab()});
 window.addEventListener("hashchange",showTab);showTab()
}
})();
