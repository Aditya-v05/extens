import icon48 from '../public/icon/48.png';
import { Demo } from './Demo';

const REPO = 'https://github.com/Aditya-v05/extens';
const INSTALL = `${REPO}#install`;
const PRIVACY = `${REPO}/blob/main/PRIVACY.md`;

export default function Landing() {
  return (
    <div className="l-page">
      <header className="l-header">
        <a className="l-brand" href="#top">
          <img src={icon48} alt="" width="28" height="28" />
          Sift
        </a>
        <nav className="l-nav">
          <a href="#how">How it works</a>
          <a href="#costs">Costs</a>
          <a href="#privacy">Privacy</a>
          <a href={REPO}>GitHub</a>
        </nav>
      </header>

      <main id="top">
        <section className="l-hero">
          <h1>Click once on a company's site. Know if it fits, why now, and who to email.</h1>
          <p className="l-lede">
            Sift is an open-source Chrome extension for outbound. It checks the company against your ideal customer, finds
            reasons to reach out now, and ranks the people who own the problem you solve. It runs on your own Apollo and Jev keys.
          </p>
          <div className="l-ctas">
            <a className="l-primary" href={INSTALL}>Install from GitHub</a>
            <a href={REPO}>Read the source</a>
          </div>
          <p className="l-note">Chrome Web Store: coming soon. Free and MIT licensed.</p>
        </section>

        <Demo />

        <section id="how" className="l-section">
          <h2>What the side panel answers</h2>
          <div className="l-cols">
            <article>
              <h3>Does it fit?</h3>
              <p>
                Your own requirements, checked one by one: company size and location exactly, everything else by Jev. Near misses
                and unsure answers are shown as such, so the score adds up.
              </p>
            </article>
            <article>
              <h3>Why now?</h3>
              <p>
                Hiring for the roles your product serves, headcount growth, recent funding, and what their own site says: an
                enterprise plan, SOC 2, a new product. Every signal links to where it came from.
              </p>
            </article>
            <article>
              <h3>Who to email?</h3>
              <p>
                Senior people first, ranked by how likely they are to own the problem you solve. When two are equally good you see
                both. Reveal one email, or all of them at once.
              </p>
            </article>
          </div>
          <div className="l-also">
            <h3>And after the click</h3>
            <p>
              My Accounts keeps the companies you save, ranked by fit and timing, with a status, notes and CSV export. Discover finds
              companies like your best accounts, already filtered by your ideal customer.
            </p>
          </div>
        </section>

        <section id="costs" className="l-section">
          <h2>It costs what it says</h2>
          <p className="l-lede small">
            Sift uses your Apollo credits and shows the price on every button. Set a monthly budget and it asks before going over. With
            an Apollo master key it shows your real balance.
          </p>
          <table className="l-costs">
            <tbody>
              <tr><th>Look up a new company</th><td>2 credits</td><td>1 for the company, 1 for its job postings. Turn hiring signals off to make it 1.</td></tr>
              <tr><th>Look at it again within 7 days</th><td>Free</td><td>Results are kept in your browser.</td></tr>
              <tr><th>Find the people</th><td>Free</td><td>Apollo's people search costs nothing.</td></tr>
              <tr><th>Reveal an email</th><td>1 credit</td><td>Only charged when Apollo finds the person.</td></tr>
              <tr><th>Sift a LinkedIn profile</th><td>1 credit</td><td>Identifies the person, email included. Plus the company lookup if it's new. Free again for 30 days.</td></tr>
              <tr><th>Discover lookalikes</th><td>1 credit</td><td>For 50 suggestions.</td></tr>
              <tr><th>Jev judgments</th><td>Well under a cent</td><td>Per lookup, on your TypeSafe key.</td></tr>
            </tbody>
          </table>
        </section>

        <section id="privacy" className="l-section">
          <h2>Your keys, your browser</h2>
          <ul className="l-list">
            <li>No Sift server, no account, no analytics. Nothing about you reaches us.</li>
            <li>Your keys, profile and saved accounts stay in Chrome's local storage.</li>
            <li>Sift reads a website only when you click its icon on that site.</li>
            <li>It talks to Apollo and TypeSafe only, with the keys you give it.</li>
          </ul>
          <p><a href={PRIVACY}>Read the privacy policy</a></p>
        </section>

        <section className="l-section">
          <h2>Questions</h2>
          <div className="l-faq">
            <details>
              <summary>What do I need?</summary>
              <p>Chrome, an Apollo account with an API key, and a TypeSafe API key for Jev.</p>
            </details>
            <details>
              <summary>What is Jev?</summary>
              <p>
                TypeSafe's decision model. It answers typed questions (yes or no, pick one, a score) with probabilities instead of
                writing text. That is why Sift's reasons are checks and quotes, never made-up prose.
              </p>
            </details>
            <details>
              <summary>How is the fit score worked out?</summary>
              <p>75% your requirements, each one counted (a near miss counts half), and 25% Jev's overall judgment of the company.</p>
            </details>
            <details>
              <summary>Does it work on LinkedIn?</summary>
              <p>
                Yes, on people's profiles. Sift sends only the profile's address to Apollo to find out who they are (1 credit, their
                email included), then shows their company's fit and where they rank among the people there. It never reads
                LinkedIn's pages.
              </p>
            </details>
            <details>
              <summary>Can it find phone numbers?</summary>
              <p>Not yet. Apollo delivers phone numbers to a server, and Sift deliberately has none.</p>
            </details>
          </div>
        </section>

        <section className="l-section l-end">
          <h2>Try it on the next company you look at</h2>
          <div className="l-ctas">
            <a className="l-primary" href={INSTALL}>Install from GitHub</a>
            <a href={REPO}>Read the source</a>
          </div>
        </section>
      </main>

      <footer className="l-footer">
        <span>Sift, MIT licensed</span>
        <span className="l-footer-links">
          <a href={REPO}>GitHub</a>
          <a href={PRIVACY}>Privacy</a>
        </span>
      </footer>
    </div>
  );
}
