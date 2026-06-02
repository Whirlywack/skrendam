function Header({ onLogo, onSubscribe }) {
  return (
    <header className="hdr">
      <div className="wrap hdr-in">
        <a href="#" onClick={(e) => { e.preventDefault(); onLogo(); }} style={{ display: "inline-flex" }}>
          <Wordmark size={30} />
        </a>
        <nav>
          <a href="#" className="active">Deals</a>
          <a href="#">How it works</a>
          <a href="#">About</a>
        </nav>
        <span className="spacer" />
        <span className="from-pill"><Icon name="map-pin" size={14} /> Vilnius · Kaunas · Riga</span>
        <button className="btn btn-primary btn-sm" onClick={onSubscribe}>Get deals by email</button>
      </div>
    </header>
  );
}
Object.assign(window, { Header });
