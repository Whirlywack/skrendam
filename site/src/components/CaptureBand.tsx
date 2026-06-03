export function CaptureBand() {
  return (
    <div className="cap">
      <div>
        <h3>Never miss a rare fare.</h3>
        <p>The best deals go in one calm weekly email. No spam, unsubscribe anytime.</p>
      </div>
      {/* Task 9 wires this to the subscribe server action */}
      <div className="capform">
        <input type="email" placeholder="you@email.com" aria-label="Email address" />
        <button type="button" className="capbtn">Get deals</button>
      </div>
    </div>
  );
}
