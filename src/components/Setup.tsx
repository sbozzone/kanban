/** Shown when the build has no Supabase credentials — a misconfiguration, not a crash. */
export function Setup() {
  return (
    <div className="centered">
      <div className="panel">
        <h1 className="panel-title">Almost there</h1>
        <p className="muted">
          This build has no Supabase credentials, so there is nowhere to store cards.
        </p>
        <p className="muted">
          Locally, copy <code>.env.example</code> to <code>.env.local</code> and fill in
          your project URL and anon key. On Vercel, set{' '}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the
          project&rsquo;s environment variables, then redeploy.
        </p>
        <p className="muted">See the README for the full walkthrough.</p>
      </div>
    </div>
  )
}
