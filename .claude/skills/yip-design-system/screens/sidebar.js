// Shared Deal Desk sidebar. Set <body data-nav="queue"> to mark the active item.
// Injects into the element with id="asb".
(function () {
  const items = [
    ["g", "Workspace"],
    ["today", "Today", "layout-dashboard", "admin-today.html"],
    ["queue", "Deal queue", "inbox", "admin-queue.html", "7"],
    ["published", "Published", "send", "admin-published.html"],
    ["g", "Strategy"],
    ["templates", "Templates", "layout-template", "admin-templates.html"],
    ["builder", "Template builder", "wand-2", "admin-template-builder.html"],
    ["audience", "Audience", "users", "admin-audience.html"],
    ["moments", "Travel moments", "calendar-days", "admin-moments.html"],
    ["routes", "Routes & zones", "map", "admin-routes.html"],
    ["g", "System"],
    ["scan", "Scan health", "activity", "admin-scan-health.html"],
  ];
  const active = document.body.dataset.nav || "";
  let html = '<div class="brand"><span class="yip-logo" style="font-size:24px">yıp</span><span class="tag">Deal Desk</span></div>';
  for (const it of items) {
    if (it[0] === "g") { html += `<div class="grp">${it[1]}</div>`; continue; }
    const [key, label, icon, href, badge] = it;
    html += `<a class="navi${key === active ? " on" : ""}" href="${href}"><i data-lucide="${icon}"></i> ${label}${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
  }
  html += '<div class="who"><span class="av">TK</span><div><div class="nm">Tomas K.</div><div class="ro">Founder · Vilnius</div></div></div>';
  const el = document.getElementById("asb");
  if (el) el.innerHTML = html;
})();
