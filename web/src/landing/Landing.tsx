import { Wordmark } from "../shared/components/Wordmark";

/** PLACEHOLDER until phase P15a (listed under "Known gaps" in docs/PROGRESS.md): the public landing page of
 *  ui-redesign.md §11 is not built yet. This page only names the product and links to the workspace, so `/` is never
 *  a dead end. It makes no product claim beyond the project's own tagline. */
export function Landing() {
  return (
    <main className="pw-landing" style={{ maxWidth: 720, margin: "0 auto", padding: "64px 16px" }}>
      <Wordmark size={24} />
      <h1 className="pw-h1" style={{ margin: "32px 0 16px" }}>
        Every agent passes its safety check. The system still leaks.
      </h1>
      <p>Pathwarden sees the path.</p>
      <p>
        <a href="app/">Open the workspace</a>
      </p>
      <p className="pw-muted">The full project page is not built yet.</p>
    </main>
  );
}
