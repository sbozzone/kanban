import { useState, type FormEvent } from 'react'
import { Unauthorized, unlock } from '../lib/api'

/**
 * One shared passphrase stands in for accounts: this board has a single user,
 * so there is nothing to tell apart, only strangers to keep out.
 */
export function Passphrase({ onUnlocked }: { onUnlocked: () => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      await unlock(value)
      onUnlocked()
    } catch (cause) {
      setError(
        cause instanceof Unauthorized
          ? 'That passphrase was not accepted.'
          : cause instanceof Error
            ? cause.message
            : String(cause),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="centered">
      <div className="panel">
        <h1 className="panel-title">Cairn</h1>
        <p className="tagline">To do &middot; In progress &middot; Done</p>
        <form onSubmit={submit}>
          <p className="muted">
            Enter your passphrase. This device stays unlocked until you lock it again.
          </p>
          <label className="field">
            <span>Passphrase</span>
            <input
              type="password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
