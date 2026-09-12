#!/usr/bin/env python3
"""Generates the slice-2 artboards (.dc.html) + canvas.json from real deal rows.
Values lifted from site/src/styles/{v2,poster-bead}.css and colors_and_type.css."""
import json, os
OUT = os.path.dirname(os.path.abspath(__file__))

CSS = r"""
:root{--v2-ink:#16120D;--v2-amber:#F08A00;--v2-amber-deep:#C56A07;--v2-paper:#FBF6EC;
--sand-200:#E0D2BA;--sand-300:#C8B79C;--sand-400:#A8967A;--sand-500:#877860;--sand-600:#685B47;--line:#E0D2BA;
--sea-600:#0A6354;--accent:#0F7C68;--brand:#E2820E;--coral-600:#B53017;
--font-display:'Bricolage Grotesque','Hanken Grotesk',system-ui,sans-serif;--font-body:'Hanken Grotesk',system-ui,sans-serif;--font-mono:'Space Mono',ui-monospace,monospace;
--poster-sun:linear-gradient(160deg,#F5B93F 0%,#EE7A1F 48%,#B5390F 100%);--poster-dusk:linear-gradient(160deg,#ED7660 0%,#B53017 55%,#3F2A20 100%);
--poster-sea:linear-gradient(160deg,#54B7A2 0%,#0F7C68 55%,#082F2A 100%);--poster-stone:linear-gradient(160deg,#F3B84E 0%,#B57827 55%,#4A2F12 100%);
--d-hero:clamp(64px,9.5vw,128px);--d-poster:clamp(56px,8vw,104px);--d-index:clamp(30px,3.6vw,46px);--d-quote:clamp(26px,3vw,38px);--bead-ease:cubic-bezier(.34,1.56,.64,1);--ink-ease:cubic-bezier(.22,1,.36,1)}
*{box-sizing:border-box}body{margin:0;background:var(--v2-paper);color:var(--v2-ink);font-family:var(--font-body);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}a:hover{color:var(--v2-amber-deep)}
.wrap{max-width:1240px;margin:0 auto;padding-inline:40px}.mono{font-family:var(--font-mono)}
.bead{display:inline-block;width:.16em;height:.16em;border-radius:50%;background:var(--v2-amber);vertical-align:baseline}
.yip-logo{font-family:var(--font-display);font-weight:800;letter-spacing:-.03em;line-height:1;position:relative;display:inline-block;color:#1C1813}
.yip-logo::after{content:"";position:absolute;width:.175em;height:.175em;border-radius:50%;background:#E2820E;left:.5em;top:.015em}
.v2-display{font-family:var(--font-display);font-weight:800;letter-spacing:-.035em;line-height:.96;color:var(--v2-ink)}
.v2-poster-name{font-family:var(--font-display);font-weight:800;text-transform:uppercase;letter-spacing:-.02em;line-height:.9;color:#fff}
.v2-kicker{font-family:var(--font-mono);font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--v2-ink)}.v2-kicker--dim{color:var(--sand-500)}
.v2-price{font-family:var(--font-display);font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.v2-stamp{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--sea-600);border:1.5px solid currentColor;border-radius:6px;padding:6px 10px;transform:rotate(-1.2deg)}
.v2-stamp--light{color:#fff;border-color:rgba(255,255,255,.85)}
.v2-masthead{position:sticky;top:0;z-index:40;background:rgba(251,246,236,.95);border-bottom:1.5px solid var(--v2-ink)}
.v2-masthead .bar{display:flex;align-items:center;gap:28px;height:64px}.v2-masthead .logo{font-size:27px}
.v2-masthead .navlinks{display:flex;gap:20px;font-family:var(--font-mono);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.v2-masthead .mid{flex:1;text-align:center}
.v2-masthead .pill{display:inline-flex;align-items:center;gap:9px;background:var(--v2-amber);color:var(--v2-ink);font-weight:700;font-size:14px;padding:10px 18px;border-radius:99px}
.v2-masthead .pill .bead{width:8px;height:8px;background:var(--v2-ink)}
.v2-hero{padding-block:70px 48px}.v2-hero h1{font-size:var(--d-hero);margin:18px 0 0}.v2-hero h1 .bead{width:.13em;height:.13em;margin-left:.06em}
.v2-hero .sub-row{display:flex;align-items:baseline;justify-content:space-between;gap:40px;margin-top:26px;flex-wrap:wrap}
.v2-hero .lead{font-size:19px;line-height:1.5;color:var(--sand-600);max-width:46ch;margin:0}
.v2-poster{position:relative;display:flex;flex-direction:column;justify-content:space-between;gap:26px;border-radius:28px;overflow:hidden;color:#fff;min-height:500px;padding:36px 40px;background:var(--poster-sun)}
.v2-poster::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to top,rgba(22,18,13,.42),transparent 55%)}
.v2-poster>*{position:relative}.v2-poster .top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.v2-poster .top .v2-kicker{color:rgba(255,255,255,.92)}.v2-poster .name{font-size:var(--d-poster);text-shadow:0 2px 24px rgba(0,0,0,.25);margin:0}
.v2-poster .blurb{font-size:18px;line-height:1.4;margin:14px 0 0;opacity:.95;max-width:46ch}
.v2-poster .foot{display:flex;align-items:flex-end;justify-content:space-between;gap:32px;flex-wrap:wrap}
.v2-poster .routebox{flex:1;min-width:240px;max-width:420px}.v2-poster .ends{display:flex;justify-content:space-between;font-size:14px;font-weight:700;letter-spacing:.08em;margin-bottom:10px}
.bead-route{position:relative;height:10px}.bead-route .track{position:absolute;inset:4px 0;border-top:2px dotted rgba(255,255,255,.55)}.bead-route .bead{position:absolute;top:0;left:38%;width:10px;height:10px}
.v2-poster .pricecell{display:flex;align-items:flex-end;gap:28px;flex-wrap:wrap}.v2-poster .price{font-size:clamp(52px,6vw,88px);line-height:.9}
.v2-poster .price s{font-family:var(--font-body);font-weight:500;font-size:18px;opacity:.8;letter-spacing:0;margin-left:10px}
.v2-poster .save{font-size:11px;font-weight:700;letter-spacing:.1em;opacity:.9;text-transform:uppercase;margin-top:4px}
.v2-poster .cta{display:inline-flex;align-items:center;gap:10px;background:var(--v2-paper);color:var(--v2-ink);font-weight:700;font-size:16px;padding:16px 26px;border-radius:14px}.v2-poster .cta .bead{width:9px;height:9px}
.v2-poster--sun{background:var(--poster-sun)}.v2-poster--dusk{background:var(--poster-dusk)}.v2-poster--sea{background:var(--poster-sea)}.v2-poster--stone{background:var(--poster-stone)}
.v2-poster--dead{background:linear-gradient(160deg,#C8B79C 0%,#877860 55%,#4A4034 100%)}
.v2-catchline{display:flex;gap:22px;flex-wrap:wrap;padding:14px 6px 0;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--sand-500)}
.v2-catchline span::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--v2-amber);margin-right:9px;vertical-align:2px}
.v2-capture{padding-block:56px 8px}.v2-capture .inner{border-top:1.5px solid var(--v2-ink);padding-top:26px;display:flex;align-items:center;justify-content:space-between;gap:32px;flex-wrap:wrap}
.v2-capture .line{font-family:var(--font-display);font-weight:600;font-size:clamp(19px,2vw,24px);letter-spacing:-.015em;max-width:44ch;margin:0}
.v2-capture form{display:flex;gap:10px;flex:1;min-width:300px;max-width:460px}
.v2-capture input{flex:1;min-width:0;font-size:15px;padding:13px 16px;border-radius:12px;border:1.5px solid var(--sand-300);background:#fff;color:var(--v2-ink);font-family:inherit}
.v2-capture .btn{font-weight:700;font-size:15px;padding:13px 22px;border-radius:12px;background:var(--v2-amber);color:var(--v2-ink);border:0;font-family:inherit}
.v2-sec{padding-block:64px 8px}.v2-sec .head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:6px;flex-wrap:wrap}
.v2-sec .head h2{font-size:clamp(30px,3.4vw,40px);margin:0}.v2-sec .head h2 .bead{width:11px;height:11px;margin-left:8px}
.v2-row{display:grid;grid-template-columns:64px 1fr auto auto;gap:24px;align-items:baseline;padding:26px 8px;border-top:1px solid var(--line);position:relative}
.v2-rows>.v2-row:last-child{border-bottom:1px solid var(--line)}
.v2-row .no{font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--sand-400)}
.v2-row-name{font-family:var(--font-display);font-weight:800;font-size:var(--d-index);letter-spacing:-.025em;line-height:1;color:var(--v2-ink)}
.v2-row-meta{font-family:var(--font-mono);font-size:12px;text-transform:uppercase;color:var(--sand-500)}
.v2-row-price{font-family:var(--font-display);font-weight:800;font-size:clamp(22px,2.6vw,32px);letter-spacing:-.03em;color:var(--v2-ink)}
.v2-row .v2-row-price s{font-family:var(--font-body);font-weight:500;font-size:15px;color:var(--sand-500);margin-left:8px}
.v2-row--dead .v2-row-name{text-decoration:line-through;text-decoration-thickness:3px;text-decoration-color:#B53017}.v2-row--dead .v2-row-price{color:var(--sand-500)}
.v2-row--locked .v2-row-price{font-family:var(--font-mono);font-weight:700;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--brand);display:inline-flex;align-items:center;gap:8px}
.v2-row--locked .v2-row-price .bead{width:7px;height:7px}
.v2-footnote{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--sand-500);padding:14px 8px 0}.v2-footnote a{color:var(--accent)}
.v2-crumb{padding:22px 0 2px;font-family:var(--font-mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--sand-500)}.v2-crumb a{color:var(--accent)}
.v2-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:40px;padding:40px 0 8px}
.v2-cols h3{font-family:var(--font-mono);font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin:0 0 14px}.v2-cols h3.good{color:var(--accent)}.v2-cols h3.cav{color:var(--sand-500)}
.v2-li{display:flex;gap:12px;align-items:baseline;font-size:16.5px;line-height:1.55;color:var(--v2-ink);padding:7px 0}.v2-li .bead{flex:none;width:7px;height:7px}.v2-li.cav .bead{background:var(--sand-400)}
.v2-context{border-top:1px solid var(--line);padding:34px 0 6px}
.v2-context .big{font-family:var(--font-display);font-weight:800;font-size:clamp(24px,3vw,36px);letter-spacing:-.02em;margin:6px 0 10px}
.v2-spark{margin-top:22px;max-width:720px}.v2-spark .bars{display:flex;align-items:flex-end;gap:6px;height:92px}
.v2-spark .bars i{flex:1;background:#EFE6D4;border-radius:3px 3px 0 0;min-height:4px;display:block}.v2-spark .bars i.today{flex:1.6;background:var(--v2-amber)}
.v2-spark .lbls{display:flex;gap:22px;flex-wrap:wrap;margin-top:12px;font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--sand-500)}.v2-spark .lbls b{color:var(--v2-ink)}
.v2-curator{max-width:850px;margin:44px auto 0;text-align:center}.v2-curator .mark{width:14px;height:14px;border-radius:50%;background:var(--v2-amber);margin:0 auto 22px}
.v2-curator .txt{font-family:var(--font-display);font-weight:600;font-size:var(--d-quote);line-height:1.25;letter-spacing:-.02em}
.v2-curator .sig{font-family:var(--font-mono);font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:var(--sand-500);margin-top:20px}
.v2-linkband{padding:26px 0 0;font-family:var(--font-mono);font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:var(--sand-500)}.v2-linkband a{color:var(--accent);margin-right:18px}
.v2-ink-band{background:var(--v2-ink);color:var(--v2-paper);padding:84px 0;position:relative;overflow:hidden;margin-top:64px}
.v2-ink-band .sunball{position:absolute;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle at 35% 35%,var(--v2-amber) 0%,#9C520A 68%,transparent 72%);right:-120px;top:-140px;opacity:.85}
.v2-ink-band .grid{position:relative;display:grid;grid-template-columns:1.2fr 1fr;gap:60px;align-items:center}
.v2-ink-band h2{font-size:clamp(34px,4.2vw,54px);line-height:1.02;margin:0;color:var(--v2-paper)}
.v2-ink-band .body{color:var(--sand-300);font-size:17px;line-height:1.55;margin-top:16px;max-width:42ch}
.v2-ink-band .frow{display:flex;gap:10px}.v2-ink-band input{flex:1;min-width:0;font-size:16px;padding:16px 18px;border-radius:14px;border:1.5px solid rgba(255,255,255,.25);background:rgba(255,255,255,.07);color:var(--v2-paper);font-family:inherit}
.v2-ink-band .btn{font-weight:700;font-size:16px;padding:16px 26px;border-radius:14px;background:var(--v2-amber);color:var(--v2-ink);border:0;font-family:inherit}
.v2-ink-band .fine{font-family:var(--font-mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--sand-300);margin-top:16px}
.v2-footer{border-top:1.5px solid var(--v2-ink);padding:26px 0}.v2-footer .bar{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
.v2-footer .links{display:flex;gap:24px;flex:1;justify-content:center;font-size:14px;font-weight:500;color:var(--sand-600)}
.v2-footer .legal{font-family:var(--font-mono);font-size:11px;color:var(--sand-500);text-transform:uppercase;letter-spacing:.08em}
/* production mobile rules, verbatim from site/src/styles/v2.css */
@media (max-width: 720px) {
  .wrap { padding-inline: 16px; }
  .v2-masthead .bar { height: 54px; gap: 12px; }
  .v2-masthead .mid { display: none; }
  .v2-masthead .navlinks { gap: 12px; font-size: 11px; letter-spacing: .1em; flex: 1; }
  .v2-masthead .pill { font-size: 13px; padding: 8px 14px; }
  .v2-hero { padding-block: 26px 18px; }
  .v2-hero .sub-row { margin-top: 12px; gap: 10px; }
  .v2-hero .lead { font-size: 13.5px; }
  .v2-stamp { font-size: 11px; letter-spacing: .1em; }
  .v2-poster { min-height: 400px; padding: 20px 18px; border-radius: 22px; gap: 14px; }
  .v2-poster .blurb { font-size: 13.5px; }
  .v2-poster .cta { font-size: 14px; padding: 13px 18px; border-radius: 12px; }
  .v2-poster .price s { font-size: 14px; }
  .v2-catchline { gap: 14px; font-size: 11px; }
  .v2-sec, .v2-capture { padding-block: 32px 8px; }
  .v2-capture .inner { flex-direction: column; align-items: stretch; gap: 14px; }
  .v2-capture form { max-width: none; }
  .v2-row { grid-template-columns: auto 1fr auto; gap: 4px 14px; padding: 16px 4px; }
  .v2-row .no { display: none; }
  .v2-row .v2-row-meta { grid-column: 1 / -1; font-size: 11px; }
  .v2-row .v2-row-price { justify-self: end; }
  /* touch has no hover — live rows carry a visible bead affordance */
  a.v2-row .v2-row-name::after {
    content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    background: var(--v2-amber); margin-left: 8px; vertical-align: 6px;
  }
  .v2-ink-band { padding: 44px 0; margin-top: 32px; }
  .v2-ink-band .grid { grid-template-columns: 1fr; gap: 24px; }
  .v2-ink-band form .frow { flex-direction: column; }
  .v2-ink-band .sunball { width: 200px; height: 200px; right: -60px; top: -80px; }
  .v2-footer .bar { flex-direction: column; align-items: flex-start; gap: 14px; }
  .v2-footer .links { justify-content: flex-start; gap: 16px; flex: none; }
}

@media (max-width: 640px){.v2-cols{grid-template-columns:1fr;gap:24px;padding-top:28px}}

/* NEW in slice 2 — proposed, not in production yet */
.v2-checks{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.v2-check{display:inline-flex;flex-direction:column;gap:4px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-family:var(--font-mono);font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--sand-500);background:#fff}
.v2-check b{font-family:var(--font-display);font-size:20px;font-weight:800;letter-spacing:-.02em;color:var(--v2-ink);text-transform:none}
.v2-check--up b{color:var(--coral-600)}.v2-check--up{border-color:var(--coral-600)}
.v2-check--today{border-color:var(--v2-amber);border-width:1.5px}
.v2-checkline{display:flex;gap:0;flex-wrap:wrap;margin-top:14px;font-family:var(--font-mono);font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--sand-500)}
.v2-checkline span{padding-right:18px;margin-right:18px;border-right:1px solid var(--line)}.v2-checkline span:last-child{border:0}
.v2-checkline b{color:var(--v2-ink);font-weight:700}.v2-checkline .up b{color:var(--coral-600)}
.v2-spark .bars i.today.dead{background:#B53017}
.ph-plain{font-family:var(--font-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--sand-500)}
.v2-lasted{font-family:var(--font-mono);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#B53017}
.ph{font-family:var(--font-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--sand-500);border:1px dashed var(--sand-400);border-radius:4px;padding:1px 6px}.v2-poster .ph{color:#fff;border-color:rgba(255,255,255,.7)}
.v2-dead-note{font-size:18px;line-height:1.5;color:var(--sand-600);max-width:52ch;margin:10px 0 0}
"""

