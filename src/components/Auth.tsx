import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Magic-link sign in. The board is per-account, so signing in on the phone with
 * the same address shows the same cards as the desktop.
 */
export function Auth() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })

    setBusy(false)
    if (signInError) setError(signInError.message)
    else setSent(true)
  }

  return (
    <div className="centered">
      <div className="panel">
        <h1 className="panel-title">Kanban</h1>
        {sent ? (
          <>
            <p className="muted">
              Check <strong>{email}</strong> for a sign-in link. Open it on this device to
              land back here.
            </p>
            <button className="btn" type="button" onClick={() => setSent(false)}>
              Use a different address
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="muted">
              Sign in with your email and your board follows you between devices.
            </p>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
