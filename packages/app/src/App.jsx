import React, { useState, useEffect } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { apiFetch } from './lib/apiClient'
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, collection, query, onSnapshot, addDoc } from 'firebase/firestore'
import CompatibilityList from './components/CompatibilityList.jsx'

// Firebase bootstrap (optional; enabled when globals are provided at runtime)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'stackfast-app'
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {}
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null

let firebaseApp = null
let db = null
let auth = null
if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
  try {
    firebaseApp = initializeApp(firebaseConfig)
    db = getFirestore(firebaseApp)
    auth = getAuth(firebaseApp)
  } catch (err) {
    console.warn('Firebase init failed:', err)
  }
}

function App() {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalTools, setTotalTools] = useState(0)
  const [limit, setLimit] = useState(12)
  const [offset, setOffset] = useState(0)
  const [searchQ, setSearchQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [reviewFilter, setReviewFilter] = useState('') // '', 'true', 'false'
  const [selectedTool, setSelectedTool] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [idea, setIdea] = useState('')
  const [blueprintLoading, setBlueprintLoading] = useState(false)
  const [blueprintError, setBlueprintError] = useState(null)
  const [blueprint, setBlueprint] = useState(null)
  // Enhanced generation + plans
  const [generationMode, setGenerationMode] = useState('auto') // 'auto' | 'manual'
  const [mode, setMode] = useState('single') // 'single' | 'workflow'
  const [singleTool, setSingleTool] = useState('replit')
  const [selectedWorkflow, setSelectedWorkflow] = useState('bolt-replit')
  const [generatedPlan, setGeneratedPlan] = useState(null)
  const [userId, setUserId] = useState(null)
  const [savedPlans, setSavedPlans] = useState([])

  // Admin state
  const [adminToken, setAdminToken] = useState(() => {
    try { return localStorage.getItem('ADMIN_JWT') || '' } catch { return '' }
  })
  const [adminTools, setAdminTools] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState('')
  const showAdmin = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1'

  useEffect(() => {
    fetchTools({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, categoryFilter])

  // Auto-load last plan if authenticated
  useEffect(() => {
    if (!savedPlans || savedPlans.length === 0) return
    // Load most recent by timestamp if present
    const recent = [...savedPlans].sort((a, b) => {
      const ta = Date.parse(a.timestamp || '')
      const tb = Date.parse(b.timestamp || '')
      return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta)
    })[0]
    if (recent) {
      setBlueprint(recent)
      setGeneratedPlan(recent)
      setIdea(recent.rawIdea || '')
      setGenerationMode(recent.generationMode || 'auto')
      setMode(recent.mode || 'single')
      setSingleTool(recent.singleTool || 'replit')
      setSelectedWorkflow(recent.selectedWorkflow || 'bolt-replit')
    }
  }, [savedPlans])

  // Firebase auth + saved plans listener
  useEffect(() => {
    if (!auth) return
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid)
      } else {
        try {
          if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken)
          else await signInAnonymously(auth)
        } catch (e) {
          console.error('Auth failed:', e)
        }
      }
    })
    return () => unsubAuth()
  }, [])

  useEffect(() => {
    if (!db || !userId) return
    const plansRef = collection(db, `artifacts/${appId}/users/${userId}/plans`)
    const q = query(plansRef)
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const plans = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setSavedPlans(plans)
      },
      (err) => console.error('Saved plans listener failed:', err),
    )
    return () => unsub()
  }, [db, userId])

  const fetchTools = async ({ reset = false } = {}) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('offset', String(reset ? 0 : offset))
      if (searchQ) params.set('q', searchQ)
      if (categoryFilter) params.set('category', categoryFilter)
      if (reviewFilter) params.set('requires_review', reviewFilter)
      const data = await apiFetch(`/v1/tools?${params.toString()}`)
      const page = data.data || []
      setTotalTools(data.total ?? page.length)
      if (reset) {
        setOffset(page.length)
        setTools(page)
      } else {
        setOffset((prev) => prev + page.length)
        setTools((prev) => [...prev, ...page])
      }
    } catch (err) {
      console.error('Error fetching tools:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Admin helpers
  const fetchPendingTools = async () => {
    try {
      setAdminLoading(true)
      setAdminError('')
      const data = await apiFetch(`/v1/tools?requires_review=true&limit=100`)
      setAdminTools(data.data || [])
    } catch (e) {
      setAdminError(e.message)
    } finally {
      setAdminLoading(false)
    }
  }

  const approveTool = async (toolId) => {
    if (!adminToken) { alert('Set admin token first'); return }
    try {
      await apiFetch(`/v1/tools/${toolId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      setAdminTools((prev) => prev.filter((t) => t.tool_id !== toolId))
    } catch (e) {
      alert(`Approve failed: ${e.message}`)
    }
  }

  const rejectTool = async (toolId) => {
    if (!adminToken) { alert('Set admin token first'); return }
    const reason = window.prompt('Rejection reason (optional):') || ''
    try {
      await apiFetch(`/v1/tools/${toolId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ reason })
      })
      setAdminTools((prev) => prev.filter((t) => t.tool_id !== toolId))
    } catch (e) {
      alert(`Reject failed: ${e.message}`)
    }
  }

  const handleToolClick = (tool) => {
    setSelectedTool(tool)
    try { window.location.hash = `tool-${encodeURIComponent(tool.tool_id)}` } catch {}
  }

  const closeModal = () => {
    setSelectedTool(null)
    try { if (window.location.hash.startsWith('#tool-')) window.history.replaceState(null, '', window.location.pathname + window.location.search) } catch {}
  }

  // Deep link: open tool modal when URL hash is #tool-<tool_id> or path /tool/:toolId
  useEffect(() => {
    const applyHash = () => {
      try {
        let id = ''
        const h = window.location.hash || ''
        if (h.startsWith('#tool-')) {
          id = decodeURIComponent(h.slice('#tool-'.length))
        } else {
          const m = window.location.pathname.match(/^\/tool\/([^/]+)/)
          if (m) id = decodeURIComponent(m[1])
        }
        if (!id) return
        const t = tools.find((tt) => tt.tool_id === id)
        if (t) setSelectedTool(t)
      } catch {}
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [tools])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white">Loading Stackfast...</h2>
          <p className="text-gray-300 mt-2">Discovering AI development tools</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Tools</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button 
            onClick={fetchTools}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-white">
               Stackfast
              </h1>
              <span className="ml-2 px-2 py-1 bg-blue-600 text-xs text-white rounded-full">
                AI Tools Platform
              </span>
            </div>
            <div className="text-right">
              <p className="text-gray-300 text-sm">Powered by RAG</p>
              <p className="text-gray-400 text-xs">Retrieval-Augmented Generation</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Discover AI Development Tools
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Explore the latest AI-powered development tools, automatically analyzed and curated 
            using advanced RAG technology.
          </p>
          <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-3 md:space-x-4">
            <div className="bg-green-600/20 border border-green-500/30 rounded-lg px-4 py-2">
              <span className="text-green-400 text-sm font-medium">
                {totalTools || tools.length} Tools Available
              </span>
            </div>
            <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg px-4 py-2">
              <span className="text-blue-400 text-sm font-medium">
                Auto-Updated
              </span>
            </div>
            <div className="flex w-full md:w-auto gap-2">
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search tools..."
                className="flex-1 md:w-64 px-3 py-2 rounded-lg bg-black/30 border border-white/20 text-white placeholder-gray-400"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-black/30 border border-white/20 text-white"
              >
                <option value="">All categories</option>
                {[...new Set(tools.flatMap((t) => t.category || []))].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-black/30 border border-white/20 text-white"
              >
                <option value="">All</option>
                <option value="true">Needs review</option>
                <option value="false">Approved</option>
              </select>
              <button
                onClick={() => fetchTools({ reset: true })}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Admin Panel (hidden unless ?admin=1 is present) */}
        {showAdmin && (
        <div className="max-w-7xl mx-auto mb-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <h3 className="text-2xl font-semibold text-white mb-3">Admin Review</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input
              type="password"
              value={adminToken}
              onChange={(e) => { setAdminToken(e.target.value); try { localStorage.setItem('ADMIN_JWT', e.target.value) } catch {} }}
              placeholder="Admin Bearer Token"
              className="px-3 py-2 rounded-lg bg-black/30 border border-white/20 text-white placeholder-gray-400"
            />
            <button
              onClick={fetchPendingTools}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
            >
              Refresh Pending
            </button>
            <div className="text-sm text-gray-300 self-center">{adminLoading ? 'Loading…' : adminError || `${adminTools.length} pending`}</div>
          </div>
          {adminTools.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminTools.map((t) => (
                <div key={t.tool_id} className="bg-black/30 border border-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-semibold">{t.name}</div>
                      <div className="text-gray-400 text-xs">{t.tool_id}</div>
                    </div>
                    <span className="px-2 py-1 bg-yellow-600/20 border border-yellow-500/30 rounded text-xs text-yellow-400">Needs review</span>
                  </div>
                  <p className="text-gray-300 text-sm mt-2 line-clamp-3">{t.description}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => approveTool(t.tool_id)} className="px-3 py-1 rounded bg-green-600 text-white text-xs">Approve</button>
                    <button onClick={() => rejectTool(t.tool_id)} className="px-3 py-1 rounded bg-rose-600 text-white text-xs">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No pending tools.</p>
          )}
        </div>
        )}

        {/* Blueprint Generator */}
        <div className="max-w-3xl mx-auto mb-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <h3 className="text-2xl font-semibold text-white mb-3">Generate a Project Blueprint</h3>
          <p className="text-gray-300 mb-4">Describe your idea and we’ll propose a workflow, stack, and next steps.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. A SaaS to summarize Zoom recordings into action items"
              className="flex-1 px-4 py-3 rounded-lg bg-black/30 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={async () => {
                if (!idea.trim()) return;
                setBlueprint(null)
                setBlueprintError(null)
                setBlueprintLoading(true)
                try {
                  const resp = await apiFetch('/v1/blueprint', {
                    method: 'POST',
                    body: JSON.stringify({ rawIdea: idea, stackRegistry: { tools } })
                  }, 30000)
                  const bp = resp.data || resp
                  setBlueprint(bp)
                  // Capture a generated plan envelope for save/load flows
                  const planEnvelope = {
                    ...bp,
                    rawIdea: idea,
                    generationMode,
                    mode,
                    singleTool,
                    selectedWorkflow,
                    timestamp: new Date().toISOString(),
                  }
                  setGeneratedPlan(planEnvelope)
                } catch (e) {
                  setBlueprintError(e.message)
                } finally {
                  setBlueprintLoading(false)
                }
              }}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
              disabled={blueprintLoading}
            >
              {blueprintLoading ? 'Generating…' : 'Generate'}
            </button>
          </div>
          {/* Auto / Manual configuration */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Generation Mode</label>
              <div className="flex rounded-lg overflow-hidden border border-white/20">
                <button
                  onClick={() => setGenerationMode('auto')}
                  className={`flex-1 px-3 py-2 text-sm ${generationMode === 'auto' ? 'bg-blue-600 text-white' : 'bg-black/30 text-gray-300'}`}
                >
                  Auto
                </button>
                <button
                  onClick={() => setGenerationMode('manual')}
                  className={`flex-1 px-3 py-2 text-sm ${generationMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-black/30 text-gray-300'}`}
                >
                  Manual
                </button>
              </div>
            </div>
            {generationMode === 'manual' && (
              <div>
                <label className="block text-sm text-gray-300 mb-2">Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/20 text-white"
                >
                  <option value="single">Single Tool</option>
                  <option value="workflow">Workflow</option>
                </select>
              </div>
            )}
          </div>
          {generationMode === 'manual' && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mode === 'single' ? (
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Tool</label>
                  <select
                    value={singleTool}
                    onChange={(e) => setSingleTool(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/20 text-white"
                  >
                    <option value="replit">Replit</option>
                    <option value="cursor">Cursor</option>
                    <option value="bolt">Bolt.new</option>
                    <option value="bubble">Bubble.io</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Workflow</label>
                  <select
                    value={selectedWorkflow}
                    onChange={(e) => setSelectedWorkflow(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/20 text-white"
                  >
                    <option value="bolt-replit">Rapid MVP (Bolt → Replit)</option>
                    <option value="bubble-cursor">Design‑First (Bubble → Cursor)</option>
                  </select>
                </div>
              )}
            </div>
          )}
          {blueprintError && (
            <div className="mt-3 text-sm text-red-300">{blueprintError}</div>
          )}
          {blueprint && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">Overview</h4>
                <div className="text-gray-300 text-sm space-y-1">
                  <p><span className="text-gray-400">Title:</span> {blueprint.title}</p>
                  {blueprint.techStack && <p><span className="text-gray-400">Tech Stack:</span> {blueprint.techStack}</p>}
                  {blueprint.recommendedWorkflow && (
                    <div>
                      <p className="text-gray-400">Workflow:</p>
                      <p className="text-gray-300">{blueprint.recommendedWorkflow.name}</p>
                      {blueprint.recommendedWorkflow.stages?.length > 0 && (
                        <ul className="list-disc list-inside text-gray-300">
                          {blueprint.recommendedWorkflow.stages.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">Implementation Notes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 mb-1">Backend</p>
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                      {(blueprint.backendLogic || []).map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Frontend</p>
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                      {(blueprint.frontendLogic || []).map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
              {blueprint.marketGapAnalysis && (
                <div className="bg-black/30 border border-white/10 rounded-lg p-4 md:col-span-2">
                  <h4 className="text-white font-semibold mb-2">Market Gap Analysis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400 mb-1">Segments</p>
                      <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {(blueprint.marketGapAnalysis.segments || []).map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Competitors</p>
                      <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {(blueprint.marketGapAnalysis.competitors || []).map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Gaps</p>
                      <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {(blueprint.marketGapAnalysis.gaps || []).map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Validation Plan</p>
                      <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {(blueprint.marketGapAnalysis.validationPlan || []).map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Saved Plans */}
        <div className="max-w-3xl mx-auto mb-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <h3 className="text-2xl font-semibold text-white mb-3">Your Saved Plans</h3>
          {!auth && (
            <p className="text-gray-400 text-sm">Sign‑in not configured. Provide Firebase globals to enable save/load.</p>
          )}
          {auth && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={async () => {
                    if (!generatedPlan || !db || !userId) return
                    try {
                      const plansRef = collection(db, `artifacts/${appId}/users/${userId}/plans`)
                      await addDoc(plansRef, generatedPlan)
                      // eslint-disable-next-line no-alert
                      alert('Plan saved')
                    } catch (e) {
                      console.error('Save failed:', e)
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  disabled={!generatedPlan}
                >
                  Save Current Plan
                </button>
                <span className="text-gray-300 text-sm">{savedPlans.length} saved</span>
              </div>
              {savedPlans.length === 0 ? (
                <p className="text-gray-400 text-sm">No plans yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedPlans.map((p) => (
                    <div key={p.id} className="bg-black/30 border border-white/10 rounded-lg p-3">
                      <div className="text-white text-sm font-semibold truncate">{p.title || p.rawIdea || 'Untitled'}</div>
                      <div className="text-gray-400 text-xs truncate">{p.workflow || p.recommendedWorkflow?.name || '—'}</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => {
                            setBlueprint(p)
                            setGeneratedPlan(p)
                            setIdea(p.rawIdea || '')
                            setGenerationMode(p.generationMode || 'auto')
                            setMode(p.mode || 'single')
                            setSingleTool(p.singleTool || 'replit')
                            setSelectedWorkflow(p.selectedWorkflow || 'bolt-replit')
                          }}
                          className="px-3 py-1 rounded bg-blue-600 text-white text-xs"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <div
              key={tool.tool_id}
              onClick={() => handleToolClick(tool)}
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/20 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <a href={`#tool-${tool.tool_id}`} onClick={(e) => { e.stopPropagation(); setSelectedTool(tool) }} className="text-xl font-semibold text-white group-hover:text-blue-300 transition-colors">
                    {tool.name || tool.tool_name}
                  </a>
                  {tool.compatibility_summary?.top_rank_score >= 0.7 && (
                    <div className="mt-1">
                      <span className="px-2 py-1 bg-green-600/20 border border-green-500/30 rounded text-xs text-green-400">
                        Highly compatible
                      </span>
                    </div>
                  )}
                </div>
                {tool.requires_review && (
                  <span className="px-2 py-1 bg-yellow-600/20 border border-yellow-500/30 rounded text-xs text-yellow-400">
                    Review
                  </span>
                )}
              </div>
              
              <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                {tool.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {(tool.category || tool.categories || []).slice(0, 3).map((category, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-300"
                  >
                    {category}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Updated: {new Date(tool.last_updated).toLocaleDateString()}</span>
                <span className="text-blue-400">Click to view →</span>
              </div>
            </div>
          ))}
        </div>

        {tools.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-4">
              No tools available yet
            </div>
            <p className="text-gray-500">
              Our RAG system is discovering and analyzing new AI development tools.
              Check back soon!
            </p>
          </div>
        )}

        {/* Pagination / Load more */}
        {offset < (totalTools || 0) && (
          <div className="flex justify-center mt-10">
            <button
              onClick={() => fetchTools({ reset: false })}
              className="px-6 py-3 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20"
            >
              Load more
            </button>
          </div>
        )}
      </main>

      {/* Tool Modal */}
      {selectedTool && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-white/20 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {selectedTool.name || selectedTool.tool_name}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={async () => {
                    try {
                      const url = `${window.location.origin}/tool/${encodeURIComponent(selectedTool.tool_id)}`
                      await navigator.clipboard.writeText(url)
                      setLinkCopied(true)
                      setTimeout(() => setLinkCopied(false), 2000)
                    } catch (e) {
                      console.error('Copy failed', e)
                    }
                  }}
                  className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                >
                  Copy link
                </button>
                {linkCopied && <span className="text-green-400 text-sm">Copied!</span>}
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                  <p className="text-gray-300">{selectedTool.description}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Compatibility</h3>
                  <CompatibilityList toolId={selectedTool.tool_id} />
                </div>

                {selectedTool.features && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Features</h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                      {selectedTool.features.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedTool.use_cases && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Use Cases</h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                      {selectedTool.use_cases.map((useCase, index) => (
                        <li key={index}>{useCase}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedTool.pricing && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Pricing</h3>
                    <div 
                      className="bg-white/5 rounded-lg p-4"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked(selectedTool.pricing || '')) }}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {(selectedTool.category || selectedTool.categories || []).map((category, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-sm text-blue-300"
                    >
                      {category}
                    </span>
                  ))}
                </div>

                <div className="text-xs text-gray-400 space-y-1">
                  <p>Tool ID: {selectedTool.tool_id}</p>
                  <p>Last Updated: {new Date(selectedTool.last_updated).toLocaleString()}</p>
                  <p>Schema Version: {selectedTool.schema_version}</p>
                  {selectedTool.source_url && (
                    <p>
                      Source: <a href={selectedTool.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        {selectedTool.source_url}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App 