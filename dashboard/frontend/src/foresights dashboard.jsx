import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Google Fonts injected once ─────────────────────────── */
const fontLink = document.createElement("link");
fontLink.href =
  "https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap";
fontLink.rel = "stylesheet";
if (!document.querySelector(`link[href="${fontLink.href}"]`)) {
  document.head.appendChild(fontLink);
}

/* ─── CSS injected as a <style> tag ──────────────────────── */
const CSS = `
:root {
  --red:#C8001E; --red-dark:#9E0017; --red-hover:#E0001F;
  --red-pale:#FDF0F2; --red-tint:#FCEAED;
  --black:#0D0D0D; --ink:#1C1C1C; --ink-mid:#3A3A3A;
  --ink-light:#6B6B6B; --ink-ghost:#9A9A9A;
  --rule:#DCDCDC; --rule-light:#EFEFEF; --surface:#F5F5F5;
  --white:#FFFFFF; --amber:#D4740A; --amber-bg:#FEF6EA;
  --green:#1A7A4A; --green-bg:#EAF6EE;
  --blue:#1558B0; --blue-bg:#EBF1FB;
  --fd:'Barlow Condensed',sans-serif;
  --fb:'Barlow',sans-serif;
  --fm:'IBM Plex Mono',monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px}
.ss-root{font-family:var(--fb);background:var(--surface);color:var(--ink);min-height:100vh;-webkit-font-smoothing:antialiased}

/* TOPBAR */
.ss-topbar{height:52px;background:var(--black);display:flex;align-items:center;padding:0 24px;position:sticky;top:0;z-index:200}
.ss-logo{font-family:var(--fd);font-size:20px;font-weight:800;letter-spacing:3px;color:var(--white);display:flex;align-items:center;gap:10px;flex-shrink:0;text-transform:uppercase}
.ss-logo-icon{width:28px;height:28px;background:var(--red);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ss-logo-icon svg{width:16px;height:16px;fill:var(--white)}
.ss-tdiv{width:1px;height:28px;background:#333;margin:0 20px;flex-shrink:0}
.ss-nav{display:flex;align-items:center;gap:2px;flex:1}
.ss-nav-item{font-family:var(--fb);font-size:13px;font-weight:500;color:#999;padding:6px 14px;cursor:pointer;letter-spacing:.3px;transition:color .15s;border:1px solid transparent;display:flex;align-items:center;gap:6px;user-select:none;background:none;text-decoration:none}
.ss-nav-item:hover{color:var(--white)}
.ss-nav-item.active{color:var(--white);border-color:#444}
.ss-nav-item svg{width:13px;height:13px;fill:currentColor}
.ss-nav-allsnags{background:var(--red)!important;color:var(--white)!important;border-color:var(--red)!important;font-weight:600;letter-spacing:.4px}
.ss-nav-allsnags:hover{background:var(--red-hover)!important}
.ss-nav-attend{color:#bbb!important;border-color:#444!important}
.ss-nav-attend:hover{color:var(--white)!important;border-color:#666!important}
.ss-topbar-right{display:flex;align-items:center;gap:12px;margin-left:auto}
.ss-report-btn{display:flex;align-items:center;gap:7px;padding:7px 16px;background:transparent;border:1px solid #555;color:#ccc;font-family:var(--fb);font-size:12px;font-weight:600;letter-spacing:.5px;cursor:pointer;text-transform:uppercase;transition:all .15s}
.ss-report-btn:hover{border-color:var(--red);color:var(--white)}
.ss-report-btn svg{width:13px;height:13px;fill:currentColor;flex-shrink:0}
.ss-live{display:flex;align-items:center;gap:6px;font-family:var(--fm);font-size:11px;color:#666;letter-spacing:.5px}
.ss-live-dot{width:7px;height:7px;background:#22C55E;border-radius:50%;animation:livepulse 2s ease-in-out infinite}
@keyframes livepulse{0%,100%{opacity:1}50%{opacity:.3}}
.ss-profile{display:flex;align-items:center;gap:9px;padding:5px 10px 5px 5px;cursor:pointer;border:1px solid transparent;transition:border-color .15s}
.ss-profile:hover{border-color:#444}
.ss-avatar{width:32px;height:32px;background:var(--red);color:var(--white);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;letter-spacing:.5px;flex-shrink:0}
.ss-profile-name{font-size:12px;font-weight:600;color:var(--white);line-height:1.25}
.ss-profile-sub{font-size:11px;color:#777}
.ss-hamburger{display:none;align-items:center;justify-content:center;width:36px;height:36px;background:none;border:1px solid #444;cursor:pointer;flex-shrink:0;margin-left:8px}
.ss-hamburger svg{width:18px;height:18px;fill:#ccc}

/* MOBILE NAV DRAWER */
.ss-mobile-nav{display:none;flex-direction:column;position:fixed;top:52px;left:0;right:0;background:#161616;border-top:1px solid #333;padding:8px 0 16px;z-index:300;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.ss-mobile-nav.open{display:flex}
.ss-mobile-nav .ss-nav-item{padding:12px 20px;font-size:14px;border:none;border-bottom:1px solid #222;width:100%}

/* MAIN */
.ss-main{max-width:1480px;margin:0 auto;padding:28px 28px 60px}

/* WELCOME */
.ss-welcome{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid var(--black)}
.ss-welcome-greeting{font-family:var(--fd);font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--ink-light);margin-bottom:4px}
.ss-welcome-name{font-family:var(--fd);font-size:38px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--black);line-height:1;display:flex;align-items:center;gap:12px}
.ss-welcome-accent{color:var(--red)}
.ss-welcome-ctx{font-size:13px;color:var(--ink-ghost);margin-top:6px;letter-spacing:.2px}
.ss-welcome-right{text-align:right}
.ss-wdate{font-family:var(--fm);font-size:12px;color:var(--ink-light);letter-spacing:.3px}
.ss-wtime{font-family:var(--fm);font-size:22px;font-weight:500;color:var(--black);margin-top:2px;letter-spacing:1px}

/* SEARCH */
.ss-search{margin-bottom:24px}
.ss-search-bar{display:flex;align-items:stretch;background:var(--white);border:1.5px solid var(--black);box-shadow:3px 3px 0 var(--black);transition:box-shadow .15s,border-color .15s}
.ss-search-bar:focus-within{border-color:var(--red);box-shadow:3px 3px 0 var(--red)}
.ss-search-prefix{display:flex;align-items:center;padding:0 16px;background:var(--black);flex-shrink:0}
.ss-search-prefix svg{width:15px;height:15px;fill:var(--white)}
.ss-search-input{flex:1;padding:13px 16px;font-family:var(--fb);font-size:14px;color:var(--black);border:none;outline:none;background:transparent}
.ss-search-input::placeholder{color:var(--ink-ghost);font-weight:400}
.ss-search-btn{padding:0 22px;background:var(--red);color:var(--white);font-family:var(--fb);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border:none;cursor:pointer;transition:background .15s;flex-shrink:0}
.ss-search-btn:hover{background:var(--red-dark)}
.ss-chips{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center}
.ss-chips-label{font-size:11px;font-weight:600;color:var(--ink-ghost);letter-spacing:.5px;text-transform:uppercase;margin-right:2px;flex-shrink:0}
.ss-chip{font-size:12px;color:var(--ink-mid);background:var(--white);border:1px solid var(--rule);padding:4px 12px;cursor:pointer;transition:all .12s;font-weight:500;user-select:none}
.ss-chip:hover{border-color:var(--red);color:var(--red);background:var(--red-tint)}
.ss-answer{margin-top:12px;background:var(--white);border:1px solid var(--rule);border-left:3px solid var(--red);padding:14px 18px;animation:fadein .2s ease}
@keyframes fadein{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.ss-answer-tag{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--red);margin-bottom:6px}
.ss-answer-body{font-size:13.5px;color:var(--ink-mid);line-height:1.65}

/* SCOPE */
.ss-scope-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.ss-scope-label{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-light)}
.ss-scope-toggle{display:flex;border:1.5px solid var(--black);overflow:hidden}
.ss-scope-opt{display:flex;align-items:center;gap:7px;padding:7px 20px;font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;background:var(--white);color:var(--ink-light);border:none;transition:all .12s;user-select:none}
.ss-scope-opt svg{width:13px;height:13px;fill:currentColor}
.ss-scope-opt:not(:last-child){border-right:1.5px solid var(--black)}
.ss-scope-opt:hover{background:var(--surface);color:var(--ink)}
.ss-scope-opt.active{background:var(--black);color:var(--white)}

/* VERTICALS */
.ss-verticals{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:28px}
.ss-vcard{background:var(--white);border:1.5px solid var(--rule);cursor:pointer;transition:border-color .15s,box-shadow .15s;overflow:hidden;position:relative}
.ss-vcard:hover{border-color:var(--ink-mid);box-shadow:2px 2px 0 var(--ink-mid)}
.ss-vcard.active{border-color:var(--red);box-shadow:2px 2px 0 var(--red)}
.ss-vcard-top{height:4px;background:var(--rule);transition:background .15s}
.ss-vcard.active .ss-vcard-top{background:var(--red)}
.ss-vcard:hover .ss-vcard-top{background:var(--ink-mid)}
.ss-vcard.active:hover .ss-vcard-top{background:var(--red)}
.ss-vcard-body{padding:18px 20px 16px}
.ss-vcard-icon-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.ss-vcard-icon{width:36px;height:36px;background:var(--surface);display:flex;align-items:center;justify-content:center;border:1px solid var(--rule)}
.ss-vcard-icon svg{width:18px;height:18px;fill:var(--ink-mid)}
.ss-vcard.active .ss-vcard-icon{background:var(--red-tint);border-color:var(--red)}
.ss-vcard.active .ss-vcard-icon svg{fill:var(--red)}
.ss-vcrit{font-size:11px;font-weight:700;letter-spacing:.3px;color:var(--red);background:var(--red-tint);padding:2px 8px;display:flex;align-items:center;gap:4px}
.ss-vcrit svg{width:10px;height:10px;fill:currentColor}
.ss-vcrit.none{color:var(--ink-ghost);background:var(--surface)}
.ss-vcrit.none svg{fill:var(--ink-ghost)}
.ss-vname{font-family:var(--fd);font-size:20px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--black);margin-bottom:6px}
.ss-vcount{font-family:var(--fm);font-size:36px;font-weight:500;color:var(--black);line-height:1;letter-spacing:-1px;margin-bottom:2px;transition:color .3s}
.ss-vcard.active .ss-vcount{color:var(--red)}
.ss-vsub{font-size:11px;color:var(--ink-ghost);font-weight:500;letter-spacing:.2px}

/* METRICS */
.ss-metrics-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.ss-section-title{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--ink-light)}
.ss-sync{font-family:var(--fm);font-size:11px;color:var(--ink-ghost)}
.ss-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:32px}
.ss-mcard{background:var(--white);border:1px solid var(--rule);padding:20px 20px 16px;position:relative;overflow:hidden}
.ss-mcard::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
.ss-mcard.m-red::before{background:var(--red)}
.ss-mcard.m-green::before{background:var(--green)}
.ss-mcard.m-amber::before{background:var(--amber)}
.ss-mcard.m-black::before{background:var(--black)}
.ss-mcard-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
.ss-mlabel{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--ink-light);line-height:1.4;max-width:160px}
.ss-mtrend{font-size:11px;font-weight:600;display:flex;align-items:center;gap:3px;flex-shrink:0}
.ss-mtrend svg{width:10px;height:10px;fill:currentColor}
.t-up-bad{color:var(--red)} .t-down-good{color:var(--green)} .t-neutral{color:var(--ink-ghost)}
.ss-mvalue{font-family:var(--fd);font-size:56px;font-weight:800;letter-spacing:1px;line-height:1;margin-bottom:4px}
.ss-mcard.m-red .ss-mvalue{color:var(--red)}
.ss-mcard.m-green .ss-mvalue{color:var(--green)}
.ss-mcard.m-amber .ss-mvalue{color:var(--amber)}
.ss-mcard.m-black .ss-mvalue{color:var(--black)}
.ss-munit{font-size:18px;font-weight:600;margin-left:2px;opacity:.7}
.ss-mdesc{font-size:12px;color:var(--ink-ghost);line-height:1.5;margin-top:2px}
.ss-sparkline{display:flex;align-items:flex-end;gap:2px;height:28px;margin-top:12px}
.ss-spark{flex:1;background:var(--rule-light);min-height:3px;transition:background .2s}
.ss-mcard.m-red .ss-spark.hi{background:var(--red);opacity:.4}
.ss-mcard.m-red .ss-spark.last{background:var(--red);opacity:1}
.ss-mcard.m-green .ss-spark.hi{background:var(--green);opacity:.4}
.ss-mcard.m-green .ss-spark.last{background:var(--green);opacity:1}
.ss-mcard.m-amber .ss-spark.hi{background:var(--amber);opacity:.4}
.ss-mcard.m-amber .ss-spark.last{background:var(--amber);opacity:1}
.ss-mcard.m-black .ss-spark.hi{background:var(--black);opacity:.4}
.ss-mcard.m-black .ss-spark.last{background:var(--black);opacity:1}

/* TABLE */
.ss-tbl-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.ss-tbl-actions{display:flex;gap:8px;align-items:center}
.ss-filter-sel{font-family:var(--fb);font-size:12px;color:var(--ink);background:var(--white);border:1px solid var(--rule);padding:6px 10px;cursor:pointer;outline:none;transition:border-color .12s;font-weight:500}
.ss-filter-sel:focus{border-color:var(--black)}
.ss-btn-raise{display:flex;align-items:center;gap:6px;padding:7px 16px;background:var(--red);color:var(--white);font-family:var(--fb);font-size:12px;font-weight:700;letter-spacing:.5px;border:none;cursor:pointer;text-transform:uppercase;transition:background .12s}
.ss-btn-raise:hover{background:var(--red-dark)}
.ss-btn-raise svg{width:12px;height:12px;fill:var(--white)}
.ss-tbl-wrap{background:var(--white);border:1px solid var(--rule);overflow-x:auto;-webkit-overflow-scrolling:touch}
.ss-table{width:100%;border-collapse:collapse;min-width:640px}
.ss-table thead{background:var(--black)}
.ss-table th{padding:11px 14px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;text-align:left;white-space:nowrap}
.ss-table th:first-child{padding-left:20px;color:#666}
.ss-table td{padding:11px 14px;font-size:13px;color:var(--ink-mid);border-bottom:1px solid var(--rule-light);vertical-align:middle}
.ss-table td:first-child{padding-left:20px}
.ss-table tbody tr{transition:background .1s;cursor:pointer}
.ss-table tbody tr:hover{background:var(--surface)}
.ss-table tbody tr:last-child td{border-bottom:none}
.ss-snag-id{font-family:var(--fm);font-size:11px;color:var(--ink-ghost)}
.ss-snag-title{font-weight:600;color:var(--black);font-size:13px}
.ss-snag-loc{font-size:11px;color:var(--ink-ghost);margin-top:2px}
.ss-tag{display:inline-block;padding:2px 8px;font-size:11px;font-weight:700;letter-spacing:.3px;text-transform:uppercase}
.ss-tag-safety{background:#FDECEA;color:#B71C1C}
.ss-tag-design{background:var(--blue-bg);color:var(--blue)}
.ss-tag-inventory{background:var(--amber-bg);color:#8D4E0B}
.ss-tag-quality{background:var(--green-bg);color:#155E38}
.ss-prio{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;display:flex;align-items:center;gap:4px}
.ss-prio svg{width:10px;height:10px;fill:currentColor}
.ss-prio-critical{color:var(--red)} .ss-prio-high{color:var(--amber)} .ss-prio-medium{color:var(--ink-mid)} .ss-prio-low{color:var(--ink-ghost)}
.ss-status{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;letter-spacing:.2px}
.ss-sdot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.s-open{color:var(--red)} .s-open .ss-sdot{background:var(--red)}
.s-progress{color:var(--amber)} .s-progress .ss-sdot{background:var(--amber)}
.s-review{color:var(--blue)} .s-review .ss-sdot{background:var(--blue)}
.s-closed{color:var(--green)} .s-closed .ss-sdot{background:var(--green)}
.ss-due{font-family:var(--fm);font-size:11px}
.due-over{color:var(--red);font-weight:600} .due-today{color:var(--amber);font-weight:600} .due-ok{color:var(--ink-ghost)}
.ss-row-actions{display:flex;gap:6px}
.ss-tbl-btn{padding:4px 10px;font-family:var(--fb);font-size:11px;font-weight:600;letter-spacing:.3px;background:var(--white);color:var(--ink);border:1px solid var(--rule);cursor:pointer;transition:all .12s;white-space:nowrap}
.ss-tbl-btn:hover{background:var(--black);color:var(--white);border-color:var(--black)}
.ss-tbl-btn.close-t:hover{background:var(--green);border-color:var(--green)}
.ss-tbl-foot{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-top:1px solid var(--rule);background:var(--surface)}
.ss-tbl-count{font-size:12px;color:var(--ink-ghost)}
.ss-pagination{display:flex;gap:3px}
.ss-pg{width:28px;height:28px;font-size:12px;font-weight:600;background:var(--white);border:1px solid var(--rule);cursor:pointer;color:var(--ink-mid);display:flex;align-items:center;justify-content:center;transition:all .12s}
.ss-pg:hover,.ss-pg.active{background:var(--black);color:var(--white);border-color:var(--black)}

/* MODAL */
.ss-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:500;align-items:center;justify-content:center}
.ss-overlay.open{display:flex}
.ss-modal{background:var(--white);width:560px;max-width:96vw;max-height:92vh;overflow-y:auto;border-top:4px solid var(--red);box-shadow:0 20px 60px rgba(0,0,0,.25);animation:modalIn .18s ease}
@keyframes modalIn{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
.ss-modal-head{padding:22px 24px 18px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid var(--rule)}
.ss-modal-title{font-family:var(--fd);font-size:22px;font-weight:800;letter-spacing:2px;text-transform:uppercase}
.ss-modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:var(--ink-ghost);padding:2px 6px;line-height:1;transition:color .12s}
.ss-modal-close:hover{color:var(--black)}
.ss-modal-body{padding:20px 24px}
.ss-mfield{margin-bottom:16px}
.ss-mfield label{display:block;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-light);margin-bottom:6px}
.ss-mfield input,.ss-mfield select,.ss-mfield textarea{width:100%;padding:10px 12px;font-family:var(--fb);font-size:13px;color:var(--black);background:var(--white);border:1px solid var(--rule);outline:none;transition:border-color .12s}
.ss-mfield input:focus,.ss-mfield select:focus,.ss-mfield textarea:focus{border-color:var(--black)}
.ss-mfield textarea{resize:vertical;min-height:80px}
.ss-mrow{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ss-modal-foot{padding:16px 24px 20px;display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--rule)}
.ss-btn-cancel{padding:9px 20px;background:var(--white);color:var(--ink);border:1px solid var(--rule);font-family:var(--fb);font-size:12px;font-weight:600;cursor:pointer;transition:all .12s}
.ss-btn-cancel:hover{border-color:var(--ink)}
.ss-btn-confirm{padding:9px 24px;background:var(--red);color:var(--white);border:none;font-family:var(--fb);font-size:12px;font-weight:700;letter-spacing:.4px;cursor:pointer;transition:background .12s}
.ss-btn-confirm:hover{background:var(--red-dark)}

/* TOAST */
.ss-toast{position:fixed;bottom:28px;right:28px;background:var(--black);color:var(--white);padding:12px 20px 12px 14px;font-size:13px;font-weight:500;z-index:1000;display:flex;align-items:center;gap:10px;opacity:0;transform:translateY(12px);transition:all .22s ease;border-left:3px solid var(--red);min-width:260px;pointer-events:none}
.ss-toast.show{opacity:1;transform:translateY(0)}
.ss-toast-icon{width:16px;height:16px;fill:var(--red);flex-shrink:0}

/* PAGE LOAD */
.ss-main>*{animation:slideUp .3s ease both}
.ss-main>*:nth-child(1){animation-delay:.05s}
.ss-main>*:nth-child(2){animation-delay:.10s}
.ss-main>*:nth-child(3){animation-delay:.15s}
.ss-main>*:nth-child(4){animation-delay:.20s}
.ss-main>*:nth-child(5){animation-delay:.25s}
.ss-main>*:nth-child(6){animation-delay:.30s}
@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

/* ── RESPONSIVE ──────────────────────────────── */
@media(max-width:1024px){
  .ss-tdiv{display:none}
  .ss-profile-name,.ss-profile-sub{display:none}
  .ss-report-btn span{display:none}
  .ss-report-btn{padding:7px 12px}
  .ss-main{padding:20px 16px 48px}
  .ss-verticals{grid-template-columns:repeat(2,1fr)}
  .ss-metrics{grid-template-columns:repeat(2,1fr)}
  .ss-welcome-name{font-size:30px}
}
@media(max-width:768px){
  .ss-topbar{padding:0 14px}
  .ss-nav{display:none}
  .ss-hamburger{display:flex}
  .ss-topbar-right{gap:6px}
  .ss-live span{display:none}
  .ss-report-btn{display:none}
  .ss-main{padding:16px 12px 60px}
  .ss-welcome{flex-direction:column;gap:8px;margin-bottom:20px}
  .ss-welcome-right{text-align:left}
  .ss-welcome-name{font-size:26px}
  .ss-wtime{font-size:16px}
  .ss-chips-label{display:none}
  .ss-scope-row{flex-direction:column;align-items:flex-start;gap:8px}
  .ss-scope-toggle{width:100%}
  .ss-scope-opt{flex:1;justify-content:center;padding:9px 8px;font-size:11px}
  .ss-verticals{grid-template-columns:repeat(2,1fr);gap:8px}
  .ss-vcard-body{padding:12px 14px 10px}
  .ss-vcount{font-size:28px}
  .ss-vname{font-size:16px}
  .ss-metrics{grid-template-columns:1fr 1fr;gap:8px}
  .ss-mvalue{font-size:42px}
  .ss-mdesc{display:none}
  .ss-tbl-hd{flex-direction:column;align-items:flex-start;gap:10px}
  .ss-tbl-actions{width:100%;flex-wrap:wrap}
  .ss-filter-sel{flex:1;min-width:0}
  .ss-btn-raise{width:100%;justify-content:center;padding:10px}
  .ss-tbl-foot{flex-direction:column;gap:10px;align-items:flex-start}
  .ss-metrics-hd{flex-direction:column;align-items:flex-start;gap:4px}
  .ss-overlay{align-items:flex-end}
  .ss-modal{width:100vw;max-width:100vw;max-height:92vh}
  .ss-mrow{grid-template-columns:1fr}
}
@media(max-width:480px){
  .ss-welcome-name{font-size:22px;letter-spacing:1px}
  .ss-mvalue{font-size:36px}
  .ss-search-input{font-size:13px}
}
`;

