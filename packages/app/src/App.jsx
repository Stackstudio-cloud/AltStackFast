import React, { useState, useEffect } from 'react'
import { marked } from 'marked'
import { apiFetch } from './lib/apiClient'

function App() {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTool, setSelectedTool] = useState(null)
  const [idea, setIdea] = useState('')
  const [blueprintLoading, setBlueprintLoading] = useState(false)
  const [blueprintError, setBlueprintError] = useState(null)
  const [blueprint, setBlueprint] = useState(null)

  useEffect(() => {
    fetchTools()
  }, [])

  const fetchTools = async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/v1/tools')
      setTools(data.data || data.tools || [])
    } catch (err) {
      console.error('Error fetching tools:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToolClick = (tool) => {
    setSelectedTool(tool)
  }

  const closeModal = () => {
    setSelectedTool(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white">Loading AltStackFast...</h2>
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
                AltStackFast
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
          <div className="mt-6 flex justify-center space-x-4">
            <div className="bg-green-600/20 border border-green-500/30 rounded-lg px-4 py-2">
              <span className="text-green-400 text-sm font-medium">
                {tools.length} Tools Available
              </span>
            </div>
            <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg px-4 py-2">
              <span className="text-blue-400 text-sm font-medium">
                Auto-Updated
              </span>
            </div>
          </div>
        </div>

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
                  setBlueprint(resp.data || resp)
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
            </div>
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
                <h3 className="text-xl font-semibold text-white group-hover:text-blue-300 transition-colors">
                  {tool.name || tool.tool_name}
                </h3>
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

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                  <p className="text-gray-300">{selectedTool.description}</p>
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
                      dangerouslySetInnerHTML={{ __html: marked(selectedTool.pricing) }}
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