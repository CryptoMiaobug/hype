(()=>{/* "PE 监控" nav: the tag only opens the per-coin dropdown (no navigation on click).
   On mouse devices, hovering also reveals it; outside click / Esc closes it. */
const hov=matchMedia("(hover: hover) and (pointer: fine)");
document.querySelectorAll("details.nav-pe").forEach(d=>{let t;
d.addEventListener("mouseenter",()=>{if(hov.matches){clearTimeout(t);d.open=true}});
d.addEventListener("mouseleave",()=>{if(hov.matches)t=setTimeout(()=>{d.open=false},150)});});
document.addEventListener("click",e=>{document.querySelectorAll("details.nav-pe[open]").forEach(d=>{if(!d.contains(e.target))d.open=false})});
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll("details.nav-pe[open]").forEach(d=>{d.open=false;d.querySelector("summary").focus()})});})();
