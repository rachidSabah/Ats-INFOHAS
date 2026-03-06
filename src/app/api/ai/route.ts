import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'edge';

// Multi-provider AI Route - supports Gemini, DeepSeek, OpenAI, Groq, Ollama, Cerebras, Mistral, Together
// All using direct HTTP API calls - 100% Edge Runtime compatible!

// Provider configurations
const PROVIDERS: Record<string, {
  name: string;
  baseUrl: string;
  models: { name: string; tags: string }[];
  defaultModel: string;
  requiresKey: boolean;
  keyPrefix?: string;
}> = {
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      { name: "deepseek-chat", tags: "Free, Fast" },
      { name: "deepseek-coder", tags: "Free, Code Expert" },
      { name: "deepseek-reasoner", tags: "Premium, Reasoning" },
      { name: "deepseek-r1", tags: "Free, Reasoning, R1" },
      { name: "deepseek-r1-distill-llama-70b", tags: "Free, Reasoning" }
    ],
    defaultModel: "deepseek-chat",
    requiresKey: true,
    keyPrefix: "sk-"
  },
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      { name: "gemini-2.0-flash", tags: "Free, Vision, Fast" },
      { name: "gemini-2.5-flash", tags: "Free, Vision, Fast" },
      { name: "gemini-2.0-pro", tags: "Premium, Vision" },
      { name: "gemini-1.5-flash", tags: "Free, Vision" },
      { name: "gemini-1.5-pro", tags: "Premium, Vision" }
    ],
    defaultModel: "gemini-2.0-flash",
    requiresKey: true,
    keyPrefix: "AIza"
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { name: "gpt-4o", tags: "Premium, Vision, Fast" },
      { name: "gpt-4o-mini", tags: "Free, Fast" },
      { name: "gpt-4-turbo", tags: "Premium, Vision" },
      { name: "gpt-3.5-turbo", tags: "Free, Fast" },
      { name: "o1-preview", tags: "Premium, Reasoning" },
      { name: "o1-mini", tags: "Premium, Reasoning, Fast" }
    ],
    defaultModel: "gpt-4o-mini",
    requiresKey: true,
    keyPrefix: "sk-"
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    models: [
      { name: "llama-3.3-70b-versatile", tags: "Free, Fast, Llama 70B" },
      { name: "llama-3.1-70b-versatile", tags: "Free, Fast" },
      { name: "llama-3.1-8b-instant", tags: "Free, Ultra Fast" },
      { name: "llama-3.2-90b-vision-preview", tags: "Free, Vision" },
      { name: "mixtral-8x7b-32768", tags: "Free, Fast, Mixtral" },
      { name: "gemma2-9b-it", tags: "Free, Fast" },
      { name: "deepseek-r1-distill-llama-70b", tags: "Free, R1 Reasoning" }
    ],
    defaultModel: "llama-3.3-70b-versatile",
    requiresKey: true,
    keyPrefix: "gsk_"
  },
  ollama: {
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434/v1",
    models: [
      { name: "llama3.2:latest", tags: "Free, Local, Llama 3.2" },
      { name: "llama3.1:70b", tags: "Free, Local, Llama 3.1 70B" },
      { name: "deepseek-r1:latest", tags: "Free, Local, R1 Reasoning" },
      { name: "mistral:latest", tags: "Free, Local, Mistral" },
      { name: "mixtral:latest", tags: "Free, Local, Mixtral 8x7B" },
      { name: "codellama:latest", tags: "Free, Local, Code" },
      { name: "qwen2.5:latest", tags: "Free, Local, Qwen" },
      { name: "gemma2:latest", tags: "Free, Local, Gemma 2" },
      { name: "phi3:latest", tags: "Free, Local, Phi-3" }
    ],
    defaultModel: "llama3.2:latest",
    requiresKey: false
  },
  cerebras: {
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    models: [
      { name: "llama-3.3-70b", tags: "Fast, Llama 70B" },
      { name: "llama-3.1-70b", tags: "Fast, Llama 70B" },
      { name: "llama-3.1-8b", tags: "Ultra Fast, Llama 8B" }
    ],
    defaultModel: "llama-3.3-70b",
    requiresKey: true,
    keyPrefix: "csk-"
  },
  mistral: {
    name: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    models: [
      { name: "mistral-large-latest", tags: "Premium, Fast" },
      { name: "mistral-small-latest", tags: "Free, Fast" },
      { name: "codestral-latest", tags: "Premium, Code" },
      { name: "open-mixtral-8x7b", tags: "Free, Mixtral" },
      { name: "open-mistral-nemo", tags: "Free, Fast" }
    ],
    defaultModel: "mistral-small-latest",
    requiresKey: true,
    keyPrefix: ""
  },
  together: {
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    models: [
      { name: "meta-llama/Llama-3.3-70B-Instruct-Turbo", tags: "Free, Llama 70B" },
      { name: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo", tags: "Free, Vision" },
      { name: "mistralai/Mixtral-8x7B-Instruct-v0.1", tags: "Free, Mixtral" },
      { name: "deepseek-ai/DeepSeek-R1", tags: "Free, R1 Reasoning" },
      { name: "Qwen/Qwen2.5-72B-Instruct-Turbo", tags: "Free, Qwen" }
    ],
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    requiresKey: true,
    keyPrefix: ""
  }
};

