(()=>{/* "PE 监控" nav: clicking/tapping the tag opens the PE overview list.
   On mouse devices, hovering still reveals the per-coin dropdown; outside click / Esc closes it. */
const hov=matchMedia("(hover: hover) and (pointer: fine)");
document.querySelectorAll("details.nav-pe").forEach(d=>{let t;
const list=d.querySelector('.nav-pe-menu a[href$="pe-list.html"]');
d.addEventListener("mouseenter",()=>{if(hov.matches){clearTimeout(t);d.open=true}});
d.addEventListener("mouseleave",()=>{if(hov.matches)t=setTimeout(()=>{d.open=false},150)});
d.querySelector("summary").addEventListener("click",e=>{if(list){e.preventDefault();location.href=list.href;}else if(hov.matches&&d.open&&d.matches(":hover"))e.preventDefault()});});
document.addEventListener("click",e=>{document.querySelectorAll("details.nav-pe[open]").forEach(d=>{if(!d.contains(e.target))d.open=false})});
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll("details.nav-pe[open]").forEach(d=>{d.open=false;d.querySelector("summary").focus()})});})();
