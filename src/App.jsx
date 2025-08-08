import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, addDoc } from 'firebase/firestore';
import { marked } from 'marked';

// --- Firebase Initialization ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, db, auth;
if (Object.keys(firebaseConfig).length > 0) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

// --- Constants ---
const WORKFLOWS = {
  "bolt-replit": { name: "Rapid MVP (Bolt → Replit)", stages: ["bolt", "replit"] },
  "bubble-cursor": { name: "Design-First (Bubble → Cursor)", stages: ["bubble", "cursor"] },
};

// --- Seed Database (Upgraded with new, detailed profiles) ---
const SEED_TOOL_PROFILES = [
  { "tool_id": "lovable", "name": "Lovable", "established": "2023", "category": ["Vibe Coding Tool", "Frontend Builder"], "description": "AI-assisted visual web-app builder with real-time preview.", "frameworks": [], "hosted": true, "self_hostable": false, "api_available": false, "supported_languages": ["JavaScript", "TypeScript"], "input_types": ["natural_language", "visual_blocks"], "output_types": ["code", "live_preview"], "integrations": ["GitHub"], "compatible_with": ["Vercel", "Netlify"], "integration_complexity": 1, "popularity_score": 0.2, "community_sentiment": "early_positive", "notable_strengths": ["No-code AI prototypes"], "known_limitations": ["Young project, limited export"], "llm_backends": ["OpenAI GPT-4o"], "default_use_case": "Rapid webpage mockups" },
  { "tool_id": "bubble", "name": "Bubble.io", "established": "2012", "category": ["Vibe Coding Tool", "Low-Code Platform", "Backend"], "description": "No-code web-app builder with built-in database and workflows.", "frameworks": [], "hosted": true, "self_hostable": false, "api_available": true, "supported_languages": ["visual"], "input_types": ["visual"], "output_types": ["hosted_app"], "integrations": ["Stripe", "Zapier"], "compatible_with": ["Vercel", "Supabase"], "integration_complexity": 2, "popularity_score": 0.85, "community_sentiment": "positive", "notable_strengths": ["Full-stack no-code", "Large plugin marketplace"], "known_limitations": ["Vendor lock-in", "Performance overhead"], "llm_backends": ["OpenAI GPT-4o"], "default_use_case": "MVP web apps" },
  { "tool_id": "manus_ai", "name": "Manus AI", "established": "2024", "category": ["Vibe Coding Tool", "Agentic Tool", "CLI"], "description": "Terminal-first AI coding assistant that explains, writes and refactors code.", "frameworks": [], "hosted": false, "self_hostable": true, "api_available": false, "supported_languages": ["Python", "Go", "Rust", "JavaScript", "many"], "input_types": ["code", "natural_language"], "output_types": ["code", "explanations"], "integrations": ["Git", "Shell"], "compatible_with": ["VS Code", "Warp Terminal"], "integration_complexity": 1, "popularity_score": 0.1, "community_sentiment": "niche_positive", "notable_strengths": ["Works offline with local models"], "known_limitations": ["Limited GUI"], "llm_backends": ["OpenAI GPT-4o", "ggml"], "default_use_case": "Command-line AI pair programming" },
  { "tool_id": "gemini", "name": "Google Gemini", "established": "2023", "category": ["Agentic Tool", "LLM", "CLI"], "description": "Google’s multimodal LLM accessible via web UI and API.", "frameworks": [], "hosted": true, "self_hostable": false, "api_available": true, "supported_languages": ["multilingual"], "input_types": ["natural_language", "images", "code"], "output_types": ["json", "text", "images"], "integrations": ["Vertex AI", "Google Cloud"], "compatible_with": ["LangChain", "CrewAI"], "integration_complexity": 1, "popularity_score": 0.75, "community_sentiment": "mixed_positive", "notable_strengths": ["Strong multimodality", "Deep GCP integration"], "known_limitations": ["Rate limits", "Closed weights"], "llm_backends": [], "default_use_case": "General purpose multimodal AI" }
];

