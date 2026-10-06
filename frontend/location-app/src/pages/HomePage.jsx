import { Link } from "react-router-dom";

const services = [
  { icon: "🔧", title: "Plumbing", text: "Leaks, taps, pipes and fittings" },
  { icon: "⚡", title: "Electrical", text: "Wiring, switches and repairs" },
  { icon: "🧹", title: "Home Cleaning", text: "Reliable cleaning professionals" },
  { icon: "🪚", title: "Carpentry", text: "Furniture and home repairs" },
];

export default function HomePage() {
  return (
    <main className="app-shell home-page">
      <header className="topbar home-topbar">
        <Link className="brand" to="/">
          <span className="brand-icon">P</span>
          ProxiFix
        </Link>

        <nav className="nav-actions home-nav" aria-label="Main navigation">
          <a className="nav-link" href="#services">Services</a>
          <a className="nav-link" href="#how-it-works">How it works</a>
          <Link className="nav-link" to="/customer">Find Workers</Link>
          <Link className="nav-link" to="/login">Login</Link>
          <Link className="btn btn-primary" to="/register">Get Started</Link>
        </nav>
      </header>

      <section className="home-hero">
        <div className="hero-tool hero-tool-left" aria-hidden="true">🔧</div>
        <div className="hero-tool hero-tool-right" aria-hidden="true">⚡</div>
        <div className="hero-tool hero-tool-bottom" aria-hidden="true">🪚</div>
        <div className="hero-bubble hero-bubble-one" aria-hidden="true" />
        <div className="hero-bubble hero-bubble-two" aria-hidden="true" />
        <div className="home-container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Reliable home services</p>
            <h1>Find trusted help for every home repair.</h1>
            <p>
              ProxiFix connects you with verified local professionals for
              plumbing, electrical repairs, cleaning, carpentry, and more.
            </p>

            <div className="hero-actions">
              <Link className="btn btn-primary" to="/customer">Find a Worker</Link>
              <Link className="btn btn-outline" to="/register?role=WORKER">
                Join as a Worker
              </Link>
            </div>
          </div>

          <aside className="hero-card" aria-label="Popular services">
            <h2>Popular services</h2>
            {services.map((service) => (
              <div className="quick-service" key={service.title}>
                <span className="service-icon">{service.icon}</span>
                <div>
                  <strong>{service.title}</strong>
                  <small>{service.text}</small>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </section>

      <section className="home-section" id="services">
        <div className="home-container">
          <div className="section-heading">
            <p className="eyebrow">Our services</p>
            <h2>Everything your home needs, in one place.</h2>
            <p>Browse verified professionals, compare their details, and request the service you need.</p>
          </div>
          <div className="home-card-grid">
            {services.slice(0, 3).map((service) => (
              <article className="card service-card" key={service.title}>
                <span className="service-icon">{service.icon}</span>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
                <Link className="text-link" to="/customer">Find workers</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section process-section" id="how-it-works">
        <div className="home-container">
          <div className="section-heading">
            <p className="eyebrow">Simple process</p>
            <h2>Book a home service in three steps.</h2>
          </div>
          <div className="home-card-grid process-grid">
            <article className="card process-card"><span className="feature-number">1</span><h3>Choose a service</h3><p>Select a category and search for verified workers near your current location.</p></article>
            <article className="card process-card"><span className="feature-number">2</span><h3>Send a booking request</h3><p>Describe your issue and send a request to the worker you choose.</p></article>
            <article className="card process-card"><span className="feature-number">3</span><h3>Get the work done</h3><p>Track your booking, confirm completion, and rate the worker once.</p></article>
          </div>
        </div>
      </section>

      <section className="home-section worker-callout">
        <div className="home-container hero-card worker-callout-card">
          <p className="eyebrow">For service professionals</p>
          <h2>Grow your work with ProxiFix.</h2>
          <p>Create a worker profile, wait for admin approval, go online, and receive nearby service requests.</p>
          <Link className="btn btn-primary" to="/register?role=WORKER">Register as a Worker</Link>
        </div>
      </section>

      <footer className="site-footer">
        <p>© 2026 ProxiFix. Trusted home services made simple.</p>
        <p className="footer-credit">Crafted by Ravi Ranjan Kumar</p>
      </footer>
    </main>
  );
}
