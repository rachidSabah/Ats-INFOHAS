import { NextRequest, NextResponse } from "next/server";

export const runtime = 'edge';

// Structured job data interface
interface StructuredJobData {
  title: string;
  company: string;
  location: string;
  description: string;
  employmentType: string;
  salary: string;
}

// Pure edge-compatible job scraping without cheerio
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

    // Try multiple fetch strategies
    let html = '';
    let fetchError = '';

    // Strategy 1: Direct fetch with browser headers
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        redirect: 'follow',
      });

      if (response.ok) {
        html = await response.text();
      } else {
        fetchError = `HTTP ${response.status}`;
      }
    } catch (e: any) {
      fetchError = e.message;
    }

    // Strategy 2: Try with different User-Agent if first failed
    if (!html) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,*/*',
            'Accept-Language': 'en-GB,en;q=0.9',
          },
          redirect: 'follow',
        });

        if (response.ok) {
          html = await response.text();
        }
      } catch (e) {
        // Continue with error handling
      }
    }

    if (!html) {
      return NextResponse.json({ 
        error: `Could not fetch the page (${fetchError || 'blocked'}). The site may be blocking automated access.\n\nPlease copy-paste the job description manually.`,
        fallback: true
      }, { status: 200 });
    }

    // Remove script and style tags with content
    let cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Extract metadata from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';

    // Extract JSON-LD structured data (most reliable for job postings)
    const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    let structuredJob: StructuredJobData | null = null;
    
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const data = JSON.parse(jsonStr);
          
          // Check for JobPosting schema
          const jobData: any = Array.isArray(data) ? data.find((d: any) => d['@type'] === 'JobPosting') : 
                          data['@type'] === 'JobPosting' ? data : 
                          data['@graph']?.find((d: any) => d['@type'] === 'JobPosting');
          
          if (jobData) {
            structuredJob = {
              title: jobData.title || '',
              company: jobData.hiringOrganization?.name || jobData.employer?.name || '',
              location: jobData.jobLocation?.address?.addressLocality || 
                       jobData.jobLocation?.address?.addressRegion ||
                       jobData.jobLocation || '',
              description: jobData.description || '',
              employmentType: jobData.employmentType || '',
              salary: jobData.baseSalary?.value?.value || jobData.baseSalary || '',
            };
            break;
          }
        } catch (e) {
          // Continue to next match
        }
      }
    }

    // Extract Open Graph and meta tags
    const ogTitle = extractMetaContent(html, 'og:title') || extractMetaContent(html, 'twitter:title');
    const ogDescription = extractMetaContent(html, 'og:description') || extractMetaContent(html, 'twitter:description');
    const metaDescription = extractMetaContent(html, 'description');

    // Platform-specific extraction using regex
    let jobTitle = '';
    let company = '';
    let location = '';
    let description = '';

    // LinkedIn
    if (url.includes('linkedin.com')) {
      jobTitle = extractByPatterns(cleanHtml, [
        /<h1[^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>([^<]+)<\/h1>/i,
        /<h1[^>]*class="[^"]*job-title[^"]*"[^>]*>([^<]+)<\/h1>/i,
        /<h1[^>]*>([^<]*(?:engineer|manager|developer|analyst|specialist|director|coordinator)[^<]*)<\/h1>/i,
      ]);
      company = extractByPatterns(cleanHtml, [
        /class="[^"]*topcard__org-name[^"]*"[^>]*>([^<]+)</i,
        /class="[^"]*company-name[^"]*"[^>]*>([^<]+)</i,
        /alt="([^"]+ logo)"/i,
      ]);
      location = extractByPatterns(cleanHtml, [
        /class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>([^<]+)</i,
        /class="[^"]*job-location[^"]*"[^>]*>([^<]+)</i,
      ]);
      description = extractByPatterns(cleanHtml, [
        /class="[^"]*jobs-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ]);
    }
    // Indeed
    else if (url.includes('indeed.com')) {
      jobTitle = extractByPatterns(cleanHtml, [
        /data-testid="jobsearch-JobInfoHeader-title"[^>]*>([^<]+)</i,
        /class="[^"]*jobsearch-JobInfoHeader-title[^"]*"[^>]*>([^<]+)</i,
        /<h1[^>]*>([^<]*(?:job|engineer|manager|developer|analyst)[^<]*)<\/h1>/i,
      ]);
      company = extractByPatterns(cleanHtml, [
        /data-testid="inlineHeader-companyName"[^>]*>([^<]+)</i,
        /class="[^"]*company[^"]*"[^>]*>([^<]+)</i,
      ]);
      location = extractByPatterns(cleanHtml, [
        /data-testid="job-location"[^>]*>([^<]+)</i,
        /class="[^"]*location[^"]*"[^>]*>([^<]+)</i,
      ]);
      description = extractByPatterns(cleanHtml, [
        /id="jobDescriptionText"[^>]*>([\s\S]*?)<\/div>/i,
        /class="[^"]*jobsearch-JobComponent-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ]);
    }
    // Glassdoor
    else if (url.includes('glassdoor.com')) {
      jobTitle = extractByPatterns(cleanHtml, [
        /class="[^"]*JobDetails_jobTitle[^"]*"[^>]*>([^<]+)</i,
        /class="[^"]*css-1vg6q84[^"]*"[^>]*>([^<]+)</i,
      ]);
      company = extractByPatterns(cleanHtml, [
        /class="[^"]*EmployerProfile_employerName[^"]*"[^>]*>([^<]+)</i,
        /class="[^"]*employer-name[^"]*"[^>]*>([^<]+)</i,
      ]);
      description = extractByPatterns(cleanHtml, [
        /class="[^"]*JobDetails_jobDescription[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /class="[^"]*jobDescriptionContent[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ]);
    }
    // Reed UK
    else if (url.includes('reed.co.uk')) {
      jobTitle = extractByPatterns(cleanHtml, [
        /class="[^"]*job-title[^"]*"[^>]*>([^<]+)</i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
      ]);
      company = extractByPatterns(cleanHtml, [
        /class="[^"]*company[^"]*"[^>]*>([^<]+)</i,
        /alt="([^"]+ logo)"/i,
      ]);
      description = extractByPatterns(cleanHtml, [
        /class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /itemprop="description"[^>]*>([\s\S]*?)<\/div>/i,
      ]);
    }
    // TotalJobs
    else if (url.includes('totaljobs.com')) {
      jobTitle = extractByPatterns(cleanHtml, [
        /class="[^"]*job-title[^"]*"[^>]*>([^<]+)</i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
      ]);
      description = extractByPatterns(cleanHtml, [
        /class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ]);
    }
    // Generic extraction
    else {
      // Try h1 for job title
      const h1Match = cleanHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        jobTitle = decodeHtmlEntities(h1Match[1].trim());
      }
      
      // Try article or main for description
      description = extractByPatterns(cleanHtml, [
        /<article[^>]*>([\s\S]*?)<\/article>/i,
        /<main[^>]*>([\s\S]*?)<\/main>/i,
        /role="main"[^>]*>([\s\S]*?)<\/div>/i,
        /class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ]);
    }

    // Use structured data if available (most reliable)
    if (structuredJob) {
      jobTitle = jobTitle || structuredJob.title;
      company = company || structuredJob.company;
      location = location || structuredJob.location;
      description = description || stripHtml(structuredJob.description);
    }

    // Fallback to meta tags
    if (!jobTitle) {
      jobTitle = ogTitle || pageTitle.split('|')[0].split('-')[0].trim();
    }
    if (!description) {
      description = ogDescription || metaDescription || '';
    }

    // Extract text content from HTML
    if (!description || description.length < 100) {
      description = extractTextContent(cleanHtml);
    }

    // Clean up
    jobTitle = cleanText(jobTitle);
    company = cleanText(company);
    location = cleanText(location);
    description = cleanText(stripHtml(description));

    // Extract requirements
    const requirements = extractRequirements(description);

    // Build formatted output
    let formattedJob = '';
    if (jobTitle) formattedJob += `Job Title: ${jobTitle}\n`;
    if (company) formattedJob += `Company: ${company}\n`;
    if (location) formattedJob += `Location: ${location}\n`;
    formattedJob += '\n--- Job Description ---\n';
    if (description) formattedJob += description.substring(0, 8000) + '\n';
    if (requirements) formattedJob += '\n--- Key Requirements ---\n' + requirements;

    if (!formattedJob || formattedJob.length < 100) {
      return NextResponse.json({ 
        error: "Could not extract job details from this page. The site may require JavaScript or block automated access.\n\nPlease copy-paste the job description manually.",
        fallback: true
      }, { status: 200 });
    }

    return NextResponse.json({ 
      text: formattedJob,
      jobTitle,
      company,
      location,
      description: description.substring(0, 5000),
      requirements,
      source: structuredJob ? 'structured-data' : 'html-extraction'
    });

  } catch (error: any) {
    console.error("Job Scrape Error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch job details: " + (error.message || "Unknown error") + "\n\nPlease copy-paste the job description manually.",
      fallback: true
    }, { status: 200 });
  }
}

// Helper functions
function extractMetaContent(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]*property="${name}"[^>]*content="([^"]+)"`, 'i'),
    new RegExp(`<meta[^>]*content="([^"]+)"[^>]*property="${name}"`, 'i'),
    new RegExp(`<meta[^>]*name="${name}"[^>]*content="([^"]+)"`, 'i'),
    new RegExp(`<meta[^>]*content="([^"]+)"[^>]*name="${name}"`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtmlEntities(match[1].trim());
  }
  return '';
}

function extractByPatterns(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }
  return '';
}

function extractTextContent(html: string): string {
  // Remove all tags and get text
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n');
  
  return decodeHtmlEntities(text.trim());
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'");
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\x20-\x7E\n\r]/g, '')
    .trim();
}

function extractRequirements(text: string): string {
  const keywords = [
    'requirements', 'qualifications', 'skills', 'experience', 'education',
    'must have', 'required', 'preferred', 'competencies', 'what you need',
    'what we look for', 'ideal candidate', 'key responsibilities'
  ];
  
  const lines = text.split('\n');
  const requirements: string[] = [];
  let inRequirementsSection = false;
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    
    if (keywords.some(kw => lowerLine.includes(kw)) && lowerLine.length < 100) {
      inRequirementsSection = true;
    }
    
    if (inRequirementsSection && line.trim().length > 5) {
      requirements.push(line.trim());
    }
    
    // Stop at next major section
    if (inRequirementsSection && /^([A-Z][a-z]+\s*:|Benefits|About Us|Why Join)/.test(line.trim())) {
      if (!keywords.some(kw => lowerLine.includes(kw))) {
        break;
      }
    }
  }
  
  return requirements.slice(0, 15).join('\n');
}
