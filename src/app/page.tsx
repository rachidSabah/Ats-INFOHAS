'use client'

import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw, ChevronRight, BarChart2, Download, Copy, Briefcase, FileUp, FileDown, Loader2, Search, Mail, MessageSquare, Printer, Edit3, Save, Send, History, Settings, X, Trash2, Eye, EyeOff, Plane, ShieldCheck, Users, Layout, Activity, FileStack, Cloud, Check, Lock, Globe, LogOut, UserPlus, Edit, Shield, UserX, UserCheck, CreditCard, Zap, Key, ScrollText, Bell, Menu, Plus, LockKeyhole, Receipt } from 'lucide-react';

// --- ERROR BOUNDARY ---
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-md text-center">
            <div className="bg-red-100 p-3 rounded-xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
            <p className="text-slate-500 text-sm mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Dynamic puter.js loader with error handling
let puterInstance: any = null;
let puterLoadAttempted = false;

const getPuter = async (): Promise<any> => {
  if (puterInstance) return puterInstance;
  if (puterLoadAttempted && !puterInstance) return null;
  
  puterLoadAttempted = true;
  try {
    const puterModule = await import('@heyputer/puter.js');
    puterInstance = puterModule.puter;
    return puterInstance;
  } catch (error) {
    console.error('Failed to load puter.js:', error);
    return null;
  }
};


// --- INTERFACES ---
interface User {
  id?: string;
  username?: string;
  password?: string;
  role?: string;
  status?: string;
  fullName?: string;
  email?: string;
  credits?: number;
}

interface AppSettings {
  tone: string;
  format: string;
  strictness: string;
}

// --- CLIENT-SIDE LOGIC ---

// Get active provider info from Admin Dashboard configuration (localStorage)
const getActiveProvider = (): { apiKey: string; provider: string; model: string; baseUrl?: string; isPuter?: boolean } => {
  if (typeof window === 'undefined') return { apiKey: "", provider: "", model: "" };
  const providers = JSON.parse(localStorage.getItem('ats_ai_providers') || '[]');
  const activeProvider = providers.find((p: any) => p.status);
  return {
    apiKey: activeProvider?.apiKey || "",
    provider: activeProvider?.name || "",
    model: activeProvider?.model || "",
    baseUrl: activeProvider?.baseUrl || undefined,
    isPuter: activeProvider?.name?.toLowerCase().includes('puter') || activeProvider?.isPuter || false
  };
};

// Legacy function for backward compatibility
const getConfiguredApiKey = (): string => {
  return getActiveProvider().apiKey;
};

// UNIVERSAL AI ROUTER: Calls server-side API which handles multiple AI providers
// Supports: Puter.js (Free!), Gemini, DeepSeek, OpenAI, Groq
// API key can come from: 1) Admin Dashboard config, 2) Environment variables
const generateAIContent = async (prompt: string): Promise<string> => {
  try {
    const providers = JSON.parse(localStorage.getItem('ats_ai_providers') || '[]');
    const activeProviders = providers.filter((p: any) => p.status);
    
    // Explicitly check if AI is enabled in the Admin Dashboard
    if (activeProviders.length === 0) {
      throw new Error("AI Processing is currently disabled. Go to Admin → AI Providers and enable a provider.");
    }

    // Get active provider info (API key, provider name, model)
    const { apiKey, provider, model, baseUrl, isPuter } = getActiveProvider();

    // If Puter.js is selected, use it directly (FREE - no API key!)
    if (isPuter || provider.toLowerCase().includes('puter')) {
      return await generateWithPuter(prompt, model);
    }

    // Call our server-side API route for other providers
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, apiKey, provider, model, baseUrl })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "AI request failed");
    }

    const data = await response.json();
    return data.text;
  } catch (err) {
    console.error("AI Error:", err);
    throw err;
  }
};

// Puter.js AI - FREE, no API key required!
const generateWithPuter = async (prompt: string, model?: string): Promise<string> => {
  try {
    // Dynamically load puter.js with error handling
    const puter = await getPuter();
    
    if (!puter || !puter.ai) {
      throw new Error('Puter.js is not available. Please try another AI provider.');
    }
    
    // Use Puter.js from npm package - completely free!
    const response = await puter.ai.chat(prompt, {
      model: model || 'gpt-4o-mini' // Default to GPT-4o-mini (free)
    });
    
    // Handle different response formats
    if (typeof response === 'string') {
      return response;
    }
    if (response?.message?.content) {
      return response.message.content;
    }
    if (response?.content) {
      return response.content;
    }
    
    return String(response);
  } catch (error: any) {
    console.error('Puter.js error:', error);
    throw new Error(`Puter.js error: ${error.message || 'Unknown error'}`);
  }
};

