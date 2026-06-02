function Sidebar() {
  const [active, setActive] = React.useState("Queue");
  const items = [
    ["Queue", "inbox", 3],
    ["Published", "send", null],
    ["Templates", "layout-template", null],
    ["Audience", "users", null],
    ["Insights", "bar-chart-3", null],
    ["Settings", "settings", null],
  ];
  return (
    <aside className="side">
      <div className="brand">
        <Wordmark size={26} />
        <span className="tag">Curator</span>
      </div>
      <nav>
        {items.map(([label, icon, badge]) => (
          <button key={label} className={"navi" + (active === label ? " on" : "")} onClick={() => setActive(label)}>
            <Icon name={icon} size={18} />
            {label}
            {badge && <span className="badge">{badge}</span>}
          </button>
        ))}
      </nav>
      <div className="who">
        <span className="av">RŠ</span>
        <div>
          <div className="nm">Rasa Šimkutė</div>
          <div className="ro">Curator · Vilnius</div>
        </div>
      </div>
    </aside>
  );
}
Object.assign(window, { Sidebar });
