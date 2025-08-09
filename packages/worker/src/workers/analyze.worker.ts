import { Worker, Job, Queue } from 'bullmq';
import { chromium } from 'playwright';
import { Firestore } from '@google-cloud/firestore';
import { Redis } from 'ioredis';
import { callGeminiToAnalyze } from '../gemini';
import { toolProfileSchema } from '@stackfast/schemas';
import { getChangedTools, getLastCheckedTime } from '../lib/github';

const ANALYZE_QUEUE_NAME = 'analyze-tool';

console.log('🚀 RAG worker process started.');

// Initialize Firestore
let firestore: Firestore | null = null;
try {
  firestore = new Firestore();
  console.log('✅ Firestore initialized successfully');
} catch (error) {
  console.warn('⚠️ Firestore initialization failed:', error);
  console.warn('⚠️ Some features may not work without proper Google Cloud credentials');
}

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// This is the main job that runs on a schedule (e.g., daily)
async function checkForUpdates() {
  if (!firestore) {
    console.error('❌ Firestore not available - cannot check for updates');
    return { status: 'error', message: 'Firestore not available' };
  }

  console.log('🔍 Checking for tool updates from GitHub...');
  
  try {
    const changedTools = await getChangedTools(firestore);
    
    if (changedTools.length === 0) {
      console.log('✅ No new tools to analyze');
      return { status: 'complete', toolsFound: 0 };
    }

    console.log(`📋 Found ${changedTools.length} new tools to analyze`);
    
    // Add analysis jobs to the queue for each new tool
    const analyzeQueue = new Queue(ANALYZE_QUEUE_NAME, { connection: redis });
    
    for (const tool of changedTools) {
      await analyzeQueue.add('analyze-tool-job', { 
        tool_name: tool.name, 
        url: tool.url, 
        description: tool.description 
      });
      console.log(`➕ Queued analysis job for: ${tool.name}`);
    }

    return { status: 'complete', toolsFound: changedTools.length };
    
  } catch (error) {
    console.error('❌ Error checking for updates:', error);
    throw error;
  }
}

// The handler for individual analysis jobs
const analysisHandler = async (job: Job<{ tool_name: string; url?: string; description?: string }>) => {
  const { tool_name, url, description } = job.data;
  const safeDescription: string = description || '';
  console.log(`[JOB START] Analyzing ${tool_name}...`);

  try {
    // 1. Retrieve: Scrape enrichment data from the tool's website
    console.log(`🌐 Scraping data from: ${url}`);
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set a reasonable timeout and user agent
    await page.setDefaultTimeout(30000);
  await page.setExtraHTTPHeaders({
      'User-Agent': 'AltStackFast-RAG-Worker/1.0.0'
    });
    
    try {
      await page.goto(url || 'about:blank', { waitUntil: 'domcontentloaded' });
      
      // Extract text content, focusing on main content areas
      const scrapedText = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, nav, footer, header');
        scripts.forEach(el => el.remove());
        
        // Get text from main content areas
        const mainContent = document.querySelector('main, article, .content, .main, #content, #main') || document.body;
        return (mainContent as HTMLElement).innerText || document.body.innerText;
      });
      
      await browser.close();
      
      console.log(`📄 Scraped ${scrapedText.length} characters from ${tool_name}`);

      // 2. Augment: Combine all our data into a rich context
      const context = `
SOURCE 1 - CURATED LIST DESCRIPTION:
${safeDescription}

SOURCE 2 - OFFICIAL WEBSITE CONTENT:
${scrapedText.substring(0, 8000)}

INSTRUCTIONS:
Analyze the above information about "${tool_name}" and create a comprehensive tool profile. 
Focus on extracting key features, use cases, pricing information, and technical details.
Ensure the response is structured according to the toolProfileSchema.
      `.trim();

      // 3. Generate: Call the AI with the augmented prompt
      console.log(`🤖 Calling Gemini AI for analysis...`);
      const profileJson = await callGeminiToAnalyze(context);

      // 4. Guard: Validate the response
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
      } else {
        console.warn('⚠️ Firestore not available - profile not saved');
      }
      
      console.log(`[JOB COMPLETE] Successfully analyzed and saved ${tool_name}.`);
      return { 
        status: 'complete', 
        toolId,
        toolName: tool_name,
        scrapedLength: scrapedText.length
      };

    } catch (scrapingError) {
      await browser.close();
      console.warn(`⚠️ Failed to scrape ${url}:`, scrapingError);
      
      // Fallback: analyze with just the description
      console.log(`🔄 Falling back to description-only analysis for ${tool_name}`);
      const fallbackContext = `
SOURCE - CURATED LIST DESCRIPTION:
${safeDescription}

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
      
      return { 
        status: 'complete', 
        toolId,
        toolName: tool_name,
        scrapingFailed: true
      };
    }

  } catch (error) {
    console.error(`[JOB FAILED] for ${tool_name}:`, error);
    throw error; // Re-throw to trigger BullMQ's retry logic
  }
};

// Create the worker with different handlers for different job types
const worker = new Worker(ANALYZE_QUEUE_NAME, async (job: Job) => {
  console.log(`🎯 Processing job: ${job.name} (ID: ${job.id})`);
  
  if (job.name === 'check-for-updates') {
    return await checkForUpdates();
  }
  
  if (job.name === 'analyze-tool-job') {
    return await analysisHandler(job);
  }
  
  console.warn(`⚠️ Unknown job type: ${job.name}`);
  return { status: 'error', message: 'Unknown job type' };
}, { 
  connection: redis,
  concurrency: 2 // Process up to 2 jobs simultaneously
});

// Handle worker events
worker.on('completed', (job) => {
  console.log(`✅ Job completed: ${job.name} (ID: ${job.id})`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job failed: ${job?.name} (ID: ${job?.id})`, err);
});

worker.on('error', (err) => {
  console.error('❌ Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down RAG worker...');
  await worker.close();
  await redis.quit();
  process.exit(0);
});

console.log('🎯 RAG worker ready to process jobs');

// Export for potential external use
export { worker, redis }; 