type ProviderKey = keyof typeof PROVIDERS;

// Provider name mappings
const PROVIDER_ALIASES: Record<string, ProviderKey> = {
  'deepseek': 'deepseek',
  'deepseekr1': 'deepseek',
  'gemini': 'gemini',
  'google': 'gemini',
  'openai': 'openai',
  'gpt': 'openai',
  'groq': 'groq',
  'ollama': 'ollama',
  'local': 'ollama',
  'cerebras': 'cerebras',
  'mistral': 'mistral',
  'together': 'together'
};

// Detect provider from API key format or explicit parameter
function detectProvider(apiKey: string, explicitProvider?: string, explicitBaseUrl?: string): ProviderKey | null {
  // Priority 1: Check explicit provider name
  if (explicitProvider) {
    const normalized = explicitProvider.toLowerCase().replace(/[^a-z]/g, '');
    
    // Direct alias lookup
    if (PROVIDER_ALIASES[normalized]) {
      return PROVIDER_ALIASES[normalized];
    }
    
    // Partial match
    for (const [alias, provider] of Object.entries(PROVIDER_ALIASES)) {
      if (normalized.includes(alias) || alias.includes(normalized)) {
        return provider;
      }
    }
  }
  
  // Priority 2: Check base URL for local/Ollama
  if (explicitBaseUrl?.includes('localhost') || explicitBaseUrl?.includes('127.0.0.1')) {
    return 'ollama';
  }
  
  // Priority 3: Detect from API key format
  if (apiKey) {
    if (apiKey.startsWith('gsk_') || apiKey.startsWith('sk-or-')) return 'groq';
    if (apiKey.startsWith('csk-')) return 'cerebras';
    if (apiKey.startsWith('AIza')) return 'gemini';
    if (apiKey.startsWith('sk-')) return 'openai'; // Could be OpenAI or DeepSeek
  }
  
  // No provider detected
  return null;
}

// Validate API key and fetch models for each provider
async function validateAndFetchModels(
  provider: ProviderKey, 
  apiKey: string,
  baseUrl?: string
): Promise<{ success: boolean; error?: string; models?: any[] }> {
  const config = PROVIDERS[provider];
  const url = baseUrl || config.baseUrl;
  
  try {
    switch (provider) {
      case 'gemini': {
        if (!apiKey) {
          return { success: false, error: "Gemini requires an API key. Get one free at: https://aistudio.google.com/app/apikey" };
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        await model.generateContent("Say OK");
        return { success: true, models: config.models };
      }
      
      case 'ollama': {
        try {
          const response = await fetch(`${url}/models`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });
          if (response.ok) {
            const data = await response.json();
            if (data.models && data.models.length > 0) {
              const ollamaModels = data.models.map((m: any) => ({
                name: m.name,
                tags: 'Local, ' + (m.details?.parameter_size || 'Unknown Size')
              }));
              return { success: true, models: ollamaModels };
            }
          }
        } catch (e) {
          // Ollama not running
        }
        return { success: true, models: config.models };
      }
      
      case 'deepseek':
      case 'openai':
      case 'groq':
      case 'cerebras':
      case 'mistral':
      case 'together': {
        if (config.requiresKey && !apiKey) {
          return { success: false, error: `${config.name} requires an API key.` };
        }
        
        const response = await fetch(`${url}/models`, {
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            return { success: false, error: `Invalid ${config.name} API key. Please check your key and try again.` };
          }
          throw new Error(`${config.name} API error: ${response.status}`);
        }
        return { success: true, models: config.models };
      }
      
      default:
        return { success: false, error: "Unknown provider" };
    }
  } catch (error: any) {
    return { success: false, error: error.message || "Validation failed" };
  }
}

