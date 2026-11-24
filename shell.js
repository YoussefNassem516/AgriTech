/* Field Shift — shared shell (loads first on every page).
   Language (ar/en), theme (light/dark), header, footer, icon sprite, toast, floating assistant button.
   Exposes FS.lang, FS.T(ar,en), FS.U (units). Switching language or theme is saved in localStorage. */
(function(){
"use strict";
var FS=window.FS=window.FS||{};
var lang="ar";try{lang=localStorage.getItem("fs_lang")||"ar"}catch(e){}
if(lang!=="en")lang="ar";
FS.lang=lang;
var T=FS.T=function(ar,en){return lang==="en"?en:ar};
FS.U={c:T("°م","°C"),mm:T("مم","mm"),m3:T("م³","m³"),kmh:T("كم/س","km/h"),fed:T("فدان","feddan"),egp:T("جنيه","EGP")};
var doc=document.documentElement;
doc.lang=lang;doc.dir=lang==="ar"?"rtl":"ltr";

/* ---------- theme ---------- */
function curTheme(){return doc.dataset.theme==="dark"?"dark":"light"}
function applyTheme(t){doc.dataset.theme=t;try{localStorage.setItem("fs_theme",t)}catch(e){}
 var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==="dark"?"#0A130E":"#0F5A2A";
 var b=document.getElementById("themebtn");if(b){b.setAttribute("aria-label",T(t==="dark"?"المود النهاري":"المود الليلي",t==="dark"?"Light mode":"Dark mode"));b.innerHTML='<svg><use href="#i-'+(t==="dark"?"sun":"moon")+'"/></svg>'}}
FS.theme=curTheme;

/* ---------- icon sprite ---------- */
var S='fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
function sym(id,d,extra){return'<symbol id="i-'+id+'" viewBox="0 0 24 24" '+(extra||S)+'>'+d+'</symbol>'}
var SPRITE='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'+
 sym("leaf",'<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19c3-4 6-7 9-9"/>')+
 sym("drop",'<path d="M12 3s6 6.2 6 11a6 6 0 01-12 0c0-4.8 6-11 6-11z"/>')+
 sym("temp",'<path d="M14 14.5V5a2 2 0 00-4 0v9.5a4 4 0 104 0z"/>')+
 sym("rain",'<path d="M7 16a4 4 0 01-.5-7.9A5.5 5.5 0 0117 9a3.5 3.5 0 010 7"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>')+
 sym("sun",'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>')+
 sym("moon",'<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>')+
 sym("shield",'<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>')+
 sym("alert",'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>')+
 sym("pin",'<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>')+
 sym("sat",'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>')+
 sym("wind",'<path d="M3 8h11a3 3 0 10-3-3M3 12h16a3 3 0 11-3 3M3 16h8"/>')+
 sym("chat",'<path d="M21 12a8 8 0 01-11.7 7L4 20l1.1-4.3A8 8 0 1121 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>')+
 sym("mic",'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',S.replace("1.8","2"))+
 sym("stop",'<rect x="6" y="6" width="12" height="12" rx="2"/>','fill="currentColor"')+
 sym("send",'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',S.replace("1.8","2"))+
 sym("spk",'<path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14"/>',S.replace("1.8","2"))+
 sym("menu",'<path d="M4 7h16M4 12h16M4 17h16"/>',S.replace("1.8","2"))+
 sym("close",'<path d="M6 6l12 12M18 6L6 18"/>',S.replace("1.8","2"))+
 sym("chart",'<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>')+
 sym("grid",'<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>')+
 sym("home",'<path d="M3 11l9-8 9 8M5 10v10h14V10"/>')+
 sym("map",'<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>')+
 sym("heat",'<path d="M12 3c2 3 5 5 5 9a5 5 0 01-10 0c0-2 1-3 2-4 .5 2 1.5 2.5 2 2.5C11 8 11 5 12 3z"/>')+
 sym("arrow",'<path d="M5 12h14M13 6l6 6-6 6"/>')+
 sym("info",'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>')+
 sym("refresh",'<path d="M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5"/>')+
 sym("globe",'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>')+
 '</defs></svg>';

/* ---------- navigation ---------- */
var NAV=[["home","index.html","الرئيسية","Home"],["dashboard","dashboard.html","لوحة التحكم","Dashboard"],["farm","farm.html","بيانات المزرعة","My farm"],["map","map.html","الخريطة","Map"],["analytics","analytics.html","التحليلات","Analytics"],["assistant","assistant.html","المساعد","Assistant"]];
var page=document.body.dataset.page||"home";

function build(){
 var tmp=document.createElement("div");tmp.innerHTML=SPRITE;var sprite=tmp.firstChild;document.body.insertBefore(sprite,document.body.firstChild);
 var h=document.createElement("header");h.className="top";
 h.innerHTML='<div class="wrap"><a class="brand" href="index.html" aria-label="Field Shift"><i><svg><use href="#i-leaf"/></svg></i><span class="nm">Field Shift</span></a>'+
  '<nav class="main" id="mainnav" aria-label="'+T("التنقل الرئيسي","Main navigation")+'">'+NAV.map(function(n){return'<a href="'+n[1]+'"'+(n[0]===page?' class="on" aria-current="page"':'')+'>'+T(n[2],n[3])+'</a>'}).join("")+'</nav>'+
  '<div class="tools"><button class="ibtn lang" id="langbtn" type="button" aria-label="'+T("Switch to English","التحويل للعربية")+'"><svg><use href="#i-globe"/></svg><span>'+T("EN","عربي")+'</span></button>'+
  '<button class="ibtn" id="themebtn" type="button"></button>'+
  '<button class="ibtn burger" id="burger" type="button" aria-label="'+T("القائمة","Menu")+'" aria-expanded="false" aria-controls="mainnav"><svg><use href="#i-menu"/></svg></button></div></div>';
 document.body.insertBefore(h,sprite.nextSibling);
 var f=document.createElement("footer");
 f.innerHTML='<div class="wrap"><div class="fcol"><a class="brand" href="index.html"><i><svg><use href="#i-leaf"/></svg></i><span class="nm">Field Shift</span></a><p>'+T("منصة زراعة ذكية بتحوّل بيانات الطقس والأقمار الصناعية لقرارات ري وتحذيرات مفهومة.","A smart-farming platform that turns weather and satellite data into clear irrigation decisions and early warnings.")+'</p></div>'+
  '<div class="fcol"><h4>'+T("الصفحات","Pages")+'</h4>'+NAV.slice(1).map(function(n){return'<a href="'+n[1]+'">'+T(n[2],n[3])+'</a>'}).join("")+'</div>'+
  '<div class="fcol"><h4>'+T("مصادر البيانات","Data sources")+'</h4><p>Open-Meteo</p><p>NASA POWER · GIBS</p><p>OpenStreetMap</p><p>Esri World Imagery</p></div>'+
  '<div class="fine">'+T("التوصيات إرشادية ولا تغني عن المهندس الزراعي. الأرقام المحسوبة تعتمد على افتراضات مذكورة بجانبها.","Recommendations are guidance only and do not replace an agronomist. Calculated figures rely on the assumptions shown next to them.")+'</div></div>';
 document.body.appendChild(f);
 var t=document.createElement("div");t.className="toast";t.id="toast";t.setAttribute("role","status");document.body.appendChild(t);
 if(page!=="assistant"){var a=document.createElement("a");a.className="fab";a.href="assistant.html";a.setAttribute("aria-label",T("افتح المساعد الذكي","Open the assistant"));a.innerHTML='<svg><use href="#i-chat"/></svg><span>'+T("اسأل المساعد","Ask the assistant")+'</span>';document.body.appendChild(a)}
 applyTheme(curTheme());
 document.getElementById("themebtn").onclick=function(){applyTheme(curTheme()==="dark"?"light":"dark")};
 document.getElementById("langbtn").onclick=function(){try{localStorage.setItem("fs_lang",lang==="ar"?"en":"ar")}catch(e){}location.reload()};
 var nav=document.getElementById("mainnav"),bg=document.getElementById("burger");
 bg.onclick=function(){var o=nav.classList.toggle("open");bg.setAttribute("aria-expanded",o)};
 window.addEventListener("scroll",function(){h.classList.toggle("sc",window.scrollY>6)},{passive:true});
 /* translate static text: elements carry the Arabic by default and an English twin in data-en */
 if(lang==="en"){
  [].forEach.call(document.querySelectorAll("[data-en]"),function(e){if(e.tagName==="TITLE")document.title=e.dataset.en;else e.innerHTML=e.dataset.en});
  [].forEach.call(document.querySelectorAll("[data-en-ph]"),function(e){e.placeholder=e.dataset.enPh});
  [].forEach.call(document.querySelectorAll("[data-en-aria]"),function(e){e.setAttribute("aria-label",e.dataset.enAria)});
  [].forEach.call(document.querySelectorAll("[data-en-title]"),function(e){e.title=e.dataset.enTitle})
 }
}
if(document.body)build();else document.addEventListener("DOMContentLoaded",build);
})();