if (!document.getElementById("ss-styles")) {
  const s = document.createElement("style");
  s.id = "ss-styles";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* ─── DATA ────────────────────────────────────────────────── */
const buildingSnags = [
  { id:"SNC-3021", title:"Scaffold netting torn — North face parapet",         loc:"Floor 13, N-elevation",    vertical:"safety",    priority:"critical", status:"open",       assigned:"Arjun Mehta",  due:"2025-03-12" },
  { id:"SNC-3020", title:"Fire door closer not functioning, stairwell S2",     loc:"Floor 9, Stairwell S2",    vertical:"safety",    priority:"critical", status:"inprogress", assigned:"Priya Nair",   due:"2025-03-12" },
  { id:"SNC-3019", title:"Column grid D5 — vertical plumb deviation 6mm",      loc:"Floor 6, Column D5",       vertical:"design",    priority:"high",     status:"inprogress", assigned:"Vikram Das",   due:"2025-03-15" },
  { id:"SNC-3018", title:"Steel rebar short delivery — 60 bars pending",       loc:"Site Store, Bay 3",        vertical:"inventory", priority:"critical", status:"open",       assigned:"Neha Kapoor",  due:"2025-03-13" },
  { id:"SNC-3017", title:"Slab 8B — no curing compound applied",               loc:"Floor 8, Zone B",          vertical:"quality",   priority:"high",     status:"review",     assigned:"Arjun Mehta",  due:"2025-03-16" },
  { id:"SNC-3016", title:"Safety signage missing — floors 5 to 8",             loc:"Floors 5–8, all cores",    vertical:"safety",    priority:"high",     status:"open",       assigned:"Priya Nair",   due:"2025-03-17" },
  { id:"SNC-3015", title:"East elevation window frame — 9mm gap sill",         loc:"Floor 4, Units 4A–4C",     vertical:"design",    priority:"medium",   status:"open",       assigned:"Vikram Das",   due:"2025-03-19" },
  { id:"SNC-3014", title:"Concrete cube test failure — Floor 6 pour",          loc:"Floor 6, Pour Zone 3",     vertical:"quality",   priority:"high",     status:"open",       assigned:"Neha Kapoor",  due:"2025-03-14" },
  { id:"SNC-3013", title:"Plumbing slope non-compliant, Unit 4F bathroom",     loc:"Floor 4, Unit 4F",         vertical:"design",    priority:"medium",   status:"closed",     assigned:"Arjun Mehta",  due:"2025-03-10" },
  { id:"SNC-3012", title:"PPE non-compliance — Floor 10 crew observed",        loc:"Floor 10, all zones",      vertical:"safety",    priority:"medium",   status:"closed",     assigned:"Priya Nair",   due:"2025-03-11" },
];

const siteSnags = [
  ...buildingSnags,
  { id:"SNA-2891", title:"Tower crane swing radius obstruction — Block A",     loc:"Block A, Crane 2",         vertical:"safety",    priority:"critical", status:"open",       assigned:"R. Iyer",      due:"2025-03-12" },
  { id:"SNA-2890", title:"Temporary power board short circuit — Block B",      loc:"Block B, Floor 2",         vertical:"safety",    priority:"high",     status:"inprogress", assigned:"S. Patil",     due:"2025-03-13" },
  { id:"SNA-2885", title:"Structural drawing rev mismatch — Block D",          loc:"Block D, Floors 3–5",      vertical:"design",    priority:"high",     status:"open",       assigned:"K. Reddy",     due:"2025-03-16" },
  { id:"SNA-2880", title:"Cement stock below threshold — site store",          loc:"Main Store, Gate 1",       vertical:"inventory", priority:"high",     status:"open",       assigned:"M. Khan",      due:"2025-03-14" },
];

const scopeData = {
  building: { safety:14, design:11, inventory:9,  quality:18, reported:7,  completed:5,  due:8,  avg:2 },
  site:     { safety:31, design:19, inventory:16, quality:26, reported:18, completed:11, due:17, avg:3 },
};

const sparkRaw = {
  reported:  [30,45,38,60,55,70,65,100],
  completed: [55,60,50,70,48,75,68,71],
  due:       [40,50,60,45,75,80,65,100],
  avg:       [80,70,65,75,60,55,65,55],
};

const searchAnswers = {
  overdue:   "There are <strong>3 overdue snags</strong> on your building this week. SNC-3021 (scaffold netting, Critical), SNC-3018 (steel delivery, Critical), and SNC-3014 (concrete strength test). All are flagged in Safety and Inventory verticals.",
  safety:    "Block C has <strong>14 open Safety snags</strong> — 3 are Critical: torn scaffold netting (Floor 13), a non-functioning fire door (Floor 9), and missing safety signage (Floors 5–8).",
  completed: "Yesterday, <strong>5 snags were closed</strong> — 2 in Safety, 2 in Quality, and 1 in Design. Priya Nair and Arjun Mehta each resolved 2. Completion rate is ahead of last week by 12%.",
  who:       "<strong>Arjun Mehta</strong> currently holds the highest open snag count at 8, followed by Priya Nair with 6. Vikram Das and Neha Kapoor hold 5 and 4 respectively.",
  default:   "Scanning Block C snag records… Your building currently has <strong>52 open snags</strong>, with 7 logged in the last 24 hours. 4 are Critical priority.",
};

const VERTICALS = [
  { key:"safety",    label:"Safety",    critCount:3, critColor:null,
    icon:<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5zm-1 10h2v2h-2zm0-8h2v6h-2z"/></svg> },
  { key:"design",    label:"Design",    critCount:0, critColor:null,
    icon:<svg viewBox="0 0 24 24"><path d="M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41zM7 14a3 3 0 0 0-3 3 1 1 0 0 1-1 1 1 1 0 0 0 0 2 3 3 0 0 0 3-3 1 1 0 0 1 1-1 1 1 0 0 0 0-2z"/></svg> },
  { key:"inventory", label:"Inventory", critCount:1, critColor:"amber",
    icon:<svg viewBox="0 0 24 24"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg> },
  { key:"quality",   label:"Quality",   critCount:0, critColor:null,
    icon:<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> },
];

/* ─── SVG ICONS ──────────────────────────────────────────── */
const IconGrid    = () => <svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>;
const IconList    = () => <svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>;
const IconPeople  = () => <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>;
const IconDoc     = () => <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>;
const IconDown    = () => <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg>;
const IconSearch  = () => <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>;
const IconBldg    = () => <svg viewBox="0 0 24 24"><path d="M17 11V3H7v4H3v14h8v-4h2v4h8V11h-4zM7 19H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5v-2h2v2zm4 4H9v-2h2v2zm0-4H9v-2h2v2zm0-4H9V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg>;
const IconPin     = () => <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>;
const IconWarn    = () => <svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>;
const IconCheck   = () => <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>;
const IconPlus    = () => <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>;
const IconArrowUp = () => <svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>;
const IconArrowDn = () => <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>;
const IconMenu    = () => <svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>;
const IconClose   = () => <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>;

/* ─── SPARKLINE ──────────────────────────────────────────── */
function Sparkline({ data, cls }) {
  const max = Math.max(...data);
  return (
    <div className="ss-sparkline">
      {data.map((v, i) => {
        const pct = Math.round((v / max) * 100);
        const barCls = i === data.length - 1 ? "last" : v > max * 0.7 ? "hi" : "";
        return <div key={i} className={`ss-spark ${barCls}`} style={{ height: `${pct}%` }} />;
      })}
    </div>
  );
}

/* ─── ANIMATED COUNTER ───────────────────────────────────── */
function useAnimatedCount(target) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let cur = 0;
    const steps = 20, interval = 600 / steps, inc = target / steps;
    const t = setInterval(() => {
      cur = Math.min(cur + inc, target);
      setVal(Math.round(cur));
      if (cur >= target) clearInterval(t);
    }, interval);
    return () => clearInterval(t);
  }, [target]);
  return val;
}