HEAD = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:ital,wght@0,400..800;1,400..600&family=Space+Mono:wght@400;700&display=swap">
  <style>%s</style>
</helmet>
""" % CSS
TAIL = "</x-dc>\n</body>\n</html>\n"

def ph(label, value=""):
    return f'<span class="ph">[kopija: {label}]</span>{(" " + value) if value else ""}'

def masthead():
    return """<header class="v2-masthead"><div class="wrap bar">
<a href="#" class="yip-logo logo">yıp</a>
<nav class="navlinks"><a href="#">Radiniai</a><a href="#">Kryptys</a></nav>
<span class="v2-kicker v2-kicker--dim mid">Atrinkti skrydžiai — Vilnius · Kaunas · Ryga</span>
<a href="#kapote" class="pill"><span class="bead"></span>Noriu radinių</a>
</div></header>
"""

def capture(line="Kasdien peržiūrim visus maršrutus iš VNO, KUN ir RIX. Skelbiam tik tai, kas atlaiko patikrą."):
    return f"""<section class="wrap v2-capture"><div class="inner">
<p class="line">{line}</p>
<form><input type="email" placeholder="tavo@pastas.lt"><button type="button" class="btn">Noriu radinių</button></form>
</div></section>
"""

def inkband():
    return """<section class="v2-ink-band" id="kapote"><div class="sunball"></div>