// --- Main App Component ---
const App = () => {
  // State for UI and User Data
  const [userId, setUserId] = useState(null);
  const [appIdea, setAppIdea] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // State for Mode and Selections
  const [generationMode, setGenerationMode] = useState('auto'); // 'auto' or 'manual'
  const [mode, setMode] = useState('single'); // 'single' or 'workflow'
  const [singleTool, setSingleTool] = useState('replit');
  const [selectedWorkflow, setSelectedWorkflow] = useState('bolt-replit');
  const [mainView, setMainView] = useState('architect'); // 'architect' or 'registry'

  // State for Generated Output
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [activeStageTab, setActiveStageTab] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState('overview');
  
  // State for Saved Plans & Tools from Firebase
  const [savedPlans, setSavedPlans] = useState([]);
  const [toolRegistry, setToolRegistry] = useState(SEED_TOOL_PROFILES);

  // --- Firebase Auth & Data Loading ---
  useEffect(() => {
    if (!auth) return;
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) { setUserId(user.uid); } 
      else {
        try {
          if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
          else await signInAnonymously(auth);
        } catch (error) { console.error("Auth failed:", error); }
      }
    });

    if (!db) return () => unsubAuth();
    
    const collections = ['tools', 'backends', 'frontends', 'boilerplates'];
    const unsubs = collections.map(col => 
      onSnapshot(collection(db, `artifacts/${appId}/public/data/${col}`), (snapshot) => {
        const dataFromDb = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStackRegistry(prev => {
            const combined = [...(SEED_DATA[col] || [])];
            dataFromDb.forEach(dbItem => {
                const key = `${col.slice(0, -1)}_id`;
                const index = combined.findIndex(seedItem => seedItem[key] === dbItem[key]);
                if (index !== -1) { combined[index] = dbItem; }
                else { combined.push(dbItem); }
            });
            return { ...prev, [col]: combined };
        });
      })
    );
    
    if(userId) {
        const plansUnsub = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/plans`), (snapshot) => {
            setSavedPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        unsubs.push(plansUnsub);
    }

    return () => { unsubAuth(); unsubs.forEach(unsub => unsub()); };
  }, [userId]);

  // --- Core "AI Brain" to fetch blueprint ---
  const fetchBlueprintFromAI = async (rawIdea) => {
    setIsLoading(true);
    const apiBase = import.meta.env.VITE_API_URL || 'https://stackfast-api.vercel.app';
    try {
      const response = await fetch(`${apiBase}/v1/blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawIdea, stackRegistry }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(`API request failed: ${response.status} ${text}`);

      let payload;
      try { payload = JSON.parse(text); } catch (e) { throw new Error(`Invalid JSON from API: ${text}`); }
      if (!payload?.success) throw new Error(payload?.error || 'Unknown API error');

      const blueprint = { ...payload.data, rawIdea };
      return blueprint;
    } catch (error) {
      console.error('Error fetching blueprint from API:', error);
      alert(`Failed to generate the project blueprint. ${error?.message || ''}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // --- Plan Generation Logic ---
  const generatePlanFromBlueprint = (blueprint) => {
    let workflowName, stages, reasoning;

    if (generationMode === 'auto') {
        workflowName = blueprint.recommendedWorkflow.name;
        stages = blueprint.recommendedWorkflow.stages;
        reasoning = blueprint.recommendedWorkflow.reasoning;
    } else {
        if (mode === 'workflow') {
            workflowName = WORKFLOWS[selectedWorkflow].name;
            stages = WORKFLOWS[selectedWorkflow].stages;
            reasoning = `Manually selected workflow: MVP with ${stages[0]}, refine with ${stages[1]}.`;
        } else {
            workflowName = `Single Tool (${singleTool})`;
            stages = [singleTool];
            reasoning = `Manually configured for building within ${singleTool}.`;
        }
    }

    const stagePlans = stages.map((platform, index) => {
        const stageBlueprint = {...blueprint, isSecondStage: index > 0};
        return generatePlanForPlatform(stageBlueprint, platform);
    });
    
    return { ...blueprint, workflow: workflowName, stages: stagePlans, reasoning, timestamp: new Date().toISOString(), generationMode };
  };
  
  const generatePlanForPlatform = (blueprint, platform) => {
    const { title, rawIdea, techStack, backendLogic, frontendLogic } = blueprint;
    const isDeclarative = platform === 'bolt' || platform === 'bubble';
    const masterPrompt = `Build a **${title}** using **${platform}**. Goal: *"${rawIdea}"*. Stack: ${techStack}. Backend Tasks: ${backendLogic.join(', ')}. Frontend Tasks: ${frontendLogic.join(', ')}.`;
    const secondStagePrompt = `Continue a project in **${platform}**. Original blueprint: ${masterPrompt}. Your task is to enhance it by adding user profiles and a commenting system.`;
    
    let prompts = isDeclarative
        ? [{ name: "One-Shot Master Prompt", prompt: `Generate a complete app:\n\n${masterPrompt}` }]
        : [
            { name: "Master Prompt & Scaffolding", prompt: `Set up a project for a **${title}** based on this plan:\n\n${masterPrompt}` },
            { name: "Backend Implementation", prompt: `Implement the backend logic: ${backendLogic.join(', ')}.` },
            { name: "Frontend Implementation", prompt: `Implement the frontend logic: ${frontendLogic.join(', ')}.` },
          ];
    
    if (blueprint.isSecondStage) prompts = [{ name: `Continuing in ${platform}`, prompt: secondStagePrompt }];

    const overview = `## Stage: ${platform}\nThis plan is for **${platform}**. ${isDeclarative ? 'It uses a single, comprehensive prompt.' : 'It uses a master prompt and specific chunks.'}`;
    const readmeContent = `# Project: ${title} (${platform} Stage)\n\n## Checklist\n\n${prompts.map((p, i) => `- [ ] Task ${i+1}: ${p.name}`).join('\n')}`;
    const readme = "```markdown\n" + readmeContent + "\n```";
    return { platform, overview, prompts, readme };
  };

  // --- Event Handlers ---
  const handleGenerate = async () => {
    if (!appIdea.trim()) { alert("Please enter your project idea."); return; }
    setGeneratedPlan(null);
    const blueprint = await fetchBlueprintFromAI(appIdea);
    if (blueprint) {
      const plan = generatePlanFromBlueprint(blueprint);
      setGeneratedPlan(plan);
      setActiveStageTab(0);
      setActiveSubTab('overview');
    }
  };
  
  const handleSavePlan = async () => {
    if (!generatedPlan || !userId || !db) return;
    setIsLoading(true);
    try {
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/plans`), generatedPlan);
        alert("Workflow plan saved!");
    } catch (error) { console.error("Error saving plan:", error); alert("Failed to save plan."); }
    setIsLoading(false);
  };

  const handleLoadPlan = (plan) => {
    setGeneratedPlan(plan);
    setAppIdea(plan.rawIdea || '');
    setGenerationMode(plan.generationMode || 'auto');
    const isWorkflow = Object.values(WORKFLOWS).some(wf => wf.name === plan.workflow);
    setMode(isWorkflow ? 'workflow' : 'single');
    if(isWorkflow) {
        const wfKey = Object.keys(WORKFLOWS).find(key => WORKFLOWS[key].name === plan.workflow);
        setSelectedWorkflow(wfKey);
    } else if (plan.stages.length > 0) {
        setSingleTool(plan.stages[0].platform);
    }
    setActiveStageTab(0);
    setActiveSubTab('overview');
  };

  const containerClasses = `min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-gray-800 text-gray-800'}`;

  return (
    <div className={containerClasses}>
      <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <header className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Workflow Architect</h1>
                <p className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Architect multi-tool development pipelines.</p>
            </div>
            <div className="flex items-center space-x-2 rounded-lg p-1" >
                 <button onClick={() => setMainView('architect')} className={`px-4 py-2 text-sm font-medium rounded-md ${mainView === 'architect' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Architect</button>
                 <button onClick={() => setMainView('registry')} className={`px-4 py-2 text-sm font-medium rounded-md ${mainView === 'registry' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Stack Registry</button>
            </div>
        </header>

        {mainView === 'architect' ? (
            <ArchitectView 
                appIdea={appIdea} setAppIdea={setAppIdea}
                isLoading={isLoading} handleGenerate={handleGenerate}
                savedPlans={savedPlans} handleLoadPlan={handleLoadPlan}
                generatedPlan={generatedPlan} activeStageTab={activeStageTab} setActiveStageTab={setActiveStageTab}
                activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab}
                handleSavePlan={handleSavePlan} darkMode={darkMode}
                generationMode={generationMode} setGenerationMode={setGenerationMode}
                mode={mode} setMode={setMode}
                singleTool={singleTool} setSingleTool={setSingleTool}
                selectedWorkflow={selectedWorkflow} setSelectedWorkflow={setSelectedWorkflow}
            />
        ) : (
            <StackRegistryView registry={stackRegistry} db={db} appId={appId} darkMode={darkMode} />
        )}
      </div>
    </div>
  );
};

const ArchitectView = ({ appIdea, setAppIdea, isLoading, handleGenerate, savedPlans, handleLoadPlan, generatedPlan, activeStageTab, setActiveStageTab, activeSubTab, setActiveSubTab, handleSavePlan, darkMode, generationMode, setGenerationMode, mode, setMode, singleTool, setSingleTool, selectedWorkflow, setSelectedWorkflow }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
            <div className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h2 className="text-xl font-bold mb-4">1. Architect a New Plan</h2>
                <div className="space-y-4">
                    <textarea value={appIdea} onChange={(e) => setAppIdea(e.target.value)} rows="4" className={`w-full p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} placeholder="Describe your application idea..."></textarea>
                    <div>
                        <label className="block text-sm font-medium mb-2">Generation Mode</label>
                        <div className="flex rounded-lg border p-1" ><button onClick={() => setGenerationMode('auto')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-md ${generationMode === 'auto' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Auto</button><button onClick={() => setGenerationMode('manual')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-md ${generationMode === 'manual' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Manual</button></div>
                    </div>
                    {generationMode === 'manual' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-2">Mode</label>
                                <select value={mode} onChange={(e) => setMode(e.target.value)} className={`w-full p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}><option value="single">Single Tool</option><option value="workflow">Workflow</option></select>
                            </div>
                            {mode === 'single' ? (
                                <div><label className="block text-sm font-medium mb-2">Tool</label><select value={singleTool} onChange={(e) => setSingleTool(e.target.value)} className={`w-full p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}><option value="replit">Replit AI</option><option value="cursor">Cursor IDE</option><option value="bolt">Bolt.new</option><option value="bubble">Bubble.io</option></select></div>
                            ) : (
                                <div><label className="block text-sm font-medium mb-2">Workflow</label><select value={selectedWorkflow} onChange={(e) => setSelectedWorkflow(e.target.value)} className={`w-full p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}>{Object.entries(WORKFLOWS).map(([key, wf]) => <option key={key} value={key}>{wf.name}</option>)}</select></div>
                            )}
                        </>
                    )}
                    <button onClick={handleGenerate} disabled={isLoading} className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition flex items-center justify-center">{isLoading ? <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> : null}Generate Plan</button>
                </div>
            </div>
            <div className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h2 className="text-xl font-bold mb-4">2. Your Saved Plans</h2>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                    {savedPlans.length > 0 ? savedPlans.map(plan => (<div key={plan.id} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}><p className="font-semibold truncate">{plan.title}</p><p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{plan.workflow}</p><button onClick={() => handleLoadPlan(plan)} className={`mt-2 text-sm font-semibold text-indigo-600 ${darkMode ? 'text-indigo-400' : ''}`}>Load</button></div>)) : <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No plans saved yet.</p>}
                </div>
            </div>
        </div>
        <div className="lg:col-span-2">
            {isLoading && !generatedPlan ? ( <LoadingPlaceholder darkMode={darkMode} text="The AI architect is generating a custom workflow..."/> ) : 
            generatedPlan ? ( <PlanOutputView plan={generatedPlan} activeStageTab={activeStageTab} setActiveStageTab={setActiveStageTab} activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} handleSavePlan={handleSavePlan} isLoading={isLoading} darkMode={darkMode} /> ) : 
            ( <InitialPlaceholder darkMode={darkMode} /> )}
        </div>
    </div>
);

