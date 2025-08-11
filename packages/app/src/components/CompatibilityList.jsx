import React, { useEffect, useState } from 'react'

const DEFAULT_TIMEOUT_MS = 10000
const getBaseUrl = () => import.meta.env.VITE_API_URL || 'https://stackfast-api.vercel.app'

export default function CompatibilityList({ toolId }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()
    async function run() {
      try {
        setLoading(true)
        setError('')
        const url = `${getBaseUrl()}/v1/compatibility?tool_id=${encodeURIComponent(toolId)}`
        const res = await fetch(url, { signal: controller.signal })
        const text = await res.text()
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
        const json = JSON.parse(text)
        if (mounted) setItems(json.matches || [])
      } catch (e) {
        if (mounted) setError(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false; controller.abort() }
  }, [toolId])

  if (loading) return <div className="text-gray-400 text-sm">Loading…</div>
  if (error) return <div className="text-red-300 text-sm">{error}</div>
  if (!items.length) return <div className="text-gray-400 text-sm">No data yet</div>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((m) => (
        <span key={m.tool_id} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-blue-300">
          {m.name} · {m.score}
        </span>
      ))}
    </div>
  )
}


