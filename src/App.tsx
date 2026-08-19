import { useCallback, useState } from 'react'
import { clearPassphrase, readPassphrase } from './lib/api'
import { Passphrase } from './components/Passphrase'
import { Board } from './components/Board'

export default function App() {
  const [unlocked, setUnlocked] = useState(() => readPassphrase() !== null)

  // Reached when the server rejects a stored passphrase — drop it and ask again.
  const lock = useCallback(() => {
    clearPassphrase()
    setUnlocked(false)
  }, [])

  if (!unlocked) return <Passphrase onUnlocked={() => setUnlocked(true)} />
  return <Board onLock={lock} />
}