<div class="wrap grid">
<div><h2 class="v2-display">Kitas radinys dings per porą dienų.</h2>
<p class="body">Prenumeratoriai gauna kiekvieną radinį tą rytą, kai jį patvirtinam. Kol jis čia — pigiausių vietų dažnai nebelieka.</p></div>
<form><div class="frow"><input type="email" placeholder="tavo@pastas.lt"><button type="button" class="btn">Noriu radinių</button></div>
<div class="fine">Nemokama · 3–5 radiniai per savaitę · be spamo · atsisakai kada nori</div>
<div class="fine">Bilietą perki tiesiogiai iš aviakompanijos — mes tavo pinigų neliečiam.</div></form>
</div></section>
"""

def footer():
    return """<footer class="v2-footer"><div class="wrap bar">
<span class="yip-logo" style="font-size:22px">yıp</span>
<nav class="links"><a href="#">Visi radiniai</a><a href="#">Iš Vilniaus</a><a href="#">Iš Kauno</a><a href="#">Iš Rygos</a><a href="#">Buvę radiniai</a><a href="#">Privatumas</a></nav>
<span class="legal">© 2026 · Sukurta Vilniuje</span>
</div></footer>
"""

def row(no, name, meta, price, cls=""):
    return f"""<div class="v2-row {cls}"><span class="no">{no}</span><span class="v2-row-name">{name}</span><span class="v2-row-meta">{meta}</span><span class="v2-row-price">{price}</span></div>