/* ─── METRIC CARD ────────────────────────────────────────── */
function MetricCard({ accentCls, label, value, unit, trend, trendCls, desc, sparkKey }) {
  const animated = useAnimatedCount(value);
  return (
    <div className={`ss-mcard ${accentCls}`}>
      <div className="ss-mcard-top">
        <div className="ss-mlabel">{label}</div>
        <div className={`ss-mtrend ${trendCls}`}>
          {trendCls === "t-up-bad"    && <IconArrowUp />}
          {trendCls === "t-down-good" && <IconArrowDn />}
          {trend}
        </div>
      </div>
      <div className="ss-mvalue">
        {animated}{unit && <span className="ss-munit">{unit}</span>}
      </div>
      <div className="ss-mdesc">{desc}</div>
      <Sparkline data={sparkRaw[sparkKey]} cls={accentCls} />
    </div>
  );
}

/* ─── SNAG TABLE ROW ─────────────────────────────────────── */
function SnagRow({ r, today, onToast }) {
  const dueClass = r.due < today ? "due-over" : r.due === today ? "due-today" : "due-ok";
  const statusMap = { open:"s-open", inprogress:"s-progress", review:"s-review", closed:"s-closed" };
  const statusLabel = { open:"Open", inprogress:"In Progress", review:"In Review", closed:"Closed" };
  return (
    <tr>
      <td className="ss-snag-id">{r.id}</td>
      <td>
        <div className="ss-snag-title">{r.title}</div>
        <div className="ss-snag-loc">{r.loc}</div>
      </td>
      <td><span className={`ss-tag ss-tag-${r.vertical}`}>{r.vertical.charAt(0).toUpperCase()+r.vertical.slice(1)}</span></td>
      <td>
        <span className={`ss-prio ss-prio-${r.priority}`}>
          <IconWarn />{r.priority.toUpperCase()}
        </span>
      </td>
      <td>
        <span className={`ss-status ${statusMap[r.status]}`}>
          <span className="ss-sdot" />{statusLabel[r.status]}
        </span>
      </td>
      <td>{r.assigned}</td>
      <td className={`${dueClass} ss-due`}>{r.due < today ? "⚑ " : ""}{r.due}</td>
      <td>
        <div className="ss-row-actions">
          <button className="ss-tbl-btn" onClick={(e) => { e.stopPropagation(); onToast(`Reassigning ${r.id}…`); }}>Assign</button>
          {r.status === "review" && (
            <button className="ss-tbl-btn close-t" onClick={(e) => { e.stopPropagation(); onToast(`Snag ${r.id} closed`); }}>Close</button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ─── RAISE SNAG MODAL ───────────────────────────────────── */
function RaiseModal({ onClose, onSubmit }) {
  return (
    <div className="ss-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ss-modal">
        <div className="ss-modal-head">
          <div className="ss-modal-title">Raise New Snag</div>
          <button className="ss-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ss-modal-body">
          <div className="ss-mfield"><label>Snag Title</label><input type="text" placeholder="Brief description of the issue" /></div>
          <div className="ss-mrow">
            <div className="ss-mfield"><label>Vertical</label><select><option>Safety</option><option>Design</option><option>Inventory</option><option>Quality</option></select></div>
            <div className="ss-mfield"><label>Priority</label><select><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></div>
          </div>
          <div className="ss-mrow">
            <div className="ss-mfield"><label>Assign To</label><select><option>Arjun Mehta</option><option>Priya Nair</option><option>Vikram Das</option><option>Neha Kapoor</option><option>Ravi Joshi</option></select></div>
            <div className="ss-mfield"><label>Completion Deadline</label><input type="date" /></div>
          </div>
          <div className="ss-mfield"><label>Location on Site</label><input type="text" placeholder="e.g. Floor 7, Column B4, East face" /></div>
          <div className="ss-mfield"><label>Detailed Notes</label><textarea placeholder="Describe the snag in full. Include dimensions, codes, or reference drawings if applicable." /></div>
        </div>
        <div className="ss-modal-foot">
          <button className="ss-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="ss-btn-confirm" onClick={onSubmit}>Raise Snag</button>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────── */
export default function SiteSyncDashboard() {
  const [scope, setScope]               = useState("building");
  const [activeVertical, setActiveV]    = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [prioFilter, setPrioFilter]     = useState("all");
  const [searchQ, setSearchQ]           = useState("");
  const [searchAnswer, setSearchAnswer] = useState(null);
  const [modalOpen, setModalOpen]       = useState(false);
  const [toast, setToast]               = useState({ msg: "", show: false });
  const [mobileNavOpen, setMobileNav]   = useState(false);
  const [time, setTime]                 = useState(new Date());
  const [syncTime, setSyncTime]         = useState("");
  const toastTimer = useRef(null);

  /* Clock */
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Sync label */
  useEffect(() => {
    setSyncTime("Last sync: " + new Date().toLocaleTimeString());
    const t = setInterval(() => setSyncTime("Last sync: " + new Date().toLocaleTimeString()), 30000);
    return () => clearInterval(t);
  }, []);

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, show: true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 3200);
  }, []);

  const handleScope = (s) => {
    setScope(s);
    showToast(s === "site" ? "Switched to site-wide view" : "Switched to Block C view");
  };

  /* Search */
  const runSearch = useCallback(() => {
    const q = searchQ.toLowerCase();
    let resp = searchAnswers.default;
    if (q.includes("overdue") || q.includes("week") || q.includes("late"))         resp = searchAnswers.overdue;
    else if (q.includes("safety") || q.includes("critical"))                        resp = searchAnswers.safety;
    else if (q.includes("complet") || q.includes("yesterday") || q.includes("done"))resp = searchAnswers.completed;
    else if (q.includes("who") || q.includes("highest") || q.includes("most"))     resp = searchAnswers.who;
    setSearchAnswer(resp);
  }, [searchQ]);

  /* Filtered table */
  const today = new Date().toISOString().split("T")[0];
  const tableData = (scope === "site" ? siteSnags : buildingSnags)
    .filter(r => activeVertical === "all" || r.vertical === activeVertical)
    .filter(r => statusFilter  === "all" || r.status   === statusFilter)
    .filter(r => prioFilter    === "all" || r.priority === prioFilter);

  const d = scopeData[scope];

  const wDate = time.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  const wTime = time.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", second:"2-digit" });

  return (
    <div className="ss-root">
      {/* ── TOPBAR ── */}
      <header className="ss-topbar">
        <div className="ss-logo">
          <div className="ss-logo-icon"><IconGrid /></div>
          SITESYNC
        </div>
        <div className="ss-tdiv" />
        <nav className="ss-nav">
          <a className="ss-nav-item active"><IconGrid />Dashboard</a>
          <a className="ss-nav-item ss-nav-allsnags" onClick={() => showToast("Opening all snags…")}><IconList />All Snags</a>
          <a className="ss-nav-item ss-nav-attend"   onClick={() => showToast("Opening attendance…")}><IconPeople />Attendance</a>
          <a className="ss-nav-item"                 onClick={() => showToast("Opening reports…")}><IconDoc />Reports</a>
        </nav>

        <button className="ss-hamburger" onClick={() => setMobileNav(o => !o)} aria-label="Menu">
          {mobileNavOpen ? <IconClose /> : <IconMenu />}
        </button>

        <div className="ss-topbar-right">
          <button className="ss-report-btn" onClick={() => showToast("Generating PDF report…")}>
            <IconDown /><span>Generate Report</span>
          </button>
          <div className="ss-tdiv" />
          <div className="ss-live">
            <div className="ss-live-dot" />
            <span>LIVE</span>
          </div>
          <div className="ss-tdiv" />
          <div className="ss-profile">
            <div className="ss-avatar">SS</div>
            <div>
              <div className="ss-profile-name">Shreyash Sharma</div>
              <div className="ss-profile-sub">Sr. Engineer · Block C</div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile nav drawer */}
      <nav className={`ss-mobile-nav ${mobileNavOpen ? "open" : ""}`}>
        <a className="ss-nav-item active" onClick={() => setMobileNav(false)}><IconGrid />Dashboard</a>
        <a className="ss-nav-item ss-nav-allsnags" onClick={() => { setMobileNav(false); showToast("Opening all snags…"); }}><IconList />All Snags</a>
        <a className="ss-nav-item ss-nav-attend"   onClick={() => { setMobileNav(false); showToast("Opening attendance…"); }}><IconPeople />Attendance</a>
        <a className="ss-nav-item"                 onClick={() => { setMobileNav(false); showToast("Opening reports…"); }}><IconDoc />Reports</a>
      </nav>

      {/* ── MAIN ── */}
      <main className="ss-main">

        {/* Welcome */}
        <div className="ss-welcome">
          <div>
            <div className="ss-welcome-greeting">Good morning</div>
            <div className="ss-welcome-name">Welcome, <span className="ss-welcome-accent">Shreyash</span></div>
            <div className="ss-welcome-ctx">Block C &nbsp;·&nbsp; Floors 1–14 &nbsp;·&nbsp; 52 active snags across your building</div>
          </div>
          <div className="ss-welcome-right">
            <div className="ss-wdate">{wDate}</div>
            <div className="ss-wtime">{wTime}</div>
          </div>
        </div>

        {/* Search */}
        <div className="ss-search">
          <div className="ss-search-bar">
            <div className="ss-search-prefix"><IconSearch /></div>
            <input
              className="ss-search-input"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runSearch()}
              placeholder="Ask anything — e.g. 'What safety issues are unresolved on Floor 7?'"
            />
            <button className="ss-search-btn" onClick={runSearch}>Ask</button>
          </div>
          <div className="ss-chips">
            <span className="ss-chips-label">Try:</span>
            {["Which snags are overdue this week?","Show me all critical safety issues","What did the team complete yesterday?","Who has the highest open snag count?"].map(q => (
              <span key={q} className="ss-chip" onClick={() => { setSearchQ(q); setTimeout(runSearch, 0); }}>{q}</span>
            ))}
          </div>
          {searchAnswer && (
            <div className="ss-answer">
              <div className="ss-answer-tag">Response</div>
              <div className="ss-answer-body" dangerouslySetInnerHTML={{ __html: searchAnswer }} />
            </div>
          )}
        </div>

        {/* Scope toggle */}
        <div className="ss-scope-row">
          <div className="ss-scope-label">Viewing scope</div>
          <div className="ss-scope-toggle">
            <button className={`ss-scope-opt ${scope === "building" ? "active" : ""}`} onClick={() => handleScope("building")}>
              <IconBldg />My Building — Block C
            </button>
            <button className={`ss-scope-opt ${scope === "site" ? "active" : ""}`} onClick={() => handleScope("site")}>
              <IconPin />Entire Site
            </button>
          </div>
        </div>

        {/* Verticals */}
        <div className="ss-verticals">
          {VERTICALS.map(v => (
            <div
              key={v.key}
              className={`ss-vcard ${activeVertical === v.key ? "active" : ""}`}
              onClick={() => setActiveV(activeVertical === v.key ? "all" : v.key)}
            >
              <div className="ss-vcard-top" />
              <div className="ss-vcard-body">
                <div className="ss-vcard-icon-row">
                  <div className="ss-vcard-icon">{v.icon}</div>
                  {v.critCount > 0 ? (
                    <div className="ss-vcrit" style={v.critColor ? { color:"var(--amber)", background:"var(--amber-bg)" } : {}}>
                      <IconWarn />{v.critCount} Critical
                    </div>
                  ) : (
                    <div className="ss-vcrit none"><IconCheck />0 Critical</div>
                  )}
                </div>
                <div className="ss-vname">{v.label}</div>
                <div className="ss-vcount">{d[v.key]}</div>
                <div className="ss-vsub">open snags</div>
              </div>
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div className="ss-metrics-hd">
          <div className="ss-section-title">Live Performance — Last 24 Hours</div>
          <div className="ss-sync">{syncTime}</div>
        </div>
        <div className="ss-metrics">
          <MetricCard accentCls="m-red"   label="Snags Reported"    value={d.reported}  unit=""  trend="+2 vs yesterday" trendCls="t-up-bad"    desc="New snags logged across all verticals in the last 24 hrs" sparkKey="reported" />
          <MetricCard accentCls="m-green" label="Snags Completed"   value={d.completed} unit=""  trend="−1 vs yesterday" trendCls="t-down-good"  desc="Reviewed and closed by senior engineers in last 24 hrs"   sparkKey="completed" />
          <MetricCard accentCls="m-amber" label="Due Today"         value={d.due}       unit=""  trend="3 already overdue" trendCls="t-up-bad"   desc="Engineer-committed deadlines expiring today"              sparkKey="due" />
          <MetricCard accentCls="m-black" label="Avg. Days to Close" value={d.avg}      unit="d" trend="3.1d last week"  trendCls="t-neutral"    desc="Mean resolution time across open snags"                   sparkKey="avg" />
        </div>

        {/* Table */}
        <div className="ss-tbl-hd">
          <div className="ss-section-title">{scope === "building" ? "Recent Snags — Block C" : "Recent Snags — Entire Site"}</div>
          <div className="ss-tbl-actions">
            <select className="ss-filter-sel" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="inprogress">In Progress</option>
              <option value="review">In Review</option>
              <option value="closed">Closed</option>
            </select>
            <select className="ss-filter-sel" value={prioFilter} onChange={e => setPrioFilter(e.target.value)}>
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
            <button className="ss-btn-raise" onClick={() => setModalOpen(true)}>
              <IconPlus />Raise Snag
            </button>
          </div>
        </div>

        <div className="ss-tbl-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Snag ID</th><th>Description</th><th>Vertical</th>
                <th>Priority</th><th>Status</th><th>Assigned To</th>
                <th>Due</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map(r => (
                <SnagRow key={r.id} r={r} today={today} onToast={showToast} />
              ))}
            </tbody>
          </table>
          <div className="ss-tbl-foot">
            <div className="ss-tbl-count">Showing {tableData.length} snag{tableData.length !== 1 ? "s" : ""}</div>
            <div className="ss-pagination">
              {[1, 2, 3, "›"].map((p, i) => (
                <div key={i} className={`ss-pg ${i === 0 ? "active" : ""}`}>{p}</div>
              ))}
            </div>
          </div>
        </div>

      </main>

      {/* Modal */}
      {modalOpen && (
        <RaiseModal
          onClose={() => setModalOpen(false)}
          onSubmit={() => { setModalOpen(false); showToast("New snag raised and assigned successfully"); }}
        />
      )}

      {/* Toast */}
      <div className={`ss-toast ${toast.show ? "show" : ""}`}>
        <svg className="ss-toast-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <span>{toast.msg}</span>
      </div>
    </div>
  );
}