const StackRegistryView = ({ registry, db, appId, darkMode }) => {
    const [activeTab, setActiveTab] = useState('tools');
    const [filter, setFilter] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);

    const categories = [...new Set(Object.values(registry).flat().flatMap(item => item.category || []))];
    const filteredItems = (registry[activeTab] || []).filter(item => 
        filter ? (item.category || []).includes(filter) : true
    );

    return (
        <div className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-2xl font-bold mb-4">Stack Registry</h2>
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {Object.keys(SEED_DATA).map(key => (
                        <button key={key} onClick={() => { setActiveTab(key); setFilter(''); }} className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm capitalize ${activeTab === key ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{key}</button>
                    ))}
                </nav>
            </div>
            <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilter('')} className={`px-3 py-1 text-xs rounded-full ${!filter ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>All</button>
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1 text-xs rounded-full ${filter === cat ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>{cat}</button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
                {filteredItems.map(item => (
                    <div key={item.tool_id || item.backend_id || item.frontend_id || item.boilerplate_id} className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <h4 className="font-bold">{item.name}</h4>
                        <p className={`text-sm truncate ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{item.description}</p>
                        <button onClick={() => setSelectedItem(item)} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-2">View Details</button>
                    </div>
                ))}
            </div>
            {selectedItem && <ToolDetailModal tool={selectedItem} onClose={() => setSelectedItem(null)} darkMode={darkMode} />}
        </div>
    );
};