"""

def locked(no, name, meta):
    return f"""<div class="v2-row v2-row--locked"><span class="no">{no}</span><span class="v2-row-name">{name}</span><span class="v2-row-meta">{meta}</span><span class="v2-row-price"><span class="bead"></span>kaina — laiške</span></div>
"""

def dead(month, name, meta, price, was, lasted):
    return f"""<div class="v2-row v2-row--dead"><span class="no">{month}</span><span class="v2-row-name">{name}</span><span class="v2-row-meta">{meta} · <span class="ph-plain">[kopija: trukmė]</span> {lasted}</span><span class="v2-row-price">{price}<s>{was}</s></span></div>
"""

def trophy():
    return f"""<section class="wrap v2-sec"><div class="head"><h2 class="v2-display">Buvo. Nebėra.</h2><span class="v2-kicker v2-kicker--dim">Kas gavo laišką — spėjo.</span></div>
<div class="v2-rows">
{dead("GRUOD", "Londonas", "VNO → STN · sutaupė 182 € · gruod. 4–6", "93 €", "275 €", "14 d.")}{dead("LAPKR", "Larnaka", "VNO → LCA · sutaupė 141 € · lapkr. 14–21", "96 €", "237 €", "14 d.")}{dead("GRUOD", "Berlynas", "VNO → BER · sutaupė 72 € · gruod. 23–25", "72 €", "144 €", "14 d.")}</div>
<div class="v2-footnote">Retas radinys gyvena porą dienų. Laišką gauni anksčiau, nei jis dingsta.</div>
</section>
"""

# ---------------- Main: home, live edition (12 real deals, 2026-09-12) ----------------
main = HEAD + masthead() + """
<section class="wrap v2-hero">
<div class="v2-kicker">Laiškas Nr. 1</div>
<h1 class="v2-display">Randam pigius skrydžius, kad tau nereikėtų<span class="bead"></span></h1>
<div class="sub-row"><p class="lead">Iš Vilniaus, Kauno ir Rygos — 3–5 atrinkti radiniai per savaitę. Prie kiekvieno: kodėl verta ir koks kabliukas. Bilietą perki tiesiogiai.</p>
<span class="v2-stamp"><span class="bead" style="width:7px;height:7px"></span>patikrino žmogus · """ + ph("laikas","06:41") + """</span></div>
</section>
<section class="wrap"><div class="v2-poster v2-poster--stone">
<div class="top"><span class="v2-kicker">Radinys Nr. 01 iš 12 · šią savaitę</span><span class="v2-stamp v2-stamp--light">Geras radinys</span></div>
<div><h2 class="v2-poster-name name">Berlynas</h2><p class="blurb">Gera kaina šiam maršrutui — pigiau nei įprastai.</p></div>
<div class="foot"><div class="routebox"><div class="mono ends"><span>VNO</span><span>TIESIOGINIS</span><span>BER</span></div><div class="bead-route"><span class="track"></span><span class="bead"></span></div></div>
<div class="pricecell"><div><div class="v2-price price">88 €<s>153 €</s></div><div class="mono save">sutaupai 65 € nuo įprastos kainos</div></div><a class="cta" href="#">Skrendam? <span class="bead"></span></a></div></div>
</div>
<div class="mono v2-catchline"><span>Tiesioginis</span><span>gruod. 7–9</span><span>Wizz Air · atnaujinta šįryt</span></div>
</section>
""" + capture() + trophy() + """
<section class="wrap v2-sec"><div class="head"><h2 class="v2-display">Dar spėji<span class="bead"></span></h2><span class="v2-kicker v2-kicker--dim">Šįryt radom 12 · čia rodom 3 · atnaujinta šįryt</span></div>
<div class="v2-rows">
""" + row("Nr. 02", "Milanas", "VNO → MXP · gruod. 14–16 · Tiesioginis", "78 €") \
    + row("Nr. 03", "Edinburgas", "KUN → EDI · gruod. 4–6 · Tiesioginis", "114 €") \
    + locked("Nr. 04", "Praha", "VNO → PRG · lapkritis · Tiesioginis") \
    + locked("Nr. 05", "Mančesteris", "RIX → MAN · lapkritis · Tiesioginis") \
    + locked("Nr. 06", "Londonas", "VNO → STN · gruodis · Tiesioginis") \
    + locked("Nr. 07", "Budapeštas", "VNO → BUD · gruodis · Tiesioginis") \
    + """<a href="#kapote" class="v2-row v2-row--locked"><span class="no">Nr. 08–12</span><span class="v2-row-name">+ dar 5 radiniai</span><span class="v2-row-meta">Bergamas · Malaga · Malaga · Niurnbergas · Londonas</span><span class="v2-row-price"><span class="bead"></span>kaina — laiške</span></a>
