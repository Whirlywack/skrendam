function CuratorApp() {
  const [tab, setTab] = React.useState("All");
  const [selected, setSelected] = React.useState(null);
  const [items, setItems] = React.useState(window.YIP_CANDIDATES);
  const [toast, setToast] = React.useState(null);

  const tabMap = { "Suggested": "suggested", "In review": "review", "Rejected": "rejected" };
  const filtered = tab === "All" ? items : items.filter((c) => c.status === tabMap[tab]);

  const publish = (c) => {
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "published" } : x)));
    setSelected(null);
    setToast(`“${c.place}, ${c.country}” is live — published to the site & newsletter.`);
    setTimeout(() => setToast(null), 3200);
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar tab={tab} setTab={setTab} />
        <Queue candidates={filtered} onOpen={setSelected} />
      </div>
      {selected && <Composer c={selected} onClose={() => setSelected(null)} onPublish={publish} />}
      {toast && (
        <div className="toast"><span className="ic"><Icon name="check-circle" size={18} /></span>{toast}</div>
      )}
    </div>
  );
}
const __curRoot = document.getElementById("root");
if (__curRoot && __curRoot.dataset.app === "curator") {
  ReactDOM.createRoot(__curRoot).render(<CuratorApp />);
}