const PlanOutputView = ({ plan, activeStageTab, setActiveStageTab, activeSubTab, setActiveSubTab, handleSavePlan, isLoading, darkMode }) => (
    <div className={`rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">{plan.title}</h3><button onClick={handleSavePlan} disabled={isLoading} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-green-400 transition flex items-center">Save Plan</button></div>
            {plan.reasoning && <blockquote className="text-sm p-3 bg-indigo-50 dark:bg-indigo-900/50 rounded-lg border-l-4 border-indigo-500 my-2"><p className="font-semibold">AI Recommendation:</p>{plan.reasoning}</blockquote>}
            {plan.recommendedBackend && <p className="text-sm mt-2"><strong>Recommended Backend:</strong> {plan.recommendedBackend.name} - {plan.recommendedBackend.reasoning}</p>}
            {plan.recommendedFrontend && <p className="text-sm"><strong>Recommended Frontend Tool:</strong> {plan.recommendedFrontend.name} - {plan.recommendedFrontend.reasoning}</p>}
            {plan.recommendedBoilerplate && <p className="text-sm"><strong>Recommended Boilerplate:</strong> {plan.recommendedBoilerplate.name} - {plan.recommendedBoilerplate.reasoning}</p>}
        </div>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">{plan.stages.map((stage, index) => (<button key={index} onClick={() => setActiveStageTab(index)} className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm capitalize ${activeStageTab === index ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Stage {index + 1}: {stage.platform}</button>))}</nav>
        </div>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-4" aria-label="Tabs"><button onClick={() => setActiveSubTab('overview')} className={`px-3 py-2 font-medium text-sm rounded-md ${activeSubTab === 'overview' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-gray-500 hover:text-gray-700'}`}>Overview</button><button onClick={() => setActiveSubTab('prompts')} className={`px-3 py-2 font-medium text-sm rounded-md ${activeSubTab === 'prompts' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-gray-500 hover:text-gray-700'}`}>Prompts</button><button onClick={() => setActiveSubTab('readme')} className={`px-3 py-2 font-medium text-sm rounded-md ${activeSubTab === 'readme' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-gray-500 hover:text-gray-700'}`}>README.md</button></nav>
        </div>
        <div className="p-6">
            {activeSubTab === 'overview' && <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: marked.parse(plan.stages[activeStageTab].overview) }}></div>}
            {activeSubTab === 'prompts' && <div>{plan.stages[activeStageTab].prompts.map((p, i) => <PromptCard key={i} promptData={p} index={i+1} />)}</div>}
            {activeSubTab === 'readme' && <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: marked.parse(plan.stages[activeStageTab].readme) }}></div>}
        </div>
    </div>
);