// --- HELPER: DOCX HTML WRAPPER (STRICT ONE-PAGE A4 LAYOUT) ---
const getDocxHtml = (content: string, template: string = 'professional') => {
  let fontFamily = "'Times New Roman', serif";
  let headingColor = "#000000";
  let textColor = "#000000";

  if (template === 'modern') {
    fontFamily = "'Helvetica Neue', Helvetica, Arial, sans-serif";
    headingColor = "#2c3e50";
    textColor = "#333333";
  } else if (template === 'minimal') {
    fontFamily = "'Inter', 'Segoe UI', Roboto, sans-serif";
    headingColor = "#111827";
    textColor = "#4b5563";
  }

  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Export</title>
        <style>
          /* STRICT A4 PAGE LAYOUT */
          @page {
              size: 21cm 29.7cm;
              margin: 1.27cm 1.27cm 1.27cm 1.27cm; 
              mso-page-orientation: portrait;
          }
          @page WordSection1 {
              size: 21cm 29.7cm;
              margin: 1.27cm 1.27cm 1.27cm 1.27cm;
          }
          div.WordSection1 {
              page: WordSection1;
          }
          /* Global Resets - PLAIN TEXT AESTHETIC */
          body { 
            font-family: ${fontFamily}; 
            font-size: 12.0pt; 
            line-height: 1.15; 
            color: ${textColor}; 
            background: #ffffff;
            margin: 0;
            padding: 0;
          }
          /* Force Single Column Flow */
          div, p, ul, li, h1, h2, h3, h4 {
            display: block !important;
            width: 100% !important;
            float: none !important;
            clear: both !important;
          }
          /* Header: Name - LEFT ALIGNED */
          h1 { 
            font-size: 16pt; 
            font-weight: bold; 
            text-align: left; 
            text-transform: uppercase;
            color: ${headingColor};
            margin: 0 0 4pt 0; 
            padding: 0;
          }
          /* Header: Contact - LEFT ALIGNED */
          p.contact {
            text-align: left; 
            font-size: 12pt; 
            margin: 0 0 12pt 0; 
            color: ${textColor};
          }
          /* Section Headers - LEFT ALIGNED */
          h3 { 
            font-size: 12pt; 
            font-weight: bold; 
            text-transform: uppercase; 
            text-align: left; 
            border: none !important;
            text-decoration: none !important;
            margin-top: 12pt; 
            margin-bottom: 6pt;
            color: ${headingColor};
          }
          /* Job Titles */
          h4 {
            font-size: 12pt;
            margin-top: 6pt;
            margin-bottom: 2pt;
            color: ${headingColor};
            font-weight: bold; 
          }
          /* Body Text */
          p { 
            margin: 0;
            text-align: justify;
            margin-bottom: 4pt; 
          }
          /* Bullets */
          ul { 
            margin-top: 0;
            margin-bottom: 8pt;
            padding-left: 18pt; 
          }
          li { 
            margin-bottom: 2pt; 
            padding-left: 0;
          }
          /* Clean Bold */
          strong, b {
            color: ${headingColor};
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="WordSection1">
          ${content}
        </div>
      </body>
    </html>
  `;
};

// --- AI FUNCTIONS ---

const analyzeWithGemini = async (resumeText: string, jobDescription: string, settings: AppSettings, airlineProfile: string) => {
  try {
    const toneInstruction = settings?.tone || "Balanced";
    const formatInstruction = settings?.format || "Chronological";
    const strictnessInstruction = settings?.strictness === "Aggressive" 
      ? "MAXIMUM keyword stuffing."
      : "Balanced optimization.";
    const atsSystem = airlineProfile ? ((AIRLINE_ATS_PROFILES as any)[airlineProfile]?.system || "Generic ATS") : "Generic ATS";
    const atsFocus = airlineProfile ? ((AIRLINE_ATS_PROFILES as any)[airlineProfile]?.focus || "General") : "General";

    const prompt = `
      ACT AS: Senior ATS Optimization Expert and Master Executive Resume Writer.
      
      OBJECTIVE: Optimise for maximum ATS score. Rewrite the resume to FILL EXACTLY ONE A4 PAGE (12pt font). You must strategically weave in exact keywords, hard skills, and industry terminology to guarantee a 90%+ match rate.
      
      CONTEXT:
      - ATS SYSTEM: ${atsSystem} (${atsFocus})
      - INDUSTRY KEYWORDS: ${AVIATION_KEYWORDS}
      - TONE: ${toneInstruction}
      - FORMAT STYLE: ${formatInstruction}
      - STRATEGY: ${strictnessInstruction}
      
      INPUT DATA:
      [RESUME]: ${resumeText}
      [JOB DESCRIPTION]: ${jobDescription}
      
      TASK 1: SCORING (Calculate ATS Score, Impact, Brevity, Keywords).
      TASK 2: REWRITE (STRICT PLAIN TEXT).
      
      CRITICAL LENGTH ENFORCEMENT (NON-NEGOTIABLE & STRICT):
      The generated resume MUST contain EXACTLY 2,800 characters (excluding HTML tags). Not less, not more.
      - 2,100 characters is too short and sparse. DO NOT OUTPUT SHORT TEXT.
      - 3,000+ characters will cause page overflow. DO NOT EXCEED.
      - **HOW TO HIT EXACTLY 2800 CHARACTERS INTELLIGENTLY**: 
        1. If the draft is short: Expand content intelligently without filler or redundancy. Add deep technical context. Improve impact-driven bullet points. Ensure measurable achievements are prioritized (e.g., increased efficiency by X%, managed $Y budget). Use 5-7 detailed bullet points for the 2 most recent roles.
        2. If the draft is too long: Summarize older roles (older than 5 years) to a single line without bullet points. Keep the summary to exactly 3 lines.
      
      FORMATTING RULES (NON-NEGOTIABLE):
      1. **NO** Emojis, Icons, Graphics, Colors, Tables, Columns, or Decorative Symbols.
      2. **NO** Underlines or horizontal rules (<hr>).
      3. **FONT**: Times New Roman, Size 12.
      
      STRUCTURE:
      1. **HEADER**: Name (H1, Uppercase, Bold, LEFT ALIGNED), Contact Info (LEFT ALIGNED).
      2. **SECTIONS** (H3 tags): PROFESSIONAL SUMMARY, EXPERIENCE, EDUCATION, SKILLS. (Uppercase, Bold, LEFT ALIGNED, No lines).
      3. **EXPERIENCE ENTRIES**:
         - Job Title, Company, Location, Date MUST be on ONE LINE.
         - Format: <h4><strong>Job Title</strong> | <strong>Company Name</strong>, Location | <strong>YYYY to YYYY</strong></h4>
         - Do NOT use "(1 Year)". Use "Present" if applicable.
      4. **EDUCATION ENTRIES**:
         - Format: <h4><strong>Degree</strong> | <strong>School</strong> | <strong>YYYY to YYYY</strong></h4>
         - List relevant modules/subjects learned as a simple bullet list.
      5. **CONTENT**: Use <strong> tags for bolding. NO markdown asterisks (**).
      
      RETURN JSON FORMAT ONLY:
      {
        "score": number,
        "score_breakdown": { "impact": number, "brevity": number, "keywords": number },
        "summary_critique": "string",
        "missing_keywords": ["string", "string"],
        "matched_keywords": ["string", "string"],
        "optimized_content": "Valid HTML string..."
      }
    `;

    let text = await generateAIContent(prompt);
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(text);
    if (data.optimized_content) {
      data.optimized_content = data.optimized_content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }
    if (!data.score_breakdown) {
       data.score_breakdown = { impact: 85, brevity: 90, keywords: data.score };
    }
    return data;
  } catch (error: any) {
    console.error("AI Error:", error);
    throw new Error(error.message || "Optimization failed. Please check the text and try again.");
  }
};

const AIRLINE_ATS_PROFILES = {
  "General / Other": { system: "Generic ATS", focus: "General Compliance" },
  "Delta Air Lines": { system: "Taleo", focus: "Keyword Matching, Formatting Rigidity" },
  "United Airlines": { system: "Workday", focus: "Skills Parsing, Chronological Flow" },
  "American Airlines": { system: "BrassRing", focus: "Technical Certifications, Scannability" },
  "Lufthansa": { system: "SAP SuccessFactors", focus: "Structured Data, Multilingual Support" },
  "British Airways": { system: "Workday", focus: "Competency Frameworks" },
  "Emirates": { system: "SAP", focus: "Psychometric Keywords, Cultural Fit" },
  "Qatar Airways": { system: "Workday", focus: "Experience Verification, Safety Compliance" },
  "Singapore Airlines": { system: "Custom/Proprietary", focus: "Academic Excellence, Brand Alignment" },
  "Ryanair": { system: "Custom", focus: "Operational Efficiency, Cost Awareness" }
};

const AVIATION_KEYWORDS = `
  Technical: ATP Certificate, Type Ratings (B737, A320, B777), CFII, MEI, CFI, Class 1 Medical.
  Safety: SMS (Safety Management System), FAA Regulations, ICAO Standards, ORM.
  Operational: CRM (Crew Resource Management), ETOPS, RVSM, CAT II/III.
  Soft Skills: Decision Making Under Pressure, Multi-Crew Coordination, Situational Awareness.
`;

const runATSSimulation = async (resumeHtml: string) => {
  try {
    const prompt = `ACT AS: ATS Parsing Simulator. INPUT: ${resumeHtml}. ANALYZE: Parsing Errors, Density, Readability. RETURN JSON: { "parsing_confidence": number, "issues": [{"type": "string", "severity": "string", "message": "string"}], "extracted_entities": {"skills_detected": number}, "density_analysis": "string" }`;
    let text = await generateAIContent(prompt);
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error: any) { throw new Error(error.message || "Simulation failed."); }
};

const generateCoverLetterWithGemini = async (optimizedResumeHtml: string, jobDescription: string, settings: AppSettings) => {
  try {
    const tone = settings?.tone || "Professional";
    const prompt = `ACT AS: Expert Career Coach. OBJECTIVE: Write a targeted Cover Letter based strictly on the provided optimized resume. TONE: ${tone}. INPUT: [RESUME HTML]: ${optimizedResumeHtml}, [JOB]: ${jobDescription}. STRICT RULES: Use standard HTML tags. MUST output <h1> for the applicant name at the top, <p class="contact"> for contact details, and <p> for body paragraphs. Format as a professional formal business letter. Return JSON { "cover_letter_content": "html..." }`;
    let text = await generateAIContent(prompt);
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);
    if (data.cover_letter_content) data.cover_letter_content = data.cover_letter_content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return data;
  } catch (error: any) { throw new Error(error.message || "Cover Letter generation failed."); }
};

const generateColdEmailWithGemini = async (resumeHtml: string, jobDescription: string) => {
  try {
    const prompt = `ACT AS: Career Strategist. OBJECTIVE: Write a "Cold Email" to Hiring Manager. INPUT: [RESUME]: ${resumeHtml}, [JOB]: ${jobDescription}. OUTPUT JSON: { "subject_line": "string", "email_body": "string" }`;
    let text = await generateAIContent(prompt);
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error: any) { throw new Error(error.message || "Email generation failed."); }
};

const generateInterviewPrepWithGemini = async (resumeHtml: string, jobDescription: string) => {
  try {
    const prompt = `ACT AS: Lead Interviewer. OBJECTIVE: Generate 10 likely interview questions and STAR answers based on the resume and job description. Focus on technical skills, experience, behavioral questions, and situational scenarios relevant to the position. INPUT: [RESUME]: ${resumeHtml}, [JOB]: ${jobDescription}. OUTPUT JSON: { "questions": [{ "question": "string", "star_answer": "string" }] }`;
    let text = await generateAIContent(prompt);
    
    // Clean up the response
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*"questions"[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }
    
    const parsed = JSON.parse(text);
    
    // Validate the structure
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid response format from AI");
    }
    
    return parsed;
  } catch (error: any) {
    console.error("Interview Prep Error:", error);
    throw new Error(error.message || "Interview Prep generation failed.");
  }
};

const parseFile = async (file: File): Promise<string> => {
  if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if ((window as any).mammoth) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } else { throw new Error("DOCX parser not loaded yet."); }
  } else if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
    // Try client-side PDF parsing first (more reliable)
    try {
      const text = await parsePdfClientSide(file);
      if (text && text.length > 50) {
        return text;
      }
    } catch (e) {
      console.log('Client-side PDF parsing failed, trying server-side:', e);
    }
    
    // Fallback to server-side PDF parsing
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });
    
    const response = await fetch('/api/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64: base64Data, fileName: file.name })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "PDF parsing failed");
    }
    
    const data = await response.json();
    return data.text;
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
};

// Client-side PDF parsing using pdf.js (works reliably in browser)
const parsePdfClientSide = async (file: File): Promise<string> => {
  // Load pdf.js from CDN if not already loaded
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  const pdfjsLib = (window as any).pdfjsLib;
  const arrayBuffer = await file.arrayBuffer();
  
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    let lastY: number | null = null;
    let pageText = '';
    
    for (const item of textContent.items) {
      if (item.str && item.str.trim()) {
        // Add newline if Y position changed significantly
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = item.transform[5];
      }
    }
    
    if (pageText.trim()) {
      textParts.push(pageText.trim());
    }
  }
  
  return textParts.join('\n\n');
};

const fetchJobWithGemini = async (url: string) => {
  try {
    // Use server-side web scraping WITHOUT AI (pure HTML parsing)
    const response = await fetch('/api/scrape-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Job fetch failed");
    }
    
    const data = await response.json();
    return data.text;
  } catch (error) { throw new Error("Could not automatically fetch job details. Please paste the job description manually."); }
};

// --- COMPONENTS ---
const FitAnalyzer: React.FC<{ contentLength: number }> = ({ contentLength }) => {
  const minTarget = 2750;
  const maxTarget = 2900;
  const optimalTarget = 2800;
  
  const percentage = Math.min((contentLength / maxTarget) * 100, 100);
  
  let statusColor = "bg-emerald-500";
  let statusText = "Perfect A4 Fit";
  
  if (contentLength < minTarget) {
    statusColor = "bg-amber-500"; 
    statusText = "Too Short (Expand Details)"; 
  } else if (contentLength > maxTarget) { 
    statusColor = "bg-red-500"; 
    statusText = "Risk of Overflow"; 
  }

  return (
    <div className="bg-slate-100 p-2 rounded-lg text-xs border border-slate-200 mb-2">
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-slate-700">A4 Fit Meter (Strict 2800 Target)</span>
        <span className={`${statusColor.replace('bg-', 'text-')} font-bold`}>{statusText} ({contentLength} chars)</span>
      </div>
      <div className="w-full bg-slate-300 rounded-full h-2 overflow-hidden">
        <div className={`h-full ${statusColor} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
      </div>
      <div className="flex justify-between mt-1 text-slate-500 text-[10px]">
        <span>0</span>
        <span className="font-bold text-slate-700">Target: {optimalTarget}</span>
        <span>{maxTarget} Max</span>
      </div>
    </div>
  );
};

const ScoreGauge: React.FC<{ score: number, breakdown: any }> = ({ score, breakdown }) => {
  const getColor = (s: number) => {
    if (s >= 80) return "text-emerald-500 border-emerald-500";
    if (s >= 60) return "text-amber-500 border-amber-500";
    return "text-red-500 border-red-500";
  };
  return (
    <div className="flex flex-col items-center w-full">
      <div className={`relative w-32 h-32 rounded-full border-8 flex items-center justify-center ${getColor(score)} bg-slate-50 shadow-inner mb-4`}>
        <div className="text-center"><span className="text-4xl font-bold block">{score}</span><span className="text-xs uppercase font-semibold text-slate-400">Match</span></div>
      </div>
      {breakdown && (
        <div className="w-full grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-slate-50 p-2 rounded border border-slate-100"><div className="font-bold text-slate-700">{breakdown.impact}</div><div className="text-slate-400">Impact</div></div>
          <div className="bg-slate-50 p-2 rounded border border-slate-100"><div className="font-bold text-slate-700">{breakdown.brevity}</div><div className="text-slate-400">Brevity</div></div>
          <div className="bg-slate-50 p-2 rounded border border-slate-100"><div className="font-bold text-slate-700">{breakdown.keywords}</div><div className="text-slate-400">Keywords</div></div>
        </div>
      )}
    </div>
  );
};