</div>
<div class="v2-footnote">Prenumeratoriai jau žino šias kainas. <a href="#kapote">Noriu radinių →</a></div>
</section>
""" + inkband() + footer() + TAIL

# ---------------- HomeEmpty: 0 live deals ----------------
home_empty = HEAD + masthead() + """
<section class="wrap v2-hero">
<div class="v2-kicker">Laiškas Nr. 1</div>
<h1 class="v2-display">Randam pigius skrydžius, kad tau nereikėtų<span class="bead"></span></h1>
<div class="sub-row"><p class="lead">Iš Vilniaus, Kauno ir Rygos — 3–5 atrinkti radiniai per savaitę. Prie kiekvieno: kodėl verta ir koks kabliukas. Bilietą perki tiesiogiai.</p>
<span class="v2-stamp"><span class="bead" style="width:7px;height:7px"></span>patikrino žmogus</span></div>
</section>
<section class="wrap"><div class="mono v2-footnote" style="padding:4px 0 0">Gyvų radinių šiuo metu nėra — medžiojam kitą. <a href="#kapote">Noriu radinių →</a></div></section>
""" + capture() + trophy() + inkband() + footer() + TAIL

# ---------------- Deal page builders ----------------
def deal_page(*, crumb_dest, poster_cls, kicker, stamp, name, blurb, o, d, legs, price_html, save_html, cta_html,
              catch, why, cav, curator, context_big, checks_html, similar, links, lasted_html="", series=None, today=None, capture_row=True, dead=False):
    spark_html = spark(series, today, dead) if series else ""
    why_html = "".join(f'<div class="v2-li"><span class="bead"></span><span>{w}</span></div>' for w in why)
    cav_html = "".join(f'<div class="v2-li cav"><span class="bead"></span><span>{c}</span></div>' for c in cav)
    cur = f"""<section class="wrap"><div class="v2-curator"><div class="mark"></div><div class="txt">„{curator}“</div><div class="sig">— Yip kuratorius, Vilnius</div></div></section>""" if curator else ""
    sim = "".join(row(f"Nr. 0{i+1}", *s) for i, s in enumerate(similar))
    sim_sec = f"""<section class="wrap v2-sec"><div class="head"><h2 class="v2-display">Daugiau tokių radinių<span class="bead"></span></h2></div><div class="v2-rows">{sim}</div></section>""" if similar else ""
    return HEAD + masthead() + f"""
