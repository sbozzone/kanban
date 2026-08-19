import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Setup } from './components/Setup'
import { missingConfig } from './lib/supabase'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(<StrictMode>{missingConfig ? <Setup /> : <App />}</StrictMode>)
