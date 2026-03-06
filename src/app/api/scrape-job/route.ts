import { NextRequest, NextResponse } from "next/server";
import * as cheerio from 'cheerio';
export const runtime = 'edge';

// Web scraping without AI - uses Cheerio for HTML parsing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Fetch the page with proper headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return NextResponse.json({ 
        error: `Failed to fetch page (${response.status}). The site may be blocking automated access.\n\nPlease copy-paste the job description manually.` 
      }, { status: 400 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, iframe, noscript, [role="navigation"], [role="banner"], [role="contentinfo"]').remove();

    // Extract job details based on common job board patterns
    let jobTitle = '';
    let company = '';
    let location = '';
    let description = '';
    let requirements = '';

    // Platform-specific extraction
    
    // LinkedIn
    if (url.includes('linkedin.com')) {
      jobTitle = $('h1.top-card-layout__title, .job-details-jobs-unified-top-card__job-title, h1[class*="job-title"]').first().text().trim();
      company = $('.top-card-layout__card .topcard__org-name, .job-details-jobs-unified-top-card__company-name, a[class*="company-name"]').first().text().trim();
      location = $('.top-card-layout__card .topcard__flavor--bullet, .job-details-jobs-unified-top-card__primary-description-container span').first().text().trim();
      description = $('.show-more-less-html__markup, .jobs-description-content, div[class*="jobs-description"]').text().trim();
    }
    // Indeed
    else if (url.includes('indeed.com')) {
      jobTitle = $('h1[data-testid="jobsearch-JobInfoHeader-title"], .jobsearch-JobInfoHeader-title, h1.job-title').first().text().trim();
      company = $('[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyRating-companyHeader a, span.company').first().text().trim();
      location = $('[data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle div, span.location').first().text().trim();
      description = $('#jobDescriptionText, .jobsearch-JobComponent-description, #jobDescriptionSection').text().trim();
    }
    // Glassdoor
    else if (url.includes('glassdoor.com')) {
      jobTitle = $('.css-1vg6q84, h1[class*="JobDetails_jobTitle"], .job-title').first().text().trim();
      company = $('.employer-name, [class*="EmployerProfile_employerName"], span.company').first().text().trim();
      location = $('.location, [class*="JobDetails_location"]').first().text().trim();
      description = $('.jobDescriptionContent, [class*="JobDetails_jobDescription"], .desc').text().trim();
    }
    // ZipRecruiter
    else if (url.includes('ziprecruiter.com')) {
      jobTitle = $('h1.job_title, .job-title, h1[class*="title"]').first().text().trim();
      company = $('.hiring_company_text, .company-name, span[class*="company"]').first().text().trim();
      location = $('.job_location, .location, span[class*="location"]').first().text().trim();
      description = $('.jobDescriptionSection, .job-description, article').text().trim();
    }
    // Monster
    else if (url.includes('monster.com')) {
      jobTitle = $('h1.JobViewTitle, .job-title, h1').first().text().trim();
      company = $('.company-name, [data-testid="company-name"], span.company').first().text().trim();
      location = $('.location, [data-testid="location"]').first().text().trim();
      description = $('.job-description, [data-testid="job-description"], article').text().trim();
    }
    // Google Careers
    else if (url.includes('careers.google.com')) {
      jobTitle = $('h1, .job-title').first().text().trim();
      company = 'Google';
      location = $('.location, span[class*="location"]').first().text().trim();
      description = $('.job-description, article, main').text().trim();
    }
    // Generic extraction for other sites
    else {
      // Try common job title selectors
      jobTitle = $('h1, .job-title, [class*="job-title"], [class*="JobTitle"], [itemprop="title"]').first().text().trim();
      
      // Try common company selectors
      company = $('[class*="company"], [class*="Company"], [itemprop="hiringOrganization"], [itemprop="name"]').first().text().trim();
      
      // Try common location selectors
      location = $('[class*="location"], [class*="Location"], [itemprop="jobLocation"], [itemprop="address"]').first().text().trim();
      
      // Try common description selectors
      description = $('[itemprop="description"], [class*="description"], [class*="Description"], article, main, .content').first().text().trim();
    }

    // Fallback: Get all text from body if description is empty
    if (!description || description.length < 50) {
      description = $('body').text()
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();
    }

    // Clean up extracted text
    jobTitle = cleanText(jobTitle);
    company = cleanText(company);
    location = cleanText(location);
    description = cleanText(description);

    // Extract requirements from description
    requirements = extractRequirements(description);

    // Build formatted job description
    let formattedJob = '';
    if (jobTitle) formattedJob += `Job Title: ${jobTitle}\n`;
    if (company) formattedJob += `Company: ${company}\n`;
    if (location) formattedJob += `Location: ${location}\n`;
    formattedJob += '\n--- Job Description ---\n';
    if (description) formattedJob += description + '\n';
    if (requirements) formattedJob += '\n--- Key Requirements ---\n' + requirements;

    if (!formattedJob || formattedJob.length < 50) {
      return NextResponse.json({ 
        error: "Could not extract job details from this page.\n\nPlease copy-paste the job description manually." 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      text: formattedJob,
      jobTitle,
      company,
      location,
      description: description.substring(0, 5000), // Limit description length
      requirements
    });

  } catch (error: any) {
    console.error("Job Scrape Error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch job details: " + (error.message || "Unknown error") + "\n\nPlease copy-paste the job description manually." 
    }, { status: 500 });
  }
}

// Clean extracted text
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable chars
    .replace(/\n{3,}/g, '\n\n')     // Limit consecutive newlines
    .trim();
}

// Extract requirements section from job description
function extractRequirements(text: string): string {
  const keywords = [
    'requirements', 'qualifications', 'skills', 'experience', 'education',
    'must have', 'required', 'preferred', 'nice to have', 'competencies'
  ];
  
  const lines = text.split('\n');
  const requirements: string[] = [];
  let inRequirementsSection = false;
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Check if we're entering a requirements section
    if (keywords.some(kw => lowerLine.includes(kw) && lowerLine.length < 100)) {
      inRequirementsSection = true;
    }
    
    // Check if we're leaving a requirements section (new section header)
    if (inRequirementsSection && /^[A-Z][a-z]+:?\s*$/.test(line.trim())) {
      if (!keywords.some(kw => lowerLine.includes(kw))) {
        inRequirementsSection = false;
      }
    }
    
    if (inRequirementsSection && line.trim().length > 5) {
      requirements.push(line.trim());
    }
  }
  
  return requirements.slice(0, 15).join('\n'); // Limit to 15 items
}