<nav class="wrap v2-crumb"><a href="#">Radiniai</a> › <a href="#">Pigūs skrydžiai iš Vilniaus</a> › {crumb_dest}</nav>
<section class="wrap" style="padding-top:14px"><div class="v2-poster {poster_cls}">
<div class="top"><span class="v2-kicker">{kicker}</span><span class="v2-stamp v2-stamp--light">{stamp}</span></div>
<div><h1 class="v2-poster-name name">{name}</h1><p class="blurb">{blurb}</p></div>
<div class="foot"><div class="routebox"><div class="mono ends"><span>{o}</span><span>{legs}</span><span>{d}</span></div><div class="bead-route"><span class="track"></span><span class="bead"></span></div></div>
<div class="pricecell"><div>{price_html}{save_html}</div>{cta_html}</div></div>
</div>
<div class="mono v2-catchline">{catch}</div>{lasted_html}
</section>
<section class="wrap v2-cols">
<div><h3 class="good">Kodėl verta</h3>{why_html}</div>
<div><h3 class="cav">Kabliukas</h3>{cav_html}</div>
</section>
{cur}
<section class="wrap v2-context"><div class="v2-kicker v2-kicker--dim">Kodėl kaina gera</div>
<div class="big">{context_big}</div>
{spark_html}
<div class="v2-kicker v2-kicker--dim" style="display:block;margin-top:22px">{ph("patikrų juosta")}</div>
<div class="v2-checkline">{checks_html}</div>
<div class="v2-kicker v2-kicker--dim" style="display:block;margin-top:16px">Pagal paskutines maršruto patikras · atnaujinta šįryt</div>
</section>
""" + (capture() if capture_row else "") + sim_sec + f"""<div class="wrap v2-linkband">Daugiau: {links}</div>
""" + inkband() + footer() + TAIL

def spark(series, today, dead=False):
    """Mirrors site/src/components/PriceSparkline.tsx: last 14 of the real series, today in amber,
    production labels; renders only when the route has >= 14 samples (priceContext MIN_SAMPLES)."""
    mx = max(series + [today]); bars = series[-14:]
    srt = sorted(series); median = srt[len(srt)//2]
    b = "".join(f'<i style="height:{round(p/mx*100)}%"></i>' for p in bars)
    b += f'<i class="today{" dead" if dead else ""}" style="height:{round(today/mx*100)}%"></i>'
    best = '<span>pigiausia, kokią matėm</span>' if today <= srt[0] else ''
    return f'<div class="v2-spark"><div class="bars">{b}</div><div class="lbls">{best}<span>šiandien <b>{today} €</b></span><span>90 d. įprasta <b>{median} €</b></span><span>brangiausia <b>{srt[-1]} €</b></span></div></div>'

def check(date, price, cls=""):
    return f'<span class="{"up" if "up" in cls else ""}">{date} · <b>{price}</b></span>'

# ---------------- DealLive: #17 Milanas (rare, archetype destination, has curator body) ----------------
deal_live = deal_page(
    crumb_dest="Milanas", poster_cls="v2-poster--stone",
    kicker="Radinys Nr. 02 · šią savaitę", stamp="Retas radinys", name="Milanas",
    blurb="Verta imti — taip pigiai būna retai.",
    o="VNO", d="MXP", legs="TIESIOGINIS",
    price_html='<div class="v2-price price">78 €<s>139 €</s></div>',
    save_html='<div class="mono save">sutaupai 61 € nuo įprastos kainos</div>',
    cta_html='<a class="cta" href="#">Žiūrėti skrydį <span class="bead"></span></a>',
    catch="<span>Tiesioginis</span><span>gruod. 14–16</span><span>Wizz Air · atnaujinta šįryt</span>",
    why=["78 € — 44 % pigiau nei įprastai (139 €)", "Tiesioginis — be persėdimų", "Reta kaina — taip pigiai matom retai"],
    cav=["Tikslios datos: gruod. 14–16", ph("pigiausia diena lange", "gruod. 14"), "Pigiausias tarifas — pasitikrink bagažo taisykles prieš pirkdamas"],
    curator="€78 vietoj įprastų €139",
    context_big="44 % pigiau nei įprastai šiame maršrute.",
    checks_html=check("rugs. 10", "78 €") + check("rugs. 11", "78 €") + check("rugs. 12", "78 €", "v2-check--today"),
    similar=[("Berlynas", "VNO → BER · gruod. 7–9 · Tiesioginis", "88 €"), ("Edinburgas", "KUN → EDI · gruod. 4–6 · Tiesioginis", "114 €")],
    links='<a href="#">Pigūs skrydžiai iš Vilniaus</a><a href="#">Kalėdinės mugės</a><a href="#">Visi radiniai</a>',
)

# ---------------- DealChanged: #12 Budapeštas, found 47 €, now 64 € (sample current price) ----------------
deal_changed = deal_page(
    crumb_dest="Budapeštas", poster_cls="v2-poster--dusk",
    kicker="Radinys Nr. 07 · šią savaitę", stamp="Retas radinys", name="Budapeštas",
    blurb="Verta imti — taip pigiai būna retai.",
    o="VNO", d="BUD", legs="TIESIOGINIS",
    price_html='<div class="v2-price price">64 €<s>133 €</s></div>',
    save_html='<div class="mono save">Dabar nuo 64 €</div><div class="mono save">radome už 47 €</div>',
    cta_html='<a class="cta" href="#">Žiūrėti skrydį <span class="bead"></span></a>',
    catch="<span>Tiesioginis</span><span>gruod. 7–9</span><span>Wizz Air · atnaujinta šįryt</span>",
    why=["64 € — 52 % pigiau nei įprastai (133 €)", "Tiesioginis — be persėdimų", "Reta kaina — taip pigiai matom retai"],
    cav=["Tikslios datos: gruod. 7–9", "Pigiausias tarifas — pasitikrink bagažo taisykles prieš pirkdamas"],
    curator="",
    context_big="52 % pigiau nei įprastai šiame maršrute.",
    checks_html=check("rugs. 10", "47 €") + check("rugs. 11", "47 €") + check("rugs. 12", "64 € ↑", "v2-check--up v2-check--today"),
    similar=[("Berlynas", "VNO → BER · gruod. 7–9 · Tiesioginis", "88 €"), ("Milanas", "VNO → MXP · gruod. 14–16 · Tiesioginis", "78 €")],
    links='<a href="#">Pigūs skrydžiai iš Vilniaus</a><a href="#">Kalėdinės mugės</a><a href="#">Visi radiniai</a>',
)

# ---------------- DealExpired: #3 Larnaka 96 € (expired 2026-09-11, lasted 14 d) ----------------
deal_expired = deal_page(
    crumb_dest="Larnaka", poster_cls="v2-poster--dead",
    kicker="Nebegalioja · bet įrodo · " + ph("trukmė","14 d."), stamp="Buvo. Nebėra.", name="Larnaka",
    blurb="Kas gavo laišką — spėjo.",
    o="VNO", d="LCA", legs="TIESIOGINIS",
    price_html='<div class="v2-price price"><s style="margin-left:0;font-size:inherit;font-family:inherit;font-weight:inherit;opacity:.75">96 €</s></div>',
    save_html='<div class="mono save">sutaupė 141 €</div>',
    cta_html='<a class="cta" href="#kapote">Noriu radinių <span class="bead"></span></a>',
    catch="<span>Tiesioginis</span><span>lapkr. 14–21</span><span>Wizz Air</span>",
    why=["96 € — 60 % pigiau nei įprastai (237 €)", "Tiesioginis — be persėdimų", "Reta kaina — taip pigiai matom retai"],
    cav=["Tikslios datos: lapkr. 14–21"],
    curator="",
    context_big="Pigiausi 85 % per 90 dienų šiame maršrute.",
    checks_html=check("rugs. 9", "96 €") + check("rugs. 10", "96 €") + check("rugs. 11", ph("nebėra"), "v2-check--up"),
    similar=[],
    links='<a href="#">Pigūs skrydžiai iš Vilniaus</a><a href="#">Pigūs skrydžiai į Kiprą</a><a href="#">Buvę radiniai</a>',
    series=[200,92,92,85,92,92,85,85,89,146,92,92,89,89,89,92,92,166,92,92], today=96, capture_row=False, dead=True,
)


# ---------------- MOBILE: a separate, reduced layout (founder 2026-09-12 + Fable keep/cut review) ----------------
MOBILE_CSS = """
.v2-masthead .navlinks{display:none}.v2-masthead .bar{justify-content:space-between}.v2-masthead .pill{min-height:44px}
.v2-poster{min-height:0;gap:18px}.v2-poster .v2-stamp{white-space:nowrap}.v2-poster .top .v2-kicker{white-space:nowrap}
.v2-poster .pricecell{flex-direction:column;align-items:stretch;gap:14px;width:100%}
.v2-poster .cta{width:100%;justify-content:center;min-height:48px}
.v2-poster .facts{font-family:var(--font-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.92);margin-top:10px}
.v2-poster .trust{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.8);text-align:center}
.m-rows{padding-top:24px}.m-rows .v2-row{grid-template-columns:1fr auto;grid-template-areas:"name price" "meta meta";gap:6px 14px;padding:16px 4px;align-items:baseline;min-height:44px}
.m-rows .v2-row .no{display:none}.m-rows .v2-row-name{grid-area:name}.m-rows .v2-row-price{grid-area:price;justify-self:end;white-space:nowrap}.m-rows .v2-row-meta{grid-area:meta;font-size:11px}
.v2-row--more .v2-row-name{font-size:clamp(22px,6vw,28px);color:var(--sand-600)}
.v2-ink-band{margin-top:28px;padding:44px 0}
.m-capture{padding-block:20px 0}.m-capture form{display:flex;flex-direction:column;gap:10px}
.m-capture input{font-size:16px;padding:14px 16px;border-radius:12px;border:1.5px solid var(--sand-300);background:#fff;color:var(--v2-ink);font-family:inherit;min-height:48px}
.m-capture .btn{font-weight:700;font-size:16px;padding:14px 22px;border-radius:12px;background:var(--v2-amber);color:var(--v2-ink);border:0;font-family:inherit;min-height:48px}
.m-capture .fine{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--sand-500);margin-top:10px}
.v2-footer{padding:0}.v2-footer .bar{min-height:52px;flex-direction:row;align-items:center;justify-content:space-between;flex-wrap:nowrap;gap:12px}
.v2-footer .links{display:none}.v2-footer .legal{font-size:12px;text-transform:none;letter-spacing:0;color:var(--sand-600)}
"""

def m_footer():
    return """<footer class="v2-footer"><div class="wrap bar"><span class="yip-logo" style="font-size:22px">yıp</span><a class="legal" href="#">Privatumas</a></div></footer>