const PromptCard = ({ promptData, index }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(promptData.prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg mb-6 overflow-hidden">
      <div className="p-5"><div className="flex justify-between items-start"><div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert"><h3 className="mt-0">Prompt {index}: {promptData.name}</h3><div dangerouslySetInnerHTML={{ __html: marked.parse(promptData.prompt) }}></div></div><button onClick={handleCopy} className="flex-shrink-0 ml-4 mt-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md p-2" title="Copy prompt">{copied ? <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>}</button></div></div>
    </div>
  );
};

const LoadingPlaceholder = ({ darkMode, text }) => (<div className={`flex items-center justify-center h-full rounded-xl border-2 border-dashed ${darkMode ? 'border-gray-700' : 'border-gray-300'} p-12 text-center`}><div className={darkMode ? 'text-gray-500' : 'text-gray-400'}><svg className="animate-spin h-12 w-12 mx-auto" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg><h3 className="mt-4 text-sm font-medium">{text}</h3></div></div>);
const InitialPlaceholder = ({ darkMode }) => (<div className={`flex items-center justify-center h-full rounded-xl border-2 border-dashed ${darkMode ? 'border-gray-700' : 'border-gray-300'} p-12 text-center`}><div className={darkMode ? 'text-gray-500' : 'text-gray-400'}><svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><h3 className="mt-2 text-sm font-medium">Your generated plan will appear here</h3></div></div>);
const ToolDetailModal = ({ tool, onClose, darkMode }) => (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className={`rounded-xl shadow-2xl w-full max-w-2xl ${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white'} max-h-[90vh] overflow-y-auto`}><div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-inherit"><h3 className="text-xl font-bold">{tool.name} <span className="text-sm font-normal text-gray-500">({tool.established})</span></h3><button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">&times;</button></div><div className="p-6 space-y-4"><p>{tool.description}</p><div><strong>Default Use Case:</strong> {tool.default_use_case}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"><div><strong>Category:</strong> {Array.isArray(tool.category) && tool.category.join(', ')}</div><div><strong>Strengths:</strong> {Array.isArray(tool.notable_strengths) && tool.notable_strengths.join(', ')}</div><div><strong>Limitations:</strong> {Array.isArray(tool.known_limitations) && tool.known_limitations.join(', ')}</div><div><strong>Integrations:</strong> {Array.isArray(tool.integrations) && tool.integrations.join(', ')}</div><div><strong>LLM Backends:</strong> {Array.isArray(tool.llm_backends) && tool.llm_backends.join(', ')}</div><div><strong>Popularity:</strong> {tool.popularity_score} / 1</div></div></div></div></div>);

export default App;
