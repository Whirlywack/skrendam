function App() {
  const [airport, setAirport] = React.useState("All airports");
  const [moment, setMoment] = React.useState("All");
  const [selected, setSelected] = React.useState(null);

  const momentMap = { "Sun": ["September sun", "Sun + culture"], "City break": ["City break"], "Christmas": ["Winter weekend"], "Last-minute": ["Long weekend"] };
  const deals = window.YIP_DEALS.filter((d) => {
    const okAir = airport === "All airports" || d.origin === airport;
    const okMom = moment === "All" || (momentMap[moment] || []).includes(d.moment);
    return okAir && okMom;
  });

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="site">
      <Header onLogo={scrollTop} onSubscribe={scrollTop} />
      <Hero />
      <FilterBar airport={airport} setAirport={setAirport} moment={moment} setMoment={setMoment} />
      <DealGrid deals={deals} onOpen={setSelected} />
      <SignupBand />
      <Footer />
      {selected && <DealDetail deal={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