"""

def m_poster(*, cls, kicker, stamp, name, blurb, o, d, legs, facts, price_html, save_html, cta_html, trust=""):
    stamp_html = f'<span class="v2-stamp v2-stamp--light">{stamp}</span>' if stamp else ''
    trust_html = f'<div class="trust">{trust}</div>' if trust else ''
    return f"""<section class="wrap" style="padding-top:14px"><div class="v2-poster {cls}">
<div class="top"><span class="v2-kicker">{kicker}</span>{stamp_html}</div>
<div><h1 class="v2-poster-name name">{name}</h1><p class="blurb">{blurb}</p></div>
<div class="foot"><div class="routebox"><div class="mono ends"><span>{o}</span><span>{legs}</span><span>{d}</span></div><div class="bead-route"><span class="track"></span><span class="bead"></span></div><div class="facts">{facts}</div></div>
<div class="pricecell"><div>{price_html}{save_html}</div>{cta_html}{trust_html}</div></div>
</div></section>
"""

TRUST = "Bilietą perki tiesiogiai iš aviakompanijos — mes tavo pinigų neliečiam."

def m_capture():
    return """<section class="wrap m-capture"><form><input type="email" placeholder="tavo@pastas.lt"><button type="button" class="btn">Noriu radinių</button></form>
<div class="fine">Nemokama · 3–5 radiniai per savaitę · be spamo · atsisakai kada nori</div></section>
"""

def arow(no, name, meta, price, cls=""):
    return f"""<a href="#" class="v2-row {cls}"><span class="no">{no}</span><span class="v2-row-name">{name}</span><span class="v2-row-meta">{meta}</span><span class="v2-row-price">{price}</span></a>
"""

def more_row(label, meta, locked=True):
    tail = '<span class="v2-row-price"><span class="bead"></span>kaina — laiške</span>' if locked else '<span class="v2-row-price">→</span>'
    return f"""<a href="#" class="v2-row {'v2-row--locked ' if locked else ''}v2-row--more"><span class="no"></span><span class="v2-row-name">{label}</span><span class="v2-row-meta">{meta}</span>{tail}</a>
"""

def m_page(body):
    return HEAD.replace("</style>", MOBILE_CSS + "</style>") + masthead() + body + m_footer() + TAIL

deal_live_m = m_page(m_poster(cls="v2-poster--stone", kicker="Nr. 02", stamp="Retas radinys", name="Milanas",
    blurb="Verta imti — taip pigiai būna retai.", o="VNO", d="MXP", legs="TIESIOGINIS",
    facts="gruod. 14–16 · Wizz Air · patikrino žmogus",
    price_html='<div class="v2-price price">78 €<s>139 €</s></div>', save_html='<div class="mono save">sutaupai 61 € nuo įprastos kainos</div>',
    cta_html='<a class="cta" href="#">Žiūrėti skrydį <span class="bead"></span></a>', trust=TRUST) + inkband())

deal_changed_m = m_page(m_poster(cls="v2-poster--stone", kicker="Nr. 07 · " + ph("kaina pakilo"), stamp="", name="Budapeštas",
    blurb="Verta imti — taip pigiai būna retai.", o="VNO", d="BUD", legs="TIESIOGINIS",
    facts="gruod. 7–9 · Wizz Air · patikrino žmogus",
    price_html='<div class="v2-price price">64 €</div>', save_html='<div class="mono save">Dabar nuo 64 €</div><div class="mono save">radome už 47 €</div>',
    cta_html='<a class="cta" href="#">Žiūrėti skrydį <span class="bead"></span></a>', trust=TRUST) + inkband())

deal_expired_m = m_page(m_poster(cls="v2-poster--dead", kicker="Nebegalioja", stamp="", name="Larnaka",
    blurb="Kas gavo laišką — spėjo.", o="VNO", d="LCA", legs="TIESIOGINIS",
    facts="lapkr. 14–21 · Wizz Air · " + ph("trukmė","14 d."),
    price_html='<div class="v2-price price"><s style="margin-left:0;font-size:inherit;font-family:inherit;font-weight:inherit;opacity:.75">96 €</s></div>', save_html='<div class="mono save">sutaupė 141 €</div>',
    cta_html='<a class="cta" href="#kapote">Noriu radinių <span class="bead"></span></a>')
    + '<section class="wrap m-rows" id="kapote"><div class="v2-rows">' + more_row("Dar spėji: 12 radinių", "Berlynas · Milanas · Edinburgas · Praha…", locked=False) + "</div></section>"
    + m_capture())

def home_mobile(featured=True):
    if featured:
        body = m_poster(cls="v2-poster--stone", kicker="Nr. 01 iš 12", stamp="Geras radinys", name="Berlynas",
            blurb="Gera kaina šiam maršrutui — pigiau nei įprastai.", o="VNO", d="BER", legs="TIESIOGINIS",
            facts="gruod. 7–9 · Wizz Air · patikrino žmogus",
            price_html='<div class="v2-price price">88 €<s>153 €</s></div>', save_html='<div class="mono save">sutaupai 65 € nuo įprastos kainos</div>',
            cta_html='<a class="cta" href="#">Skrendam? <span class="bead"></span></a>', trust=TRUST) + """<section class="wrap m-rows"><div class="v2-rows">
""" + arow("Nr. 02", "Milanas", "VNO → MXP · gruod. 14–16", "78 €") + arow("Nr. 03", "Edinburgas", "KUN → EDI · gruod. 4–6", "114 €") + more_row("+ dar 9 radiniai", "Praha · Mančesteris · Londonas · Budapeštas · Bergamas · Malaga…") + """</div></section>
""" + inkband()
    else:
        body = """<section class="wrap v2-hero" style="padding-block:34px 10px"><h1 class="v2-display" style="font-size:clamp(36px,10vw,44px)">Randam pigius skrydžius, kad tau nereikėtų<span class="bead"></span></h1>