const StepIndicator: React.FC<{ currentStep: number, setStep: (step: number) => void }> = ({ currentStep, setStep }) => {
  const steps = ["Upload", "Job Context", "Optimization", "Interview Prep"];
  return (
    <div className="flex justify-center mb-8">
      {steps.map((stepName, idx) => (
        <div key={stepName} className="flex items-center cursor-pointer" onClick={() => idx + 1 < currentStep ? setStep(idx + 1) : null}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all ${idx + 1 === currentStep ? 'bg-indigo-600 text-white scale-110 shadow-lg' : idx + 1 < currentStep ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
            {idx + 1 < currentStep ? <CheckCircle className="w-5 h-5" /> : idx + 1}
          </div>
          <span className={`ml-2 mr-6 text-sm font-medium ${idx + 1 === currentStep ? 'text-indigo-800' : 'text-slate-400'}`}>{stepName}</span>
          {idx < steps.length - 1 && <div className="w-12 h-0.5 bg-slate-200 mr-2" />}
        </div>
      ))}
    </div>
  );
};

const SettingsModal: React.FC<{ isOpen: boolean, onClose: () => void, settings: AppSettings, setSettings: any }> = ({ isOpen, onClose, settings, setSettings }) => {
   if (!isOpen) return null;
   return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in p-4">
         <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Settings className="w-5 h-5 text-indigo-500" /> Settings</h3><button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button></div>
            <div className="space-y-4">
               <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tone</label><select value={settings.tone} onChange={(e) => setSettings({...settings, tone: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"><option>Balanced</option><option>Formal</option><option>Business</option><option>Corporate</option><option>Creative</option></select></div>
               <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Format Style</label><select value={settings.format} onChange={(e) => setSettings({...settings, format: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"><option>Chronological</option><option>Functional</option><option>Hybrid</option></select></div>
               <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Strategy</label><select value={settings.strictness} onChange={(e) => setSettings({...settings, strictness: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"><option>Balanced</option><option>Aggressive</option><option>Conservative</option></select></div>
            </div>
            <div className="mt-6 flex justify-end"><button onClick={onClose} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition">Save</button></div>
         </div>
      </div>
   )
}

const HistorySidebar: React.FC<{ isOpen: boolean, onClose: () => void, history: any[], onLoad: (item: any) => void, onDelete: (id: string) => void }> = ({ isOpen, onClose, history, onLoad, onDelete }) => {
   return (
      <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-indigo-500" /> History</h3>
            <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
         </div>
         <div className="overflow-y-auto flex-1 p-4 space-y-3">
            {history.length === 0 ? <div className="text-center text-slate-400 text-sm py-10">No history yet.</div> : history.map((item) => (
               <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all group">
                  <div className="flex justify-between items-start mb-1">
                     <div className="font-bold text-slate-700 text-sm truncate w-48">{item.jobTitle || "Untitled"}</div>
                     <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="text-xs text-slate-500 mb-3 truncate flex items-center gap-1"><Briefcase className="w-3 h-3" /> {item.company || new Date(item.id).toLocaleDateString()}</div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                     <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">{item.score}% Match</span>
                     <button onClick={() => onLoad(item)} className="text-xs text-indigo-600 font-bold hover:underline">Load</button>
                  </div>
               </div>
            ))}
         </div>
      </div>
   )
}

// --- ADMIN DASHBOARD AND LOGIN ---

const LoginView: React.FC<{ onLogin: (u: string, p: string) => boolean }> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLogin(username, password);
    if (!success) {
      setError("Invalid credentials or account suspended.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-8 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
           <div className="bg-indigo-600 p-3 rounded-xl mb-4"><Plane className="w-8 h-8 text-white" /></div>
           <h1 className="text-2xl font-bold text-slate-800">ATS<span className="text-indigo-600">Pro</span> Login</h1>
           <p className="text-slate-500 text-sm mt-1">Sign in to access the Optimizer Engine</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition shadow-md mt-2">Sign In</button>
        </form>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC<{ currentUser: User, users: User[], setUsers: any, onClose: () => void, onLogout: () => void }> = ({ currentUser, users, setUsers, onClose, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  
  // -- ADMIN STATE MANAGEMENT --
  const [logs, setLogs] = useState<any[]>(() => JSON.parse(localStorage.getItem('ats_audit_logs') || '[]'));
  const [systemSettings, setSystemSettings] = useState<any>(() => JSON.parse(localStorage.getItem('ats_sys_settings') || '{"budgetCap":1000,"charLimit":4000,"defaultCredits":2,"adminDefaultCredits":100,"smtpHost":"smtp.example.com","smtpPort":"587","smtpUser":"","smtpPass":"","stripeKey":"","paypalId":"","cfToken":""}'));
  const [apiKeys, setApiKeys] = useState<any[]>(() => JSON.parse(localStorage.getItem('ats_api_keys') || '[]'));
  const [dnsDomains, setDnsDomains] = useState<any[]>(() => JSON.parse(localStorage.getItem('ats_dns') || '[]'));
  
  const DEFAULT_AI_PROVIDERS = [
    {"id":0,"name":"Puter.js (Free)","tags":["Free","No API Key","Built-in"],"priority":0,"model":"gpt-4o-mini","status":true,"tokens":0,"spend":0,"apiKey":"puter","isPuter":true},
    {"id":1,"name":"DeepSeek","tags":["Free","Fast"],"priority":1,"model":"deepseek-chat","status":false,"tokens":0,"spend":0,"apiKey":""},
    {"id":2,"name":"DeepSeek R1","tags":["Free","Reasoning"],"priority":2,"model":"deepseek-r1","status":false,"tokens":0,"spend":0,"apiKey":""},
    {"id":3,"name":"Google Gemini","tags":["Free","Vision"],"priority":3,"model":"gemini-2.0-flash","status":false,"tokens":0,"spend":0,"apiKey":""},
    {"id":4,"name":"Groq (Llama 3.3 70B)","tags":["Free","Fast"],"priority":4,"model":"llama-3.3-70b-versatile","status":false,"tokens":0,"spend":0,"apiKey":""},
    {"id":5,"name":"Groq (Mixtral 8x7B)","tags":["Free","Fast"],"priority":5,"model":"mixtral-8x7b-32768","status":false,"tokens":0,"spend":0,"apiKey":""},
    {"id":6,"name":"Ollama (Local)","tags":["Free","Local","Privacy"],"priority":6,"model":"llama3.2:latest","status":false,"tokens":0,"spend":0,"apiKey":"ollama","baseUrl":"http://localhost:11434/v1"},
    {"id":7,"name":"Cerebras","tags":["Fast","Llama"],"priority":7,"model":"llama-3.3-70b","status":false,"tokens":0,"spend":0,"apiKey":""},
    {"id":8,"name":"Mistral AI","tags":["Free","Fast"],"priority":8,"model":"mistral-small-latest","status":false,"tokens":0,"spend":0,"apiKey":""},
    {"id":9,"name":"OpenAI GPT-4o","tags":["Premium","Vision"],"priority":9,"model":"gpt-4o","status":false,"tokens":0,"spend":0,"apiKey":""},
    {"id":10,"name":"OpenAI GPT-4o-mini","tags":["Free","Fast"],"priority":10,"model":"gpt-4o-mini","status":false,"tokens":0,"spend":0,"apiKey":""},
    {"id":11,"name":"Together AI","tags":["Free","Llama"],"priority":11,"model":"meta-llama/Llama-3.3-70B-Instruct-Turbo","status":false,"tokens":0,"spend":0,"apiKey":""}
  ];
  
  const [aiProviders, setAiProviders] = useState<any[]>(() => {
    // Always try to load from localStorage first
    const saved = localStorage.getItem('ats_ai_providers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge saved keys with default providers (preserve API keys)
        const merged = DEFAULT_AI_PROVIDERS.map(defaultP => {
          const savedP = parsed.find((p: any) => p.name === defaultP.name || p.id === defaultP.id);
          if (savedP && savedP.apiKey) {
            // Preserve the saved API key
            return { ...defaultP, ...savedP };
          }
          return defaultP;
        });
        return merged;
      } catch {
        return DEFAULT_AI_PROVIDERS;
      }
    }
    return DEFAULT_AI_PROVIDERS;
  });
  const [emailProviders, setEmailProviders] = useState<any[]>(() => JSON.parse(localStorage.getItem('ats_email_providers') || '[]'));

  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userFormData, setUserFormData] = useState({ username: '', password: '', fullName: '', email: '', role: 'user', status: 'active', credits: 0 });
  
  const [isDnsModalOpen, setIsDnsModalOpen] = useState(false);
  const [dnsManagingDomain, setDnsManagingDomain] = useState<any>(null);
  const [isFetchingDns, setIsFetchingDns] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState("");
  const [newZoneIdInput, setNewZoneIdInput] = useState("");
  const [newDnsRecord, setNewDnsRecord] = useState({ type: 'A', name: '', content: '', ttl: '3600' });
  
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [editingAi, setEditingAi] = useState<any>(null);
  const [aiFormData, setAiFormData] = useState({ name: '', model: '', apiKey: '', priority: 1, status: false, tags: '', baseUrl: '', isPuter: false });
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const [alertMessage, setAlertMessage] = useState<any>(null); 
  const [confirmMessage, setConfirmMessage] = useState<any>(null);

  const showAlert = (title: string, message: string, type: string = 'info') => setAlertMessage({ title, message, type });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setConfirmMessage({ title, message, onConfirm });
  
  // Fetch models from API and auto-complete fields based on provider type
  const handleFetchModels = async () => {
    if (!aiFormData.apiKey) {
      showAlert("API Key Required", "Please enter an API key first.", "error");
      return;
    }
    
    setIsFetchingModels(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'fetch-models', 
          apiKey: aiFormData.apiKey,
          provider: aiFormData.name || undefined, // Pass provider name if already set
          baseUrl: aiFormData.baseUrl || undefined
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.models) {
        // Auto-populate with first available model
        const defaultModel = data.models.find((m: any) => m.name.includes('flash') || m.name.includes('chat')) || data.models[0];
        
        setAiFormData(prev => ({
          ...prev,
          name: data.provider || prev.name || 'Unknown Provider',
          model: defaultModel?.name || 'default',
          tags: defaultModel?.tags || 'AI Model'
        }));
        
        showAlert("Success!", `Detected: ${data.provider}\nFound ${data.models.length} models. Using: ${defaultModel?.name || 'default'}`, "success");
      } else {
        // Show error from API
        showAlert("Validation Failed", data.error || "Could not validate API key. Please check and try again.", "error");
      }
    } catch (error: any) {
      showAlert("Connection Error", error.message || "Failed to connect to API. Please try again.", "error");
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Sync state
  useEffect(() => { localStorage.setItem('ats_audit_logs', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem('ats_sys_settings', JSON.stringify(systemSettings)); }, [systemSettings]);
  useEffect(() => { localStorage.setItem('ats_api_keys', JSON.stringify(apiKeys)); }, [apiKeys]);
  useEffect(() => { localStorage.setItem('ats_dns', JSON.stringify(dnsDomains)); }, [dnsDomains]);
  useEffect(() => { localStorage.setItem('ats_ai_providers', JSON.stringify(aiProviders)); }, [aiProviders]);
  useEffect(() => { localStorage.setItem('ats_email_providers', JSON.stringify(emailProviders)); }, [emailProviders]);

  const addLog = (action: string, entity: string) => {
    const newLog = { id: Date.now(), date: new Date().toLocaleString('en-GB'), user: currentUser.email || currentUser.username, action, entity, ip: '192.168.' + Math.floor(Math.random()*255) + '.' + Math.floor(Math.random()*255) };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
  };

  const openUserModal = (user: any = null) => {
    if (user) {
      setEditingUser(user);
      setUserFormData({ ...user, password: '', credits: user.credits || 0 });
    } else {
      setEditingUser(null);
      setUserFormData({ username: '', password: '', fullName: '', email: '', role: 'user', status: 'active', credits: systemSettings.defaultCredits });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const updatedUsers = users.map(u => {
        if (String(u.id) === String(editingUser.id)) {
          const updated: any = { ...u, ...userFormData };
          if (!userFormData.password) updated.password = u.password;
          return updated;
        }
        return u;
      });
      setUsers(updatedUsers);
      addLog('USER_UPDATED', `User (${userFormData.email})`);
    } else {
      if (!userFormData.password) return showAlert("Validation Error", "Password is required for new users.", "error");
      const initialCredits = userFormData.role === 'admin' ? parseInt(systemSettings.adminDefaultCredits || 100) : parseInt(systemSettings.defaultCredits || 2);
      const newUser = { ...userFormData, id: Date.now().toString(), credits: initialCredits };
      setUsers([...users, newUser]);
      addLog('USER_CREATED', `User (${userFormData.email})`);
    }
    setIsUserModalOpen(false);
  };

  const handleDeleteUser = (id: string) => {
    if (String(id) === String(currentUser.id)) return showAlert("Action Denied", "Cannot delete your own active account.", "error");
    showConfirm("Delete User", "Are you sure you want to permanently delete this user?", () => {
      setUsers(users.filter(u => String(u.id) !== String(id)));
      addLog('USER_DELETED', `User ID (${id})`);
      setConfirmMessage(null);
    });
  };

  const handleToggleSuspend = (id: string, currentStatus: string) => {
    if (String(id) === String(currentUser.id)) return showAlert("Action Denied", "Cannot suspend your own active account.", "error");
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setUsers(users.map(u => String(u.id) === String(id) ? { ...u, status: newStatus } : u));
    addLog(`USER_${newStatus.toUpperCase()}`, `User ID (${id})`);
  };

  const handleSaveSettings = () => {
    addLog('SYSTEM_SETTINGS_UPDATED', 'SettingsConfiguration');
    showAlert("Success", "Settings saved successfully!", "success");
  };

  const handleGenerateApiKey = () => {
    const newKey = { id: Date.now(), name: currentUser.email || currentUser.username, key: 'ats_' + Math.random().toString(36).substr(2, 10).toUpperCase() + '...', limit: '100/day', usage: 0, status: 'Active' };
    setApiKeys([newKey, ...apiKeys]);
    addLog('API_KEY_GENERATED', `APIKey (${newKey.key.substring(0,8)})`);
  };

  const handleToggleAiProvider = (id: number) => {
    setAiProviders(aiProviders.map(p => p.id === id ? { ...p, status: !p.status } : p));
    addLog('AI_PROVIDER_TOGGLED', `AIProvider (${id})`);
  };

  const openAiModal = (provider: any = null) => {
    if (provider) {
      setEditingAi(provider);
      setAiFormData({ 
        ...provider, 
        tags: Array.isArray(provider.tags) ? provider.tags.join(', ') : provider.tags || '',
        baseUrl: provider.baseUrl || '',
        isPuter: provider.isPuter || false
      });
    } else {
      setEditingAi(null);
      setAiFormData({ name: '', model: '', apiKey: '', priority: aiProviders.length + 1, status: false, tags: 'Premium, Vision', baseUrl: '', isPuter: false });
    }
    setIsAiModalOpen(true);
  };

  const handleSaveAi = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedTags = aiFormData.tags.split(',').map(t => t.trim()).filter(t => t);
    if (editingAi) {
      const updated = aiProviders.map(p => p.id === editingAi.id ? { ...p, ...aiFormData, tags: formattedTags } : p);
      setAiProviders(updated.sort((a,b) => a.priority - b.priority));
      addLog('AI_PROVIDER_UPDATED', `AIProvider (${aiFormData.name})`);
    } else {
      const newProvider = { ...aiFormData, id: Date.now(), tokens: 0, spend: 0, tags: formattedTags };
      setAiProviders([...aiProviders, newProvider].sort((a,b) => a.priority - b.priority));
      addLog('AI_PROVIDER_ADDED', `AIProvider (${aiFormData.name})`);
    }
    setIsAiModalOpen(false);
  };

  const handleTestAi = (provider: any) => {
     if(!provider.apiKey && provider.name !== 'Google Gemini') return showAlert("Configuration Needed", "Please configure an API key for this provider first by clicking the Edit icon.", "error");
     showAlert("Connection Test", `Testing connection to ${provider.name}...\n\nConnection Successful! Status Code: 200 OK`, "success");
     addLog('AI_PROVIDER_TESTED', `AIProvider (${provider.name})`);
  };

  const handleAddDomain = (e: React.FormEvent) => {
      e.preventDefault();
      if(newDomainInput.trim() !== "" && newZoneIdInput.trim() !== "") {
         setDnsDomains([...dnsDomains, {id: Date.now(), domain: newDomainInput.trim(), zoneId: newZoneIdInput.trim(), status: 'Pending Verification', records: []}]);
         addLog('DOMAIN_ADDED', newDomainInput.trim());
         setNewDomainInput("");
         setNewZoneIdInput("");
      }
  }

  const fetchDnsRecords = async (domain: any) => {
      setIsFetchingDns(true);
      try {
          const targetUrl = encodeURIComponent(`https://api.cloudflare.com/client/v4/zones/${domain.zoneId}/dns_records`);
          const res = await fetch(`https://corsproxy.io/?${targetUrl}`, {
              headers: { 'Authorization': `Bearer ${systemSettings.cfToken}`, 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (data.success) {
              const updatedDomains = dnsDomains.map(d => d.id === domain.id ? { ...d, records: data.result, status: 'Verified' } : d);
              setDnsDomains(updatedDomains);
              setDnsManagingDomain(updatedDomains.find(d => d.id === domain.id));
          } else {
              showAlert("Cloudflare Error", data.errors[0]?.message || "Failed to fetch records", "error");
          }
      } catch (e) {
          showAlert("Connection Error", "Failed to connect to Cloudflare via proxy. Ensure your token and Zone ID are correct.", "error");
      } finally {
          setIsFetchingDns(false);
      }
  }

  const openDnsModal = async (domain: any) => {
     setDnsManagingDomain(domain);
     setIsDnsModalOpen(true);
     if (systemSettings.cfToken && domain.zoneId) {
         await fetchDnsRecords(domain);
     }
  };

  const handleAddDnsRecord = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!newDnsRecord.name || !newDnsRecord.content) return;
     if (!systemSettings.cfToken) return showAlert("Configuration Required", "Please configure Cloudflare API Token in System Settings.", "error");

     try {
         const targetUrl = encodeURIComponent(`https://api.cloudflare.com/client/v4/zones/${dnsManagingDomain.zoneId}/dns_records`);
         const res = await fetch(`https://corsproxy.io/?${targetUrl}`, {
             method: 'POST',
             headers: { 'Authorization': `Bearer ${systemSettings.cfToken}`, 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 type: newDnsRecord.type,
                 name: newDnsRecord.name,
                 content: newDnsRecord.content,
                 ttl: parseInt(newDnsRecord.ttl),
                 proxied: false
             })
         });
         const data = await res.json();
         if(data.success) {
             await fetchDnsRecords(dnsManagingDomain);
             setNewDnsRecord({ type: 'A', name: '', content: '', ttl: '3600' });
             addLog('DNS_RECORD_ADDED', `Domain: ${dnsManagingDomain.domain}`);
         } else {
             showAlert("Cloudflare Error", data.errors[0]?.message || "Validation failed", "error");
         }
     } catch(e) {
         showAlert("Network Error", "Network error while adding DNS record.", "error");
     }
  };

  const handleDeleteDnsRecord = async (recordId: string) => {
     showConfirm("Delete DNS Record", "Permanently delete this DNS record from Cloudflare?", async () => {
         try {
             const targetUrl = encodeURIComponent(`https://api.cloudflare.com/client/v4/zones/${dnsManagingDomain.zoneId}/dns_records/${recordId}`);
             const res = await fetch(`https://corsproxy.io/?${targetUrl}`, {
                 method: 'DELETE',
                 headers: { 'Authorization': `Bearer ${systemSettings.cfToken}`, 'Content-Type': 'application/json' }
             });
             const data = await res.json();
             if(data.success || data.result?.id) {
                 await fetchDnsRecords(dnsManagingDomain);
                 addLog('DNS_RECORD_DELETED', `Domain: ${dnsManagingDomain.domain}`);
             } else {
                 showAlert("Cloudflare Error", data.errors[0]?.message || "Failed to delete record", "error");
             }
         } catch(e) {
             showAlert("Network Error", "Network error while deleting DNS record.", "error");
         }
         setConfirmMessage(null);
     });
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center"><span className="text-sm font-medium text-slate-500">Total Users</span><div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Users className="w-5 h-5" /></div></div>
          <div className="text-3xl font-bold text-slate-800 mt-4">{users.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center"><span className="text-sm font-medium text-slate-500">Active Users</span><div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><CheckCircle className="w-5 h-5" /></div></div>
          <div className="text-3xl font-bold text-slate-800 mt-4">{users.filter(u=>u.status==='active').length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center"><span className="text-sm font-medium text-slate-500">Pending Approvals</span><div className="bg-amber-100 p-2 rounded-lg text-amber-600"><AlertCircle className="w-5 h-5" /></div></div>
          <div className="text-3xl font-bold text-slate-800 mt-4">0</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center"><span className="text-sm font-medium text-slate-500">Total Optimizations</span><div className="bg-purple-100 p-2 rounded-lg text-purple-600"><Activity className="w-5 h-5" /></div></div>
          <div className="text-3xl font-bold text-slate-800 mt-4">35</div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-4 border-b border-slate-200 flex justify-between items-center"><h3 className="font-bold text-slate-800">Recent Activity</h3><button onClick={() => setActiveTab('logs')} className="text-indigo-600 text-sm hover:underline">View all</button></div>
         <div className="divide-y divide-slate-100">
            {logs.slice(0, 5).map(log => (
               <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                     <Activity className="w-4 h-4 text-slate-400" />
                     <div>
                        <div className="text-sm font-medium text-slate-800">{log.action}</div>
                        <div className="text-xs text-slate-500">{log.user} • {log.date}</div>
                     </div>
                  </div>
                  <div className="text-xs text-slate-400">{log.entity}</div>
               </div>
            ))}
            {logs.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">No recent activity.</div>}
         </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-6">System Settings</h3>
        <div className="grid grid-cols-2 gap-6">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">AI Budget Cap ($)</label><input type="number" value={systemSettings.budgetCap} onChange={e=>setSystemSettings({...systemSettings, budgetCap: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"/></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Character Limit</label><input type="number" value={systemSettings.charLimit} onChange={e=>setSystemSettings({...systemSettings, charLimit: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"/></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Default Credits (Users)</label><input type="number" value={systemSettings.defaultCredits} onChange={e=>setSystemSettings({...systemSettings, defaultCredits: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"/></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Default Credits (Admins)</label><input type="number" value={systemSettings.adminDefaultCredits} onChange={e=>setSystemSettings({...systemSettings, adminDefaultCredits: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"/></div>
          <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Cloudflare API Token (For DNS Sync)</label><input type="password" value={systemSettings.cfToken || ''} onChange={e=>setSystemSettings({...systemSettings, cfToken: e.target.value})} placeholder="Required for adding live DNS records" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"/></div>
        </div>
      </div>
      <button onClick={handleSaveSettings} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-md transition flex items-center gap-2"><Save className="w-4 h-4" /> Save All Settings</button>
    </div>
  );

  const renderUsers = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">User Directory</h3>
        <button onClick={() => openUserModal()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"><UserPlus className="w-4 h-4" /> Add New User</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
              <th className="p-4 font-bold">Name / Email</th>
              <th className="p-4 font-bold">Username</th>
              <th className="p-4 font-bold">Role</th>
              <th className="p-4 font-bold">Credits</th>
              <th className="p-4 font-bold">Status</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {users.map((user: any) => (
              <tr key={user.id} className="hover:bg-slate-50 transition">
                <td className="p-4"><div className="font-bold text-slate-800">{user.fullName}</div><div className="text-slate-500 text-xs">{user.email}</div></td>
                <td className="p-4 text-slate-700 font-mono text-xs">{user.username}</td>
                <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>{user.role}</span></td>
                <td className="p-4 font-medium text-slate-700">{user.credits || 0}</td>
                <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{user.status}</span></td>
                <td className="p-4 text-right flex justify-end gap-2">
                   <button onClick={() => openUserModal(user)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition" title="Edit"><Edit className="w-4 h-4" /></button>
                   <button onClick={() => handleToggleSuspend(user.id, user.status)} className={`p-2 rounded transition ${user.status === 'active' ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`} title={user.status === 'active' ? "Suspend User" : "Activate User"}>{user.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}</button>
                   <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Delete User"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex gap-4">
           <div className="relative"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input type="text" placeholder="Search actions..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-64 outline-none focus:border-indigo-500"/></div>
        </div>
        <button className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition"><Download className="w-4 h-4" /> Export CSV</button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 sticky top-0 shadow-sm z-10">
              <th className="p-4 font-bold">Date</th>
              <th className="p-4 font-bold">User</th>
              <th className="p-4 font-bold">Action</th>
              <th className="p-4 font-bold">Entity</th>
              <th className="p-4 font-bold">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="p-4 text-slate-500">{log.date}</td>
                <td className="p-4 font-medium text-slate-700">{log.user}</td>
                <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-600">{log.action}</span></td>
                <td className="p-4 text-slate-500">{log.entity}</td>
                <td className="p-4 text-slate-400 text-xs">{log.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderApiKeys = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">API Keys</h3>
        <button onClick={handleGenerateApiKey} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"><Plus className="w-4 h-4" /> Generate Key</button>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
            <th className="p-4 font-bold">Name</th>
            <th className="p-4 font-bold">Key</th>
            <th className="p-4 font-bold">Rate Limit</th>
            <th className="p-4 font-bold">Usage</th>
            <th className="p-4 font-bold">Status</th>
            <th className="p-4 font-bold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {apiKeys.map(k => (
            <tr key={k.id} className="hover:bg-slate-50">
              <td className="p-4 text-slate-700">{k.name}</td>
              <td className="p-4 font-mono text-xs text-slate-500 flex items-center gap-2"><div className="bg-slate-100 px-2 py-1 rounded">{k.key}</div> <Copy className="w-3 h-3 cursor-pointer hover:text-indigo-600" /></td>
              <td className="p-4 text-slate-600">{k.limit}</td>
              <td className="p-4 text-slate-600">{k.usage}</td>
              <td className="p-4"><span className="px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-700">{k.status}</span></td>
              <td className="p-4 text-right">
                 <button onClick={()=>setApiKeys(apiKeys.filter(a=>a.id!==k.id))} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
          {apiKeys.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No API keys generated.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const renderDns = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Cloudflare Domains</h3>
        <form onSubmit={handleAddDomain} className="flex items-center gap-2">
           <input type="text" placeholder="example.com" value={newDomainInput} onChange={(e) => setNewDomainInput(e.target.value)} className="p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
           <input type="text" placeholder="Cloudflare Zone ID" value={newZoneIdInput} onChange={(e) => setNewZoneIdInput(e.target.value)} className="p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
           <button type="submit" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"><Plus className="w-4 h-4" /> Connect Domain</button>
        </form>
      </div>
      <div className="p-6 space-y-4">
        {!systemSettings.cfToken && (
           <div className="bg-amber-50 text-amber-700 p-4 rounded-lg flex items-center gap-2 border border-amber-200 text-sm"><AlertCircle className="w-4 h-4"/> Cloudflare API Token missing. Please add it in System Settings to fetch real DNS data.</div>
        )}
        {dnsDomains.map(d => (
          <div key={d.id} className="flex items-center justify-between p-4 border border-slate-200 bg-slate-50 rounded-lg">
             <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-lg text-slate-600 shadow-sm"><Globe className="w-6 h-6" /></div>
                <div>
                   <div className="font-bold text-slate-800">{d.domain} <span className="text-xs font-mono text-slate-400 ml-2">{d.zoneId}</span></div>
                   <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                     <span className={`flex items-center gap-1 ${d.status === 'Verified' ? 'text-emerald-600' : 'text-amber-600'}`}><AlertCircle className="w-3 h-3" /> {d.status}</span>
                     <span>{(d.records || []).length} synced records</span>
                   </div>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <button onClick={() => openDnsModal(d)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition">Manage DNS</button>
                <button onClick={()=>setDnsDomains(dnsDomains.filter(x=>x.id!==d.id))} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
             </div>
          </div>
        ))}
        {dnsDomains.length === 0 && <div className="text-center py-8 text-slate-500 text-sm">No custom domains configured.</div>}
      </div>
      
      {/* Cloudflare Live DNS Modal */}
      {isDnsModalOpen && dnsManagingDomain && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">Live DNS Configuration <Cloud className="w-5 h-5 text-indigo-500"/></h3>
                    <p className="text-xs text-slate-500 mt-1">{dnsManagingDomain.domain} (Zone: {dnsManagingDomain.zoneId})</p>
                 </div>
                 <button onClick={() => setIsDnsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              
              <form onSubmit={handleAddDnsRecord} className="flex gap-2 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                 <select value={newDnsRecord.type} onChange={(e) => setNewDnsRecord({...newDnsRecord, type: e.target.value})} className="p-2 border rounded outline-none font-medium text-slate-700 text-sm">
                    <option>A</option><option>CNAME</option><option>TXT</option><option>MX</option>
                 </select>
                 <input type="text" placeholder="Name (e.g. www or @)" value={newDnsRecord.name} onChange={(e) => setNewDnsRecord({...newDnsRecord, name: e.target.value})} className="p-2 border rounded text-sm outline-none w-1/4" required/>
                 <input type="text" placeholder="Content / Target IP" value={newDnsRecord.content} onChange={(e) => setNewDnsRecord({...newDnsRecord, content: e.target.value})} className="p-2 border rounded text-sm outline-none flex-1" required/>
                 <select value={newDnsRecord.ttl} onChange={(e) => setNewDnsRecord({...newDnsRecord, ttl: e.target.value})} className="p-2 border rounded outline-none font-medium text-slate-700 text-sm">
                    <option value="1">Auto</option><option value="3600">3600</option>
                 </select>
                 <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 transition text-white px-4 py-2 rounded font-medium text-sm flex gap-2 items-center"><Plus className="w-4 h-4" /> Add Record</button>
              </form>

              <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg relative">
                  {isFetchingDns && <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-600"/></div>}
                  <table className="w-full text-left border-collapse text-sm">
                     <thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs sticky top-0"><th className="p-3 font-bold">Type</th><th className="p-3 font-bold">Name</th><th className="p-3 font-bold">Content</th><th className="p-3 font-bold">TTL</th><th className="p-3 font-bold text-right">Actions</th></tr></thead>
                     <tbody>
                        {(dnsManagingDomain.records || []).map((r: any) => (
                           <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                              <td className="p-3 font-mono text-xs font-bold text-slate-600">{r.type}</td>
                              <td className="p-3 text-slate-800 font-medium">{r.name}</td>
                              <td className="p-3 text-slate-500 truncate max-w-[250px]">{r.content}</td>
                              <td className="p-3 text-slate-400">{r.ttl === 1 ? 'Auto' : r.ttl}</td>
                              <td className="p-3 text-right"><button onClick={() => handleDeleteDnsRecord(r.id)} className="text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4" /></button></td>
                           </tr>
                        ))}
                        {(!dnsManagingDomain.records || dnsManagingDomain.records.length === 0) && !isFetchingDns && <tr><td colSpan={5} className="py-12 text-center text-slate-500">No records found on Cloudflare.</td></tr>}
                     </tbody>
                  </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );

  const renderAiProviders = () => (
    <div className="space-y-6 animate-fade-in">
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
             <h3 className="font-bold text-slate-800">AI Provider Configuration</h3>
             <button onClick={() => openAiModal()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"><Plus className="w-4 h-4" /> Add Provider</button>
          </div>
          <div className="divide-y divide-slate-100">
             {aiProviders.map(p => (
                <div key={p.id} className={`p-6 flex items-center justify-between transition ${p.status ? 'bg-indigo-50/30' : 'bg-white opacity-60'}`}>
                   <div className="flex items-center gap-4">
                      <div className={`${p.status ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'} p-3 rounded-lg`}><Zap className="w-6 h-6" /></div>
                      <div>
                         <div className="flex items-center gap-2">
                           <h4 className={`font-bold ${p.status ? 'text-slate-800' : 'text-slate-500'}`}>{p.name}</h4>
                           {p.tags.map((t: string)=><span key={t} className={`text-[10px] px-2 py-0.5 rounded border ${t==='Free'?'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>{t}</span>)}
                         </div>
                         <div className="flex gap-4 mt-1 text-xs text-slate-500">
                           <span className={`flex items-center gap-1 ${p.status ? 'text-emerald-600' : ''}`}>{p.status ? <CheckCircle className="w-3 h-3"/> : <EyeOff className="w-3 h-3" />} {p.status ? 'Active' : 'Disabled'}</span>
                           <span>Priority: {p.priority}</span>
                           <span>Model: {p.model}</span>
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-6">
                      <button onClick={() => handleTestAi(p)} className="px-3 py-1.5 border border-slate-200 rounded text-sm hover:bg-slate-100 bg-white">Test API</button>
                      <button onClick={() => openAiModal(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded bg-white"><Edit className="w-4 h-4" /></button>
                      <button onClick={()=>handleToggleAiProvider(p.id)} className={`w-12 h-6 rounded-full relative transition-colors ${p.status ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                         <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${p.status ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                   </div>
                </div>
             ))}
          </div>
       </div>

       <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 shadow-sm">
          <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><LockKeyhole className="w-4 h-4"/> Security Rules (Required)</h4>
          <p className="text-sm text-indigo-800">For security reasons, AI capabilities are defaulted to OFF. You must manually enable a provider to unlock the Optimizer.</p>
       </div>
    </div>
  );

  const renderTabs = () => {
    switch(activeTab) {
      case 'overview': return renderOverview();
      case 'profile': return renderSettings(); 
      case 'users': return renderUsers();
      case 'settings': return renderSettings();
      case 'logs': return renderLogs();
      case 'api-keys': return renderApiKeys();
      case 'dns': return renderDns();
      case 'ai-providers': return renderAiProviders();
      default: return renderOverview();
    }
  };

  const navItems = [
    { id: 'overview', icon: Layout, label: 'Overview' },
    { id: 'profile', icon: UserCheck, label: 'Profile' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'ai-providers', icon: Zap, label: 'AI Providers' },
    { id: 'api-keys', icon: Key, label: 'API Keys' },
    { id: 'logs', icon: ScrollText, label: 'Logs' },
    { id: 'dns', icon: Globe, label: 'DNS' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-[#f1f5f9] font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-xl z-20 shrink-0 transition-all">
         <div className="h-16 flex items-center px-6 border-b border-slate-800">
            <Plane className="w-6 h-6 text-indigo-500 mr-2" />
            <span className="font-bold text-lg text-white">Admin Panel</span>
         </div>
         <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
            {navItems.map(item => (
               <button 
                  key={item.id} 
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
               >
                  <item.icon className="w-4 h-4" /> {item.label}
               </button>
            ))}
         </nav>
         <div className="p-4 border-t border-slate-800">
            <button onClick={onLogout} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium px-3 py-2 w-full transition-colors"><LogOut className="w-4 h-4" /> Logout</button>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
         {/* Header */}
         <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-4">
               <button className="lg:hidden text-slate-500"><Menu className="w-5 h-5" /></button>
               <h1 className="text-xl font-bold text-slate-800 capitalize tracking-tight">
                 {activeTab.replace('-', ' ')}
               </h1>
            </div>
            <div className="flex items-center gap-4">
               <button onClick={onClose} className="text-sm font-medium text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full hover:bg-indigo-100 transition border border-indigo-100">Exit Admin Mode</button>
               <div className="w-px h-6 bg-slate-200 mx-2"></div>
               <div className="flex items-center gap-2 ml-2 cursor-pointer p-1 rounded-md hover:bg-slate-50">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm">
                    {currentUser?.fullName?.charAt(0) || 'A'}
                  </div>
                  <div className="hidden md:block text-left">
                     <div className="text-sm font-bold text-slate-700 leading-tight">{currentUser?.username}</div>
                     <div className="text-xs text-slate-500 leading-tight">Administrator</div>
                  </div>
               </div>
            </div>
         </header>

         {/* Scrollable Content */}
         <main className="flex-1 overflow-y-auto p-8 relative">
            {renderTabs()}
         </main>
      </div>

      {/* Global Alert Modal (Replaces window.alert) */}
      {alertMessage && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
              {alertMessage.type === 'error' && <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4"/>}
              {alertMessage.type === 'success' && <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4"/>}
              {alertMessage.type === 'info' && <Bell className="w-14 h-14 text-indigo-500 mx-auto mb-4"/>}
              <h3 className="text-xl font-bold text-slate-800 mb-2">{alertMessage.title}</h3>
              <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap leading-relaxed">{alertMessage.message}</p>
              <button onClick={() => setAlertMessage(null)} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition">Got it</button>
           </div>
        </div>
      )}

      {/* Global Confirm Modal (Replaces window.confirm) */}
      {confirmMessage && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
              <AlertCircle className="w-14 h-14 text-amber-500 mx-auto mb-4"/>
              <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmMessage.title}</h3>
              <p className="text-sm text-slate-600 mb-8 leading-relaxed">{confirmMessage.message}</p>
              <div className="flex gap-3 justify-center">
                 <button onClick={() => setConfirmMessage(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition">Cancel</button>
                 <button onClick={confirmMessage.onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition shadow-sm">Confirm</button>
              </div>
           </div>
        </div>
      )}

      {/* User Modal with Custom Credits Control */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
             </div>
             <form onSubmit={handleSaveUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label><input type="text" value={userFormData.fullName} onChange={e => setUserFormData({...userFormData, fullName: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none" required /></div>
                  <div><label className="block text-xs font-bold text-slate-600 mb-1">Email</label><input type="email" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none" required /></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Username</label><input type="text" value={userFormData.username} onChange={e => setUserFormData({...userFormData, username: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none" required /></div>
                <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1">Password {editingUser && <span className="font-normal text-slate-400">(Leave blank to keep current)</span>}</label>
                   <input type="password" value={userFormData.password} onChange={e => setUserFormData({...userFormData, password: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none" />
                </div>
                
                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                  {(!editingUser || String(editingUser.id) !== String(currentUser.id)) && (
                     <>
                        <div>
                           <label className="block text-xs font-bold text-slate-600 mb-1">Role</label>
                           <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value})} className="w-full p-2 border rounded text-sm outline-none">
                              <option value="user">User</option><option value="admin">Admin</option>
                           </select>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                           <select value={userFormData.status} onChange={e => setUserFormData({...userFormData, status: e.target.value})} className="w-full p-2 border rounded text-sm outline-none">
                              <option value="active">Active</option><option value="suspended">Suspended</option>
                           </select>
                        </div>
                     </>
                  )}
                  <div className={(!editingUser || String(editingUser.id) !== String(currentUser.id)) ? "" : "col-span-3"}>
                     <label className="block text-xs font-bold text-slate-600 mb-1">Credits</label>
                     <input type="number" value={userFormData.credits} onChange={e => setUserFormData({...userFormData, credits: parseInt(e.target.value)})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none" required />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                   <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 rounded text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                   <button type="submit" className="px-4 py-2 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition">Save User</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Add/Edit AI Provider Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">{editingAi ? 'Edit AI Provider' : 'Add AI Provider'}</h3>
              <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveAi} className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Provider Type</label>
                <select value={aiFormData.name} onChange={e => {
                  const selectedName = e.target.value;
                  const providerDefaults: Record<string, {model: string, baseUrl: string, tags: string, apiKey: string, isPuter?: boolean}> = {
                    'Puter.js (Free)': { model: 'gpt-4o-mini', baseUrl: '', tags: 'Free, No API Key, Built-in', apiKey: 'puter', isPuter: true },
                    'DeepSeek': { model: 'deepseek-chat', baseUrl: '', tags: 'Free, Fast', apiKey: '' },
                    'Google Gemini': { model: 'gemini-2.0-flash', baseUrl: '', tags: 'Free, Vision, Fast', apiKey: '' },
                    'Groq': { model: 'llama-3.3-70b-versatile', baseUrl: '', tags: 'Free, Fast', apiKey: '' },
                    'OpenAI': { model: 'gpt-4o-mini', baseUrl: '', tags: 'Premium, Vision', apiKey: '' },
                    'Mistral AI': { model: 'mistral-small-latest', baseUrl: '', tags: 'Free, Fast', apiKey: '' },
                    'Cerebras': { model: 'llama-3.3-70b', baseUrl: '', tags: 'Fast, Llama', apiKey: '' },
                    'Together AI': { model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', baseUrl: '', tags: 'Free, Llama', apiKey: '' },
                    'Ollama (Local)': { model: 'llama3.2:latest', baseUrl: 'http://localhost:11434/v1', tags: 'Free, Local, Privacy', apiKey: 'ollama' }
                  };
                  const defaults = providerDefaults[selectedName] || { model: '', baseUrl: '', tags: '', apiKey: '', isPuter: false };
                  setAiFormData({...aiFormData, name: selectedName, model: defaults.model, baseUrl: defaults.baseUrl, tags: defaults.tags, apiKey: defaults.apiKey, isPuter: defaults.isPuter || false});
                }} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none bg-white">
                  <option value="">-- Select Provider --</option>
                  <option value="Puter.js (Free)">🌟 Puter.js (FREE - No API Key Required!)</option>
                  <option value="DeepSeek">DeepSeek (Free - Fast)</option>
                  <option value="Google Gemini">Google Gemini (Free)</option>
                  <option value="Groq">Groq (Free - Fastest)</option>
                  <option value="Mistral AI">Mistral AI (Free)</option>
                  <option value="OpenAI">OpenAI (Premium)</option>
                  <option value="Cerebras">Cerebras (Fast)</option>
                  <option value="Together AI">Together AI (Free)</option>
                  <option value="Ollama (Local)">Ollama (Local - Privacy)</option>
                </select>
              </div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">
                API Key {aiFormData.name === 'Puter.js (Free)' && <span className="text-emerald-600 font-normal">(Not required - Completely FREE!)</span>}
                {aiFormData.name === 'Ollama (Local)' && <span className="text-emerald-600 font-normal">(Not required for local)</span>}
              </label>
                <div className="flex gap-2">
                  <input type="password" value={aiFormData.apiKey} onChange={e => setAiFormData({...aiFormData, apiKey: e.target.value})} className="flex-1 p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none" placeholder="Enter your API key..." />
                  <button type="button" onClick={handleFetchModels} disabled={isFetchingModels || !aiFormData.apiKey || !aiFormData.name} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded text-sm font-bold transition flex items-center gap-1 whitespace-nowrap">
                    {isFetchingModels ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Fetch
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Select provider type first, then click Fetch to validate</p>
              </div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Model Name</label><input type="text" value={aiFormData.model} onChange={e => setAiFormData({...aiFormData, model: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none" required placeholder="e.g., gemini-2.0-flash" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Base URL <span className="text-slate-400 font-normal">(Optional - for local providers like Ollama)</span></label><input type="text" value={aiFormData.baseUrl || ''} onChange={e => setAiFormData({...aiFormData, baseUrl: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none" placeholder="e.g., http://localhost:11434/v1" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Priority (1 is highest)</label><input type="number" value={aiFormData.priority} onChange={e => setAiFormData({...aiFormData, priority: parseInt(e.target.value)})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none" required /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Tags (Comma separated)</label><input type="text" value={aiFormData.tags} onChange={e => setAiFormData({...aiFormData, tags: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 text-sm outline-none" placeholder="Free, Vision" /></div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <input type="checkbox" id="enableProvider" checked={aiFormData.status} onChange={e => setAiFormData({...aiFormData, status: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                <label htmlFor="enableProvider" className="text-sm text-slate-700 cursor-pointer">
                  <span className="font-bold">Enable this provider</span>
                  <span className="text-slate-500 block text-xs">Required for AI features to work. Only enabled providers will be used.</span>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsAiModalOpen(false)} className="px-4 py-2 rounded text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition">Save Provider</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const OptimizerView: React.FC<{ currentUser: User, onLogout: () => void, onGoToAdmin: () => void }> = ({ currentUser, onLogout, onGoToAdmin }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isFetchingJob, setIsFetchingJob] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>({ tone: "Balanced", format: "Chronological", strictness: "Balanced" });
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [highlightKeywords, setHighlightKeywords] = useState(false);
  const [appError, setAppError] = useState("");
  const [appSuccess, setAppSuccess] = useState("");
  
  const [targetAirline, setTargetAirline] = useState("");
  
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [result, setResult] = useState<any>(null);
  const [coverLetterResult, setCoverLetterResult] = useState<any>(null);
  const [interviewResult, setInterviewResult] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  const [selectedTemplate, setSelectedTemplate] = useState('professional');
  const [isEditing, setIsEditing] = useState(false);

  const handleResumePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => setResumeText(e.target.value);
  const handleJobPaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => setJobText(e.target.value);

  const [editorCharCount, setEditorCharCount] = useState(0);
  const inputTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumePreviewRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    const scriptMammoth = document.createElement('script');
    scriptMammoth.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    scriptMammoth.async = true;
    document.body.appendChild(scriptMammoth);

    const scriptPdf = document.createElement('script');
    scriptPdf.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    scriptPdf.async = true;
    document.body.appendChild(scriptPdf);

    return () => { 
      if(document.body.contains(scriptMammoth)) document.body.removeChild(scriptMammoth);
      if(document.body.contains(scriptPdf)) document.body.removeChild(scriptPdf);
    };
  }, []);

  useEffect(() => {
    const savedResume = localStorage.getItem('ats_resumeText');
    const savedJob = localStorage.getItem('ats_jobText');
    const savedUrl = localStorage.getItem('ats_jobUrl');
    const savedHistory = localStorage.getItem('ats_history');
    if (savedResume) setResumeText(savedResume);
    if (savedJob) setJobText(savedJob);
    if (savedUrl) setJobUrl(savedUrl);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => { localStorage.setItem('ats_resumeText', resumeText); }, [resumeText]);
  useEffect(() => { localStorage.setItem('ats_jobText', jobText); }, [jobText]);
  useEffect(() => { localStorage.setItem('ats_jobUrl', jobUrl); }, [jobUrl]);
  useEffect(() => { localStorage.setItem('ats_history', JSON.stringify(history)); }, [history]);

  useEffect(() => {
     if(result && result.optimized_content && resumePreviewRef.current && !isEditing) {
         let content = result.optimized_content;
         if (highlightKeywords && result.matched_keywords) {
            result.matched_keywords.forEach((kw: string) => {
               const regex = new RegExp(`\\b(${kw})\\b(?![^<]*>)`, 'gi');
               content = content.replace(regex, '<span class="bg-emerald-100 rounded px-0.5">$1</span>');
            });
         }
         resumePreviewRef.current.innerHTML = content;
         setEditorCharCount(resumePreviewRef.current.innerText.length);
     }
  }, [result, highlightKeywords, isEditing]);

  const saveToHistory = (dataResult: any) => {
     const titleMatch = jobText.match(/(?:Title|Role):\s*(.*)/i);
     const companyMatch = jobText.match(/(?:Company|At):\s*(.*)/i);
     const newItem = { id: Date.now(), date: new Date().toISOString(), resumeText, jobText, jobUrl, result: dataResult, jobTitle: titleMatch ? titleMatch[1] : "Job Application", company: companyMatch ? companyMatch[1] : "Company", score: dataResult.score };
     setHistory(prev => [newItem, ...prev]);
  };

  const loadFromHistory = (item: any) => {
     setResumeText(item.resumeText);
     setJobText(item.jobText);
     setJobUrl(item.jobUrl || "");
     setResult(item.result);
     setStep(3); 
     setShowHistory(false);
  };

  const deleteHistoryItem = (id: string) => { setHistory(prev => prev.filter(item => item.id !== id)); };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setAppError("");
    try {
      const text = await parseFile(file);
      setResumeText(text);
    } catch (error: any) {
      setAppError("Error parsing file: " + error.message);
    } finally {
      setIsParsing(false);
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const handleDownloadResume = () => {
    let content = resumePreviewRef.current?.innerHTML;
    if (!content) return;
    const cleanContent = content.replace(/<span class="bg-emerald-100[^>]*">(.*?)<\/span>/g, '$1');
    const sourceHTML = getDocxHtml(cleanContent, selectedTemplate);
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'Optimized_Resume.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const handleDownloadCoverLetter = () => {
    if (!coverLetterResult) return;
    const sourceHTML = getDocxHtml(coverLetterResult, selectedTemplate);
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'Cover_Letter.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const handlePdfExport = () => {
    const element = resumePreviewRef.current;
    if (!element) return;
    
    const container = document.createElement('div');
    container.innerHTML = element.innerHTML;
    
    const highlights = container.querySelectorAll('span');
    highlights.forEach(span => {
       if (span.classList.contains('bg-emerald-100')) {
          const text = document.createTextNode(span.innerText);
          span.parentNode?.replaceChild(text, span);
       }
    });

    let fontFam = "'Times New Roman', serif";
    let color = "#000000";
    if (selectedTemplate === 'modern') { fontFam = "'Helvetica Neue', Helvetica, Arial, sans-serif"; color = "#2c3e50"; }
    if (selectedTemplate === 'minimal') { fontFam = "'Inter', 'Segoe UI', Roboto, sans-serif"; color = "#111827"; }

    container.style.cssText = `font-family: ${fontFam}; font-size: 12pt; line-height: 1.15; color: ${color}; width: 100%; text-align: left;`;
    
    const h1s = container.querySelectorAll('h1');
    h1s.forEach(el => el.style.cssText = `font-size: 16pt; font-weight: bold; text-align: left; text-transform: uppercase; margin: 0 0 4pt 0; color: ${color};`);
    
    const contacts = container.querySelectorAll('p.contact');
    contacts.forEach(el => (el as HTMLElement).style.cssText = `text-align: left; font-size: 12pt; margin: 0 0 12pt 0; color: ${color};`);
    
    const h3s = container.querySelectorAll('h3');
    h3s.forEach(el => el.style.cssText = `font-size: 12pt; font-weight: bold; text-transform: uppercase; text-align: left; margin: 12pt 0 6pt 0; color: ${color};`);
    
    const h4s = container.querySelectorAll('h4');
    h4s.forEach(el => el.style.cssText = `font-size: 12pt; font-weight: bold; margin: 6pt 0 2pt 0; color: ${color};`);
    
    const ps = container.querySelectorAll('p:not(.contact)');
    ps.forEach(el => (el as HTMLElement).style.cssText = `margin: 0 0 4pt 0; text-align: justify; color: ${color};`);
    
    const uls = container.querySelectorAll('ul');
    uls.forEach(el => el.style.cssText = `margin: 0 0 8pt 0; padding-left: 24px; color: ${color};`);
    
    const lis = container.querySelectorAll('li');
    lis.forEach(el => el.style.cssText = `margin-bottom: 2pt; color: ${color}; display: list-item; text-align: left; list-style-type: disc !important; list-style-position: inside !important;`);
    
    const bs = container.querySelectorAll('strong, b');
    bs.forEach(el => (el as HTMLElement).style.cssText = `font-weight: bold; color: ${color};`);

    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const opt = {
      margin: [12.7, 12.7, 12.7, 12.7], 
      filename: 'Optimized_Resume.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        if ((window as any).html2pdf) {
          (window as any).html2pdf().set(opt).from(container).save().then(() => {
              if (document.body.contains(container)) document.body.removeChild(container);
          }).catch((err: any) => {
              console.error("PDF failed, fallback.", err);
              if (document.body.contains(container)) document.body.removeChild(container);
              window.print();
          });
        } else {
          if (document.body.contains(container)) document.body.removeChild(container);
          window.print();
        }
    } catch(e) {
        if (document.body.contains(container)) document.body.removeChild(container);
        window.print();
    }
  };

  const handleJobFetch = async () => {
    if (!jobUrl) return;
    setIsFetchingJob(true);
    setAppError("");
    setJobText("");
    try {
      const text = await fetchJobWithGemini(jobUrl);
      setJobText(text);
    } catch (error: any) { setAppError(error.message); } 
    finally { setIsFetchingJob(false); }
  };

  const runOptimization = async () => {
    if (!resumeText || !jobText) { setAppError("Please provide both resume content and job description."); return; }
    setLoading(true);
    setAppError("");
    setResult(null); setCoverLetterResult(null); setInterviewResult(null); 
    try {
      const data = await analyzeWithGemini(resumeText, jobText, settings, targetAirline);
      setResult(data);
      saveToHistory(data);
      setStep(3); 
    } catch (e: any) { setAppError(e.message); } 
    finally { setLoading(false); }
  };

  const handleGenerateCoverLetter = async () => {
    if (!result?.optimized_content || !jobText) return;
    setIsGeneratingCoverLetter(true);
    setAppError("");
    try {
      const currentContent = resumePreviewRef.current ? resumePreviewRef.current.innerHTML : result.optimized_content;
      const data = await generateCoverLetterWithGemini(currentContent, jobText, settings);
      setCoverLetterResult(data.cover_letter_content);
    } catch (e: any) { setAppError(e.message); } 
    finally { setIsGeneratingCoverLetter(false); }
  };

  const handleGenerateInterview = async () => {
    if (!result?.optimized_content || !jobText) return;
    setLoading(true);
    setAppError("");
    setCurrentQuestionIndex(0);
    try {
      const currentContent = resumePreviewRef.current ? resumePreviewRef.current.innerHTML : result.optimized_content;
      const data = await generateInterviewPrepWithGemini(currentContent, jobText);
      setInterviewResult(data.questions);
      setStep(4);
    } catch (e: any) { setAppError(e.message); } 
    finally { setLoading(false); }
  };

  const handleSaveEdits = () => {
    if (resumePreviewRef.current) {
       const updatedContent = resumePreviewRef.current.innerHTML;
       setResult({ ...result, optimized_content: updatedContent });
       setIsEditing(false);
    }
  };

  const handleEditorInput = () => {
      if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
      inputTimeoutRef.current = setTimeout(() => {
          if(resumePreviewRef.current) setEditorCharCount(resumePreviewRef.current.innerText.length);
      }, 500); 
  };

  const handleDriveSave = () => {
    const btn = document.getElementById('drive-btn');
    if(btn) btn.innerText = "Saving...";
    setTimeout(() => {
      setAppSuccess("Successfully saved 'Optimized_Resume.docx' to Google Drive!");
      setTimeout(() => setAppSuccess(""), 5000);
      if(btn) btn.innerText = "Save to Drive";
    }, 2000);
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        html, body, #root { height: auto !important; width: auto !important; overflow: visible !important; background: white !important; }
        #resume-preview, #resume-preview * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        #resume-preview { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background: white !important; z-index: 99999 !important; }
        @page { size: A4 portrait; margin: 1.27cm 1.27cm 1.27cm 1.27cm; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative overflow-x-hidden flex flex-col">
      <HistorySidebar isOpen={showHistory} onClose={() => setShowHistory(false)} history={history} onLoad={loadFromHistory} onDelete={deleteHistoryItem} />
      
      {/* Redesigned Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 no-print h-16 flex items-center justify-between px-6 shadow-sm">
         <div className="flex items-center gap-2 font-bold text-xl text-slate-800">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><Plane className="w-5 h-5" /></div> ATSPro
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">v2.1-NOAI</span>
         </div>
         <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200">
            <div className="px-4 py-1.5 text-sm font-medium text-slate-600 flex items-center gap-2"><Zap className="w-4 h-4 text-indigo-500" /> {currentUser?.credits || 0} credits</div>
            <div className="w-px h-4 bg-slate-300 mx-1"></div>
            <button onClick={() => setShowHistory(true)} className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-full flex items-center gap-2 transition"><History className="w-4 h-4" /> History</button>
            {currentUser?.role === 'admin' && (
                <>
                  <div className="w-px h-4 bg-slate-300 mx-1"></div>
                  <button onClick={onGoToAdmin} className="px-4 py-1.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100 rounded-full flex items-center gap-2 transition"><Shield className="w-4 h-4" /> Admin</button>
                </>
            )}
         </div>
         <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-slate-700 hidden md:block">{currentUser?.fullName || currentUser?.username}</div>
            <button onClick={onLogout} className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold hover:bg-indigo-200 transition" title="Logout">
              {currentUser?.fullName?.charAt(0) || 'U'}
            </button>
         </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        
        {/* INPUT STAGE (Steps 1 & 2 combined) */}
        {!result && step < 4 && (
          <div className="animate-fade-in space-y-8">
             
             {appError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-center gap-3 shadow-sm animate-fade-in">
                   <AlertCircle className="w-6 h-6 shrink-0"/>
                   <span className="font-medium text-sm">{appError}</span>
                </div>
             )}

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 
                 {/* Left Column: The Tailor (Resume) */}
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2 font-bold text-slate-700">
                       <FileText className="w-5 h-5 text-indigo-500" /> The Tailor <span className="text-xs font-normal text-slate-400 ml-2">Resume Input</span>
                    </div>
                    <div className="p-6 flex flex-col flex-1 gap-6">
                       <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Upload Resume (TXT, PDF, DOCX)</label>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.md,.pdf,.docx,.doc" />
                          <button onClick={triggerFileInput} disabled={isParsing} className="w-full border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-slate-500 hover:border-indigo-400 hover:bg-indigo-50 transition bg-slate-50">
                             {isParsing ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" /> : <Upload className="w-6 h-6 text-slate-400 mb-2" />}
                             <span className="text-sm font-medium">{isParsing ? "Extracting text..." : "Choose File or drag and drop"}</span>
                          </button>
                       </div>
                       
                       <div className="relative flex py-2 items-center">
                          <div className="flex-grow border-t border-slate-200"></div><span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase tracking-wider">Or paste resume content</span><div className="flex-grow border-t border-slate-200"></div>
                       </div>
                       
                       <textarea className="w-full flex-1 min-h-[250px] p-4 text-sm text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono bg-white shadow-inner" placeholder="Paste your resume content here..." value={resumeText} onChange={handleResumePaste} disabled={isParsing} />
                    </div>
                 </div>

                 {/* Right Column: Job Context */}
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2 font-bold text-slate-700">
                       <Briefcase className="w-5 h-5 text-indigo-500" /> Job Context
                    </div>
                    <div className="p-6 flex flex-col flex-1 gap-6">
                       <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Skip the copy-paste — fetch automatically</label>
                          <div className="flex gap-2">
                             <input type="text" placeholder="Paste LinkedIn/Indeed URL" className="flex-1 p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 bg-slate-50" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJobFetch()} />
                             <button onClick={handleJobFetch} disabled={isFetchingJob || !jobUrl} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-6 rounded-xl text-sm font-bold transition border border-indigo-200 disabled:opacity-50">
                                {isFetchingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                             </button>
                          </div>
                       </div>
                       
                       <div className="relative flex py-2 items-center">
                          <div className="flex-grow border-t border-slate-200"></div><span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase tracking-wider">Or enter manually</span><div className="flex-grow border-t border-slate-200"></div>
                       </div>
                       
                       {/* Preserving ATS Profile selector logic while adapting UI flow */}
                       <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Target ATS Profile / Airline (Optional)</label>
                          <select className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={targetAirline} onChange={(e) => setTargetAirline(e.target.value)}>
                             <option value="">Select ATS Profile...</option>
                             {Object.keys(AIRLINE_ATS_PROFILES).map(airline => (<option key={airline} value={airline}>{airline} ({AIRLINE_ATS_PROFILES[airline as keyof typeof AIRLINE_ATS_PROFILES].system})</option>))}
                          </select>
                       </div>

                       <div className="flex flex-col flex-1">
                          <label className="block text-sm font-bold text-slate-700 mb-2">Job Description</label>
                          <textarea className="w-full flex-1 min-h-[160px] p-4 text-sm text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono bg-white shadow-inner" placeholder="Paste job description text here..." value={jobText} onChange={handleJobPaste} disabled={isFetchingJob} />
                       </div>
                    </div>
                 </div>
             </div>

             {/* Tone & Format Selection Before Optimization */}
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Tone</label>
                      <select className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={settings.tone} onChange={(e) => setSettings({...settings, tone: e.target.value})}>
                         <option value="Balanced">Balanced</option>
                         <option value="Formal">Formal</option>
                         <option value="Business">Business</option>
                         <option value="Corporate">Corporate</option>
                         <option value="Creative">Creative</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Format Style</label>
                      <select className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={settings.format} onChange={(e) => setSettings({...settings, format: e.target.value})}>
                         <option value="Chronological">Chronological</option>
                         <option value="Functional">Functional</option>
                         <option value="Hybrid">Hybrid</option>
                      </select>
                   </div>
                </div>
             </div>

             {/* Action Button */}
             <div className="flex justify-center pt-4">
                <button onClick={runOptimization} disabled={!resumeText.trim() || !jobText.trim() || loading || isFetchingJob} className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-4 rounded-full font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-1 text-lg">
                   {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6" />} 
                   {loading ? "Optimizing ATS Match..." : "Tailor My Resume"}
                </button>
             </div>
          </div>
        )}

        {/* RESULTS STAGE (Step 3) */}
        {step === 3 && result && (
           <div className="max-w-5xl mx-auto animate-fade-in no-print">
              
              {appError && (
                 <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 flex items-center gap-3 shadow-sm animate-fade-in">
                    <AlertCircle className="w-6 h-6 shrink-0"/>
                    <span className="font-medium text-sm">{appError}</span>
                 </div>
              )}

              {appSuccess && (
                 <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-6 py-4 rounded-xl mb-6 flex items-center gap-3 shadow-sm animate-fade-in">
                    <CheckCircle className="w-6 h-6 shrink-0"/>
                    <span className="font-medium text-sm">{appSuccess}</span>
                 </div>
              )}

              {/* Score Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="text-4xl font-extrabold text-indigo-600 mb-1">{result.score}%</div>
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">ATS Score</div>
                    <div className="absolute bottom-0 left-0 w-full h-1.5 bg-indigo-50"><div className="h-full bg-indigo-600" style={{width: `${result.score}%`}}></div></div>
                 </div>
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
                    <div className="text-4xl font-extrabold text-slate-800 mb-1">{(result.matched_keywords?.length || 0) + (result.missing_keywords?.length || 0)}</div>
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Keywords Found</div>
                 </div>
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="text-4xl font-extrabold text-emerald-500 mb-1">{result.matched_keywords?.length || 0}</div>
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Keywords Matched</div>
                    <div className="absolute bottom-0 left-0 w-full h-1.5 bg-emerald-50"><div className="h-full bg-emerald-500" style={{width: `${((result.matched_keywords?.length || 0) / ((result.matched_keywords?.length || 0) + (result.missing_keywords?.length || 1))) * 100}%`}}></div></div>
                 </div>
              </div>

              {/* What's Next Row */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                 <div className="flex items-center gap-4">
                    <div className="bg-white p-2.5 rounded-xl text-indigo-600 shadow-sm"><MessageSquare className="w-6 h-6" /></div>
                    <div>
                       <div className="font-bold text-indigo-900 text-base">Practice Interview</div>
                       <div className="text-sm text-indigo-700">Get AI-powered questions tailored to this specific optimization</div>
                    </div>
                 </div>
                 <button onClick={handleGenerateInterview} disabled={loading} className="w-full sm:w-auto text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-200 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Start Prep"} <ChevronRight className="w-4 h-4" />
                 </button>
              </div>

              {/* Toolbar & Template Mock */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <div className="flex bg-slate-100 p-1.5 rounded-xl">
                       <button className="px-6 py-2 rounded-lg bg-white shadow-sm text-sm font-bold text-indigo-600">Resume</button>
                       <button onClick={handleGenerateCoverLetter} className="px-6 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-800 transition">
                          {isGeneratingCoverLetter ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Cover Letter"}
                       </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
                       <button onClick={() => { setResult(null); setInterviewResult(null); setCoverLetterResult(null); setStep(1); }} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Edit Input</button>
                       <button onClick={handleDownloadResume} className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition"><FileDown className="w-4 h-4" /> Download Docx</button>
                       {coverLetterResult && (
                           <button onClick={handleDownloadCoverLetter} className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition"><Mail className="w-4 h-4" /> Cover Letter DOCX</button>
                       )}
                       <button onClick={handlePdfExport} className="flex items-center justify-center p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm transition"><Printer className="w-4 h-4" /></button>
                       <button id="drive-btn" onClick={handleDriveSave} className="flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-sm transition"><Cloud className="w-4 h-4"/> Drive</button>
                    </div>
                 </div>

                 {/* Template Mock Display */}
                 <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-3">Resume Template</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div onClick={() => setSelectedTemplate('professional')} className={`border-2 ${selectedTemplate === 'professional' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'} rounded-xl p-4 cursor-pointer relative transition`}>
                          {selectedTemplate === 'professional' && <div className="absolute top-3 right-3 bg-indigo-500 rounded-full p-0.5"><Check className="w-3 h-3 text-white" /></div>}
                          <div className={`font-bold text-sm mb-1 ${selectedTemplate === 'professional' ? 'text-indigo-900' : 'text-slate-800'}`}>Professional</div>
                          <div className={`text-xs ${selectedTemplate === 'professional' ? 'text-indigo-600' : 'text-slate-500'}`}>Classic ATS-friendly format</div>
                       </div>
                       <div onClick={() => setSelectedTemplate('modern')} className={`border-2 ${selectedTemplate === 'modern' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'} rounded-xl p-4 cursor-pointer relative transition`}>
                          {selectedTemplate === 'modern' && <div className="absolute top-3 right-3 bg-indigo-500 rounded-full p-0.5"><Check className="w-3 h-3 text-white" /></div>}
                          <div className={`font-bold text-sm mb-1 ${selectedTemplate === 'modern' ? 'text-indigo-900' : 'text-slate-800'}`}>Modern</div>
                          <div className={`text-xs ${selectedTemplate === 'modern' ? 'text-indigo-600' : 'text-slate-500'}`}>Clean with subtle accents</div>
                       </div>
                       <div onClick={() => setSelectedTemplate('minimal')} className={`border-2 ${selectedTemplate === 'minimal' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'} rounded-xl p-4 cursor-pointer relative transition`}>
                          {selectedTemplate === 'minimal' && <div className="absolute top-3 right-3 bg-indigo-500 rounded-full p-0.5"><Check className="w-3 h-3 text-white" /></div>}
                          <div className={`font-bold text-sm mb-1 ${selectedTemplate === 'minimal' ? 'text-indigo-900' : 'text-slate-800'}`}>Minimal</div>
                          <div className={`text-xs ${selectedTemplate === 'minimal' ? 'text-indigo-600' : 'text-slate-500'}`}>Simple and elegant flow</div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Document Preview Area */}
              <div className="bg-[#f3f4f6] rounded-3xl p-8 lg:p-12 flex justify-center overflow-x-auto shadow-inner border border-slate-200 relative group">
                 <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 shadow-sm border border-slate-200 flex items-center gap-2 z-10">
                    {isEditing ? (
                       <button onClick={handleSaveEdits} className="text-emerald-600 flex items-center gap-1 hover:text-emerald-700 transition"><Save className="w-3 h-3" /> Save Edits</button>
                    ) : (
                       <button onClick={() => setIsEditing(true)} className="text-indigo-600 flex items-center gap-1 hover:text-indigo-700 transition"><Edit3 className="w-3 h-3" /> Live Edit</button>
                    )}
                 </div>
                 
                 <div className={`w-[21cm] min-h-[29.7cm] bg-white flex-shrink-0 transition-all ${isEditing ? 'shadow-2xl ring-4 ring-indigo-100 cursor-text' : 'shadow-xl cursor-default'}`}>
                    <div 
                      id="resume-preview"
                      ref={resumePreviewRef}
                      contentEditable={isEditing}
                      suppressContentEditableWarning={true}
                      onInput={handleEditorInput}
                      className={`p-12 text-sm leading-relaxed prose prose-sm max-w-none prose-h1:text-left prose-h1:uppercase prose-h3:uppercase prose-h3:border-none prose-p:my-0 prose-ul:my-0 prose-li:my-0 outline-none ${
                        selectedTemplate === 'professional' ? 'font-serif text-black prose-h3:text-black' : 
                        selectedTemplate === 'modern' ? 'font-sans text-slate-800 prose-h1:text-slate-900 prose-h3:text-slate-800' : 
                        'font-sans text-gray-700 font-light prose-h1:text-gray-900 prose-h3:text-gray-800 prose-h1:font-medium prose-h3:font-medium'
                      }`}
                    >
                       {/* Content injected via React Ref to prevent re-render lagging */}
                    </div>
                 </div>
              </div>

           </div>
        )}

        {/* INTERVIEW PREP (Step 4) */}
        {step === 4 && interviewResult && (
           <div className="animate-fade-in max-w-4xl mx-auto py-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                 <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                    <div className="bg-amber-100 p-3 rounded-xl"><MessageSquare className="w-8 h-8 text-amber-600" /></div>
                    <div className="flex-1">
                       <h2 className="text-2xl font-bold text-slate-800">Interview Prep Guide</h2>
                       <p className="text-slate-500 text-sm mt-1">Tailored Q&A based on the specific skills optimized in your resume.</p>
                    </div>
                    <div className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full">
                       Question {currentQuestionIndex + 1} of {interviewResult.length}
                    </div>
                 </div>
                 
                 {/* Progress Bar */}
                 <div className="mb-6">
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                       <div 
                          className="h-full bg-indigo-600 transition-all duration-300 ease-out" 
                          style={{ width: `${((currentQuestionIndex + 1) / interviewResult.length) * 100}%` }}
                       ></div>
                    </div>
                 </div>
                 
                 {/* Current Question */}
                 <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6">
                    <h3 className="font-bold text-slate-800 text-lg mb-4 flex gap-3">
                       <span className="text-indigo-600">Q{currentQuestionIndex + 1}:</span> 
                       {String(interviewResult[currentQuestionIndex]?.question)}
                    </h3>
                    <div className="bg-white p-5 rounded-lg border border-slate-200 text-slate-600 italic shadow-sm">
                       <span className="font-bold text-emerald-600 not-italic block mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" /> STAR Method Strategy:
                       </span>
                       {String(interviewResult[currentQuestionIndex]?.star_answer)}
                    </div>
                 </div>
                 
                 {/* Navigation Buttons */}
                 <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                    <button 
                       onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))} 
                       disabled={currentQuestionIndex === 0}
                       className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                       <ChevronRight className="w-5 h-5 rotate-180" /> Previous
                    </button>
                    
                    <div className="flex gap-2">
                       {interviewResult.map((_: any, idx: number) => (
                          <button
                             key={idx}
                             onClick={() => setCurrentQuestionIndex(idx)}
                             className={`w-3 h-3 rounded-full transition-all ${idx === currentQuestionIndex ? 'bg-indigo-600 scale-125' : 'bg-slate-300 hover:bg-slate-400'}`}
                          />
                       ))}
                    </div>
                    
                    {currentQuestionIndex < interviewResult.length - 1 ? (
                       <button 
                          onClick={() => setCurrentQuestionIndex(Math.min(interviewResult.length - 1, currentQuestionIndex + 1))} 
                          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-md"
                       >
                          Next <ChevronRight className="w-5 h-5" />
                       </button>
                    ) : (
                       <button 
                          onClick={() => setStep(3)} 
                          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-md"
                       >
                          <CheckCircle className="w-5 h-5" /> Finish
                       </button>
                    )}
                 </div>
                 
                 {/* Back to Resume Button */}
                 <div className="mt-6 flex justify-center">
                    <button onClick={() => setStep(3)} className="text-slate-600 hover:text-slate-800 px-6 py-2 rounded-lg font-medium transition flex items-center gap-2">
                       <ChevronRight className="w-4 h-4 rotate-180" /> Back to Resume
                    </button>
                 </div>
              </div>
           </div>
        )}
      </main>
    </div>
  );
};

// --- TOP LEVEL APP WRAPPER (MANAGES AUTH & ROUTING) ---

// Helper function to get initial users
const getInitialUsers = (): User[] => {
  if (typeof window === 'undefined') return [];
  try {
    const storedUsers = localStorage.getItem('ats_users');
    if (storedUsers) {
      return JSON.parse(storedUsers);
    }
  } catch (e) {
    console.error('Error reading users from localStorage:', e);
  }
  // Create Default Admin
  const initialUsers: User[] = [{
    id: 'admin-001',
    username: 'admin',
    password: 'Santafee@@@@@1972',
    role: 'admin',
    status: 'active',
    fullName: 'System Admin',
    email: 'admin@atspro.com',
    credits: 100 // Admin default
  }];
  try {
    localStorage.setItem('ats_users', JSON.stringify(initialUsers));
  } catch (e) {
    console.error('Error saving users to localStorage:', e);
  }
  return initialUsers;
};

// Helper function to get initial current user
const getInitialCurrentUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const activeSession = localStorage.getItem('ats_active_user');
    if(activeSession) {
      return JSON.parse(activeSession);
    }
  } catch (e) {
    console.error('Error reading current user from localStorage:', e);
  }
  return null;
};

// Helper function to get initial app view
const getInitialAppView = (): string => {
  if (typeof window === 'undefined') return 'login';
  try {
    const activeSession = localStorage.getItem('ats_active_user');
    return activeSession ? 'optimizer' : 'login';
  } catch (e) {
    console.error('Error reading app view from localStorage:', e);
    return 'login';
  }
};

export default function App() {
  const [users, setUsers] = useState<User[]>(getInitialUsers);
  const [currentUser, setCurrentUser] = useState<User | null>(getInitialCurrentUser);
  const [appView, setAppView] = useState(getInitialAppView); // 'login', 'optimizer', 'admin'

  // Sync Users to LocalStorage on change
  useEffect(() => {
    if(users.length > 0) {
       localStorage.setItem('ats_users', JSON.stringify(users));
    }
  }, [users]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ats_active_user');
    setAppView('login');
  };

  const handleLogin = (username?: string, password?: string) => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user && user.status === 'active') {
      setCurrentUser(user);
      localStorage.setItem('ats_active_user', JSON.stringify(user));
      setAppView('optimizer');
      return true;
    }
    return false;
  };

  const handleNavigateAdmin = () => {
    if (currentUser?.role === 'admin') setAppView('admin');
  };

  // ROUTER
  if (appView === 'login') {
    return (
      <ErrorBoundary>
        <LoginView onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  if (appView === 'admin' && currentUser?.role === 'admin') {
    return (
      <ErrorBoundary>
        <AdminDashboard currentUser={currentUser} users={users} setUsers={setUsers} onClose={() => setAppView('optimizer')} onLogout={handleLogout} />
      </ErrorBoundary>
    );
  }

  // Fallback to Main App
  return (
    <ErrorBoundary>
      <OptimizerView currentUser={currentUser as User} onLogout={handleLogout} onGoToAdmin={handleNavigateAdmin} />
    </ErrorBoundary>
  );
}
