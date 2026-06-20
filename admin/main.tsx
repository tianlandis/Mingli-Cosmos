import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/admin.css'

createRoot(document.getElementById('admin-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