// Generate content using the appropriate provider
async function generateContent(
  provider: ProviderKey,
  apiKey: string,
  model: string,
  prompt: string,
  baseUrl?: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  const config = PROVIDERS[provider];
  const url = baseUrl || config.baseUrl;
  
  try {
    switch (provider) {
      case 'gemini': {
        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({ model: model || config.defaultModel });
        const result = await genModel.generateContent(prompt);
        return { success: true, text: result.response.text() };
      }
      
      case 'ollama': {
        const response = await fetch(`${url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey && apiKey !== 'ollama' ? { 'Authorization': `Bearer ${apiKey}` } : {})
          },
          body: JSON.stringify({
            model: model || config.defaultModel,
            messages: [{ role: 'user', content: prompt }],
            stream: false
          }),
          signal: AbortSignal.timeout(120000)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return { 
            success: false, 
            error: errorData.error?.message || `Ollama error: ${response.status}. Is Ollama running?` 
          };
        }
        
        const data = await response.json();
        return { success: true, text: data.choices[0]?.message?.content || '' };
      }
      
      case 'deepseek':
      case 'openai':
      case 'groq':
      case 'cerebras':
      case 'mistral':
      case 'together': {
        const response = await fetch(`${url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || config.defaultModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 8192
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return { 
            success: false, 
            error: errorData.error?.message || `${config.name} API error: ${response.status}` 
          };
        }
        
        const data = await response.json();
        return { success: true, text: data.choices[0]?.message?.content || '' };
      }
      
      default:
        return { success: false, error: "Unknown provider" };
    }
  } catch (error: any) {
    return { success: false, error: error.message || "Generation failed" };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, action, apiKey: clientApiKey, provider: clientProvider, model: clientModel, baseUrl: clientBaseUrl } = body;

    // Detect or use provided provider
    const detectedProvider = detectProvider(clientApiKey, clientProvider, clientBaseUrl);
    
    // If no provider detected, return helpful error
    if (!detectedProvider) {
      return NextResponse.json({
        error: "Could not detect AI provider. Please:\n" +
               "1. Select a provider from the dropdown, OR\n" +
               "2. Enter a valid API key\n\n" +
               "Free API keys available at:\n" +
               "• Gemini: https://aistudio.google.com/app/apikey\n" +
               "• DeepSeek: https://platform.deepseek.com/api_keys\n" +
               "• Groq: https://console.groq.com/keys"
      }, { status: 400 });
    }
    
    const provider = detectedProvider;
    const config = PROVIDERS[provider];

    // Get API key from environment or client
    const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || 
                   process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || 
                   process.env.GROQ_API_KEY || process.env.CEREBRAS_API_KEY ||
                   process.env.MISTRAL_API_KEY || process.env.TOGETHER_API_KEY || "";
    const apiKey = clientApiKey || envKey;

    if (config.requiresKey && !apiKey) {
      return NextResponse.json({
        error: `No API key configured for ${config.name}!\n\nGet a FREE API key at:\n• Gemini: https://aistudio.google.com/app/apikey\n• DeepSeek: https://platform.deepseek.com/api_keys\n• Groq: https://console.groq.com/keys\n• Mistral: https://console.mistral.ai/`
      }, { status: 500 });
    }

    // --- fetch-models: validate API key and return available models ---
    if (action === "fetch-models") {
      const result = await validateAndFetchModels(provider, apiKey, clientBaseUrl);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          provider: config.name,
          detectedProvider: provider,
          models: result.models,
          requiresKey: config.requiresKey
        });
      } else {
        return NextResponse.json({
          error: result.error || "Validation failed"
        }, { status: 401 });
      }
    }

    // --- List all providers ---
    if (action === "list-providers") {
      return NextResponse.json({
        providers: Object.entries(PROVIDERS).map(([key, cfg]) => ({
          id: key,
          name: cfg.name,
          models: cfg.models,
          defaultModel: cfg.defaultModel,
          requiresKey: cfg.requiresKey,
          keyPrefix: cfg.keyPrefix
        }))
      });
    }

    // --- Regular AI prompt ---
    if (!prompt) {
      return NextResponse.json({
        error: "Invalid request. Provide a prompt for AI optimization."
      }, { status: 400 });
    }

    const result = await generateContent(provider, apiKey, clientModel, prompt, clientBaseUrl);
    
    if (result.success) {
      return NextResponse.json({ text: result.text });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

  } catch (error: any) {
    console.error("AI API Error:", error);
    return NextResponse.json({
      error: error.message || "Failed to generate content"
    }, { status: 500 });
  }
}
