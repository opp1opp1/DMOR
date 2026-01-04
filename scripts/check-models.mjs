import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Try to load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error('GOOGLE_GENERATIVE_AI_API_KEY not found. Please set it in .env.local');
  process.exit(1);
}

async function listModels() {
  console.log('Fetching available models from Google Generative AI API...');
  
  try {
    // Using raw fetch to ensure we see exactly what the API returns
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.models) {
        console.log('\n=== Supported Models ===');
        const generateModels = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
        
        generateModels.forEach(m => {
            // Filter to show relevant ones (gemini versions)
            console.log(`Model: ${m.name.replace('models/', '')}`);
            console.log(`Description: ${m.displayName}`);
            console.log(`Version: ${m.version}`);
            console.log('---');
        });
        
        // Check for the requested ones explicitly
        const requested = ['gemini-3-flash', 'gemini-2.5-flash'];
        console.log('\n=== Check Requested Models ===');
        requested.forEach(req => {
            const found = data.models.find(m => m.name.includes(req));
            if (found) {
                console.log(`[FOUND] ${req}`);
            } else {
                console.log(`[NOT FOUND] ${req}`);
            }
        });

    } else {
        console.log('No models returned from API.');
    }

  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
