import { diffLines } from 'diff';
import { Firestore } from '@google-cloud/firestore';

const AWESOME_LIST_URL = 'https://api.github.com/repos/jamesmurdza/awesome-ai-devtools/contents/README.md';
const METADATA_DOC_PATH = 'metadata/awesome-list-tracker';

interface ToolInfo {
  name: string;
  description: string;
  url: string;
}

export async function getChangedTools(firestore: Firestore): Promise<ToolInfo[]> {
  console.log('🔍 Fetching latest Awesome AI Dev Tools list...');
  
  // 1. Fetch the latest content from GitHub
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'Stackfast-RAG-Worker/1.0.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(AWESOME_LIST_URL, {
    headers,
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Awesome list from GitHub: ${response.status} ${response.statusText}`);
  }
  
  const latestContent = await response.text();
  console.log(`📄 Fetched ${latestContent.length} characters of content`);

  // 2. Get the last known content from Firestore
  const trackerDoc = firestore.doc(METADATA_DOC_PATH);
  const snapshot = await trackerDoc.get();
  const previousContent = snapshot.exists ? snapshot.data()?.content : '';

  // 3. Diff the content to find changes
  const changes = diffLines(previousContent, latestContent);
  const addedLines = changes
    .filter(part => part.added)
    .map(part => part.value)
    .join('\n');

  // 4. Update Firestore with the latest content for the next run
  await trackerDoc.set({ 
    content: latestContent, 
    last_checked: new Date(),
    last_updated: new Date()
  });

  if (!addedLines) {
    console.log('✅ No new tools found in the Awesome list.');
    return [];
  }

  console.log(`📝 Found ${addedLines.length} characters of new content`);

  // 5. Parse the new lines to extract tool information
  const newTools: ToolInfo[] = [];
  const lines = addedLines.split('\n');
  
  for (const line of lines) {
    // Match markdown links: [Tool Name](URL) - Description
    const match = line.match(/\[(.*?)\]\((.*?)\) - (.*)/);
    if (match) {
      const [, name, url, description] = match;
      newTools.push({
        name: name.trim(),
        url: url.trim(),
        description: description.trim(),
      });
    }
  }
  
  console.log(`🎯 Found ${newTools.length} new or updated tools.`);
  return newTools;
}

export async function getLastCheckedTime(firestore: Firestore): Promise<Date | null> {
  const trackerDoc = firestore.doc(METADATA_DOC_PATH);
  const snapshot = await trackerDoc.get();
  
  if (snapshot.exists) {
    const data = snapshot.data();
    return data?.last_checked?.toDate() || null;
  }
  
  return null;
} 