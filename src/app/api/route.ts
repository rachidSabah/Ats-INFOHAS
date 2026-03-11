import { NextResponse } from "next/server";

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    app: "ATS Resume Optimizer",
    version: "2.0",
    endpoints: {
      ai: "/api/ai",
      parsePdf: "/api/parse-pdf",
      scrapeJob: "/api/scrape-job"
    }
  });
}