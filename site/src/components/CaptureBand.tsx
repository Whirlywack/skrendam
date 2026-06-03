export function CaptureBand() {
  return (
    <div className="cap">
      <div>
        <h3>Never miss a rare fare.</h3>
        <p>The best deals go in one calm weekly email. No spam, unsubscribe anytime.</p>
      </div>
      <form className="capform">
        <input type="email" placeholder="you@email.com" />
        <button type="submit" className="capbtn">Get deals</button>
      </form>
    </div>
  );
}