<p class="lead" style="margin-top:14px;font-size:15px">Gyvų radinių šiuo metu nėra — medžiojam kitą.</p></section>
<section class="wrap m-rows"><div class="v2-rows">""" + f"""<a href="#" class="v2-row v2-row--dead"><span class="no"></span><span class="v2-row-name">Londonas</span><span class="v2-row-meta">VNO → STN · sutaupė 182 € · {ph("trukmė","14 d.")}</span><span class="v2-row-price">93 €<s>275 €</s></span></a>
""" + arow("", "Buvę radiniai", "Įrodymas, kad randam tikrus", "→", "v2-row--more") + "</div></section>" + inkband()
    return m_page(body)

mobile_files = {"MainMobile.dc.html": home_mobile(True), "HomeEmptyMobile.dc.html": home_mobile(False),
                "DealLiveMobile.dc.html": deal_live_m, "DealChangedMobile.dc.html": deal_changed_m, "DealExpiredMobile.dc.html": deal_expired_m}

files = {"Main.dc.html": main, "HomeEmpty.dc.html": home_empty, "DealLive.dc.html": deal_live,
         "DealChanged.dc.html": deal_changed, "DealExpired.dc.html": deal_expired}
files.update(mobile_files)
for n, s in files.items():
    open(os.path.join(OUT, n), "w").write(s)

canvas = {
  "artboards": [
    {"file": "Main.dc.html", "title": "Home — gyva laida (12 radinių, 2026-09-12)", "x": 0, "y": 0, "w": 1440, "h": 3000},
    {"file": "HomeEmpty.dc.html", "title": "Home — 0 gyvų radinių", "x": 1560, "y": 0, "w": 1440, "h": 1900},
    {"file": "DealLive.dc.html", "title": "Radinys — gyvas (Nr. 17 Milanas)", "x": 0, "y": 3200, "w": 1440, "h": 2500},
    {"file": "DealChanged.dc.html", "title": "Radinys — kaina pasikeitė (Nr. 12 Budapeštas)", "x": 1560, "y": 3200, "w": 1440, "h": 2500},
    {"file": "DealExpired.dc.html", "title": "Radinys — nebegalioja (Nr. 3 Larnaka)", "x": 3120, "y": 3200, "w": 1440, "h": 2200},
    {"file": "MainMobile.dc.html", "title": "Home — mobile 390", "x": 4680, "y": 0, "w": 390, "h": 1460},
    {"file": "HomeEmptyMobile.dc.html", "title": "Home tuščia — mobile 390", "x": 5150, "y": 0, "w": 390, "h": 1090},
    {"file": "DealLiveMobile.dc.html", "title": "Radinys gyvas — mobile 390", "x": 4680, "y": 3200, "w": 390, "h": 1160},
    {"file": "DealChangedMobile.dc.html", "title": "Kaina pasikeitė — mobile 390", "x": 5150, "y": 3200, "w": 390, "h": 1170},
    {"file": "DealExpiredMobile.dc.html", "title": "Nebegalioja — mobile 390", "x": 5620, "y": 3200, "w": 390, "h": 870},
  ],
  "annotations": [
    {"id": "what-is-new", "x": 0, "y": -260, "w": 620, "text": "SLICE 2 — deal surfaces. Real rows from the dev DB (2026-09-12): the 12 live deals, 3 of the 5 expired ones.\nNEW vs production: (1) a verification-time slot beside the human stamp, (2) a lasted-duration slot on expired rows and the expired page, (3) a price-check strip (last 3 checks), (4) a window-minimum slot in the catch column, (5) the changed state end to end, (6) the expired page with no booking CTA.\nCOPY IS NOT DRAFTED HERE: every new slot shows [kopija: …] with its real value; all other text is the existing lt.ts strings. Wording comes with the copy pass.\nLocked state = rows Nr. 04–12 on Home (their /deal page redirects to signup, as today)."},
    {"id": "mobile-rule", "x": 4680, "y": -220, "w": 620, "text": "MOBILE IS A SEPARATE, REDUCED LAYOUT (founder, 2026-09-12): the poster is the page. Deal page = masthead → poster (name, verdict line, route, price, ONE button) → one mono line of essentials → curator quote if there is one → the ink signup band → footer. Cut on mobile: breadcrumb, kodėl verta / kabliukas columns, price story + chart + check strip, similar rows, link band, mid-page capture. Home = poster FIRST (no hero), two open rows as links + ONE collapsed „+ dar 9\" row, ink band. Dates/airline/stamp live INSIDE the poster; the buy-direct trust line sits under the poster button; nav links hidden; footer = logo + Privatumas. Empty home shows one expired proof row; expired deal shows a „Dar spėji\" row + the form right under the poster. Primary button bottom ≈ 485px on every board (inside the Safari fold). Desktop boards keep the full page; the reviewer's ranked findings on them are still open."},
    {"id": "sample-values", "x": 1560, "y": -200, "w": 560, "text": "SAMPLE VALUES, marked honestly: verified_at is NULL on all 12 deals today (WP9 has not had a healthy run) — „06:41\" shows where the real stamp goes. No deal has ever been „changed\": Budapeštas 47 → 64 € is invented to show the state. deal_price_checks is empty: the strip shows what three healthy days will look like. Everything else (prices, baselines, dates, airlines, tiers, lasted-days) is real."},
    {"id": "chart-data", "x": 0, "y": 5760, "w": 640, "text": "PRICE CHART = real price_log, same rule as production (PriceSparkline + priceContext): renders only when the route has >= 14 scan-days in the last 90 d, last 14 bars, today in amber (the wider amber bar is the existing V2 CSS). Today: VNO-MXP has 1 scan-day, VNO-BUD 2 -> no chart, the page shows the „N % pigiau\" claim instead (that is what production does). VNO-LCA has 21 -> the expired page shows the real series: daily lows 85-92 € for three weeks, spikes 146/166/200. Note what the real numbers say: 96 € was NOT cheap against the last 3 weeks of scans (85th percentile); the 237 € baseline comes from the template, not from price_log."},
    {"id": "open-questions", "x": 3120, "y": 3000, "w": 520, "text": "DESKTOP: reviewer findings 1–10 applied 2026-09-12 (founder: agree). State announced once (poster owns it, the check line echoes it); check strip is one mono line; expired chart bar in strike coral; duration in dead rows as plain mono; no mid-page capture on expired; verification time only in the hero stamp; locked list = 4 rows + one collapsed „+ dar 5\" row (founder: four, not two)."}
  ],
  "launch": {"view": "canvas"}
}
json.dump(canvas, open(os.path.join(OUT, "canvas.json"), "w"), ensure_ascii=False, indent=1)
print("wrote", ", ".join(files), "+ canvas.json")
