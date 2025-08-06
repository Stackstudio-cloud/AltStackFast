import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { chromium } from 'playwright';
import { Firestore } from '@google-cloud/firestore';
import { callGeminiToAnalyze } from './gemini';
import { toolProfileSchema } from '@altstackfast/schemas';
import { getChangedTools } from './lib/github';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.WORKER_PORT ?? 8080;

// Initialize Firestore
let firestore: Firestore | null = null;
try {
  firestore = new Firestore();
  console.log('✅ Firestore initialized successfully');
} catch (error) {
  console.warn('⚠️ Firestore initialization failed:', error);
  console.warn('⚠️ Some features may not work without proper Google Cloud credentials');
}

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/healthz', (_, res) => res.status(200).send('ok'));

// Root endpoint
app.get('/', (_, res) => {
  res.json({
    name: 'AltStackFast RAG Worker',
    version: '2.0.0',
    status: 'running',
    features: {
      rag: 'enabled',
      github_integration: 'enabled',
      web_scraping: 'enabled',
      ai_analysis: 'enabled'
    },
    endpoints: {
      health: '/healthz',
      analyze: '/analyze',
      checkUpdates: '/check-updates'
    }
  });
});

// Manual analysis endpoint (for testing)
app.post('/analyze', async (req, res) => {
  try {
    const { tool_name, url, description } = req.body;
    
    if (!tool_name || !url || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: tool_name, url, description' 
      });
    }

    console.log(`🔍 Manual analysis requested for: ${tool_name}`);

    // 1. Retrieve: Scrape enrichment data
    console.log(`🌐 Scraping data from: ${url}`);
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setDefaultTimeout(30000);
    await page.setExtraHTTPHeaders({
      'User-Agent': 'AltStackFast-RAG-Worker/2.0.0'
    });
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      
      const scrapedText = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script, style, nav, footer, header');
        scripts.forEach(el => el.remove());
        
        const mainContent = document.querySelector('main, article, .content, .main, #content, #main') || document.body;
        return (mainContent as HTMLElement).innerText || document.body.innerText;
      });
      
      await browser.close();
      
      console.log(`📄 Scraped ${scrapedText.length} characters`);

      // 2. Augment: Combine data into rich context
      const context = `
SOURCE 1 - CURATED LIST DESCRIPTION:
${description}

SOURCE 2 - OFFICIAL WEBSITE CONTENT:
${scrapedText.substring(0, 8000)}

INSTRUCTIONS:
Analyze the above information about "${tool_name}" and create a comprehensive tool profile. 
Focus on extracting key features, use cases, pricing information, and technical details.
Ensure the response is structured according to the toolProfileSchema.
      `.trim();

      // 3. Generate: Call AI
      console.log(`🤖 Calling Gemini AI for analysis...`);
      const profileJson = await callGeminiToAnalyze(context);

      // 4. Guard: Validate response
      const toolId = tool_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const dataToValidate = {
        ...profileJson,
        tool_id: toolId,
        tool_name: tool_name,
        last_updated: new Date().toISOString(),
        schema_version: "2025-08-06",
        requires_review: true,
        source_url: url,
        source_description: description,
      };
      
      const validatedProfile = toolProfileSchema.parse(dataToValidate);

      // 5. Save to Firestore
      if (firestore) {
        await firestore.collection('tools').doc(toolId).set(validatedProfile, { merge: true });
        console.log(`💾 Saved profile to Firestore: ${toolId}`);
      }

      res.json({
        success: true,
        toolId,
        toolName: tool_name,
        scrapedLength: scrapedText.length,
        profile: validatedProfile
      });

    } catch (scrapingError) {
      await browser.close();
      console.warn(`⚠️ Failed to scrape ${url}:`, scrapingError);
      
      // Fallback analysis
      const fallbackContext = `
SOURCE - CURATED LIST DESCRIPTION:
${description}

INSTRUCTIONS:
Analyze the above information about "${tool_name}" and create a tool profile.
Since we couldn't access the official website, focus on what we know from the description.
Ensure the response is structured according to the toolProfileSchema.
      `.trim();
      
      const profileJson = await callGeminiToAnalyze(fallbackContext);
      
      const toolId = tool_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const dataToValidate = {
        ...profileJson,
        tool_id: toolId,
        tool_name: tool_name,
        last_updated: new Date().toISOString(),
        schema_version: "2025-08-06",
        requires_review: true,
        source_url: url,
        source_description: description,
        scraping_failed: true,
      };
      
      const validatedProfile = toolProfileSchema.parse(dataToValidate);

      if (firestore) {
        await firestore.collection('tools').doc(toolId).set(validatedProfile, { merge: true });
      }

      res.json({
        success: true,
        toolId,
        toolName: tool_name,
        scrapingFailed: true,
        profile: validatedProfile
      });
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Check for updates endpoint
app.post('/check-updates', async (req, res) => {
  try {
    if (!firestore) {
      return res.status(500).json({ 
        error: 'Firestore not available' 
      });
    }

    console.log('🔍 Manual check for updates requested');
    const changedTools = await getChangedTools(firestore);
    
    res.json({
      success: true,
      toolsFound: changedTools.length,
      tools: changedTools
    });

  } catch (error) {
    console.error('❌ Check for updates failed:', error);
    res.status(500).json({ 
      error: 'Check for updates failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 RAG Worker server listening for jobs at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🔍 Analysis endpoint: http://localhost:${PORT}/analyze`);
  console.log(`🔄 Check updates: http://localhost:${PORT}/check-updates`);
  console.log('🎯 RAG features enabled: GitHub integration, web scraping, AI analysis');
}); 