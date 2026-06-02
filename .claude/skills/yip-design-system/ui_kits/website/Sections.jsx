// Reusable email signup form. Shows an inline confirmation on submit.
function SignupForm({ cta = "Get deals", placeholder = "you@email.com" }) {
  const [email, setEmail] = React.useState("");
  const [done, setDone] = React.useState(false);
  if (done) {
    return (
      <div className="confirm">
        <Icon name="check-circle" size={20} color="var(--sea-600)" />
        You're in — first deals land in your inbox this week.
      </div>
    );
  }
  return (
    <form
      className="signup"
      onSubmit={(e) => { e.preventDefault(); if (email.includes("@")) setDone(true); }}
    >
      <input type="email" value={email} placeholder={placeholder} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" className="btn btn-primary">{cta}</button>
    </form>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="wrap">
        <div className="eyebrow">Curated flight deals · Lithuania &amp; the Baltics</div>
        <h1>We find the <span className="amber">cheap flights</span>, so you don't have to.</h1>
        <p className="lead">
          A few genuinely good deals a week from Vilnius, Kaunas &amp; Riga — checked by a
          real person, with the catch shown up front.
        </p>
        <SignupForm cta="Get deals by email" />
        <div className="trust">
          <span><Icon name="users" size={15} color="var(--sea-500)" /> 12,400+ Baltic travelers</span>
          <span><Icon name="hand" size={15} color="var(--sea-500)" /> Human-checked deals</span>
          <span><Icon name="ban" size={15} color="var(--sea-500)" /> No spam, ever</span>
        </div>
      </div>
    </section>
  );
}

function FilterBar({ airport, setAirport, moment, setMoment }) {
  return (
    <div className="wrap">
      <div className="filters">
        <div className="fgroup">
          <span className="lab">From</span>
          {window.YIP_AIRPORTS.map((a) => (
            <button key={a} className={"fchip" + (airport === a ? " on" : "")} onClick={() => setAirport(a)}>{a}</button>
          ))}
        </div>
        <div className="fgroup">
          <span className="lab">Mood</span>
          {window.YIP_MOMENTS.map((m) => (
            <button key={m} className={"fchip" + (moment === m ? " on" : "")} onClick={() => setMoment(m)}>{m}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignupBand() {
  return (
    <div className="wrap">
      <section className="band">
        <span className="bead" />
        <div className="bcol" style={{ flex: 1 }}>
          <h2>Get the next great deal before it sells out.</h2>
          <p>We send a short email when we find something worth your weekend. That's it.</p>
        </div>
        <div className="bcol">
          <SignupForm cta="Subscribe" />
        </div>
      </section>
    </div>
  );
}

function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap ftr-in">
        <div className="col lead-col">
          <Wordmark size={30} light />
          <p>Curated flight deals from Lithuania and nearby Baltic airports. We find the gems so you don't have to.</p>
        </div>
        <div className="col">
          <h4>Deals</h4>
          <a href="#">From Vilnius</a>
          <a href="#">From Kaunas</a>
          <a href="#">From Riga</a>
          <a href="#">Christmas markets</a>
        </div>
        <div className="col">
          <h4>Yip</h4>
          <a href="#">How it works</a>
          <a href="#">About us</a>
          <a href="#">Newsletter</a>
          <a href="#">Contact</a>
        </div>
        <div className="col">
          <h4>Follow</h4>
          <a href="#">TikTok</a>
          <a href="#">Instagram</a>
          <a href="#">Telegram</a>
        </div>
      </div>
      <div className="wrap legal">
        <span>© 2026 Yip. We link to airlines &amp; OTAs to book — prices change fast.</span>
        <span>Made in Vilnius 🇱🇹</span>
      </div>
    </footer>
  );
}

Object.assign(window, { SignupForm, Hero, FilterBar, SignupBand, Footer });
