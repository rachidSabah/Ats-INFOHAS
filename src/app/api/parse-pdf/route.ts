import { NextRequest, NextResponse } from "next/server";
import pako from 'pako';

// Universal file parser - handles PDF, DOCX, TXT with proper compression support
export const runtime = 'edge';

// ─────────────────────────────────────────────────────────────────────────────
// PDF TEXT EXTRACTION - With FlateDecode Decompression Support
// ─────────────────────────────────────────────────────────────────────────────

// Decompress FlateDecode streams using pako
function decompressFlate(buffer: Uint8Array): string | null {
  try {
    const decompressed = pako.inflate(buffer, { to: 'string' });
    return decompressed;
  } catch (e) {
    // Try raw deflate
    try {
      const decompressed = pako.inflateRaw(buffer, { to: 'string' });
      return decompressed;
    } catch (e2) {
      return null;
    }
  }
}

// Extract and decompress streams from PDF
function extractCompressedStreams(content: string, rawBuffer: Buffer): string[] {
  const textParts: string[] = [];
  
  // Find all stream objects
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]endstream/g;
  let match;
  
  while ((match = streamRegex.exec(content)) !== null) {
    const streamStart = match.index;
    const streamContent = match[1];
    
    // Check if stream is FlateDecode
    const beforeStream = content.substring(Math.max(0, streamStart - 500), streamStart);
    const isFlateDecode = beforeStream.includes('/FlateDecode');
    
    if (isFlateDecode) {
      // Find the raw stream bytes
      const streamStartMarker = content.indexOf('stream', streamStart);
      const streamEndMarker = content.indexOf('endstream', streamStartMarker);
      
      if (streamStartMarker !== -1 && streamEndMarker !== -1) {
        // Get the byte offset
        let byteOffset = 0;
        for (let i = 0; i < streamStartMarker; i++) {
          byteOffset++;
          if (content[i] === '\r' || content[i] === '\n') {
            // Skip newline after 'stream'
          }
        }
        
        // Extract raw bytes after 'stream\n' or 'stream\r\n'
        let startPos = streamStartMarker + 6; // 'stream'.length
        if (content[startPos] === '\r') startPos++;
        if (content[startPos] === '\n') startPos++;
        
        let endPos = streamEndMarker;
        
        // Get the compressed bytes
        const compressedBytes = rawBuffer.slice(startPos, endPos);
        
        try {
          const decompressed = decompressFlate(new Uint8Array(compressedBytes));
          if (decompressed) {
            // Extract text from decompressed content
            const textMatches = decompressed.match(/\(([^)]+)\)/g) || [];
            for (const tm of textMatches) {
              const text = tm.slice(1, -1);
              if (text && /[a-zA-Z0-9]/.test(text)) {
                textParts.push(decodePdfString(text));
              }
            }
          }
        } catch (e) {
          // Decompression failed
        }
      }
    } else {
      // Uncompressed stream - try to extract text directly
      const textMatches = streamContent.match(/\(([^)]+)\)/g) || [];
      for (const tm of textMatches) {
        const text = tm.slice(1, -1);
        if (text && /[a-zA-Z0-9]/.test(text)) {
          textParts.push(decodePdfString(text));
        }
      }
    }
  }
  
  return textParts;
}

// Extract text from BT/ET blocks
function extractBTETBlocks(content: string): string[] {
  const textParts: string[] = [];
  
  const btetRegex = /BT[\s\S]*?ET/g;
  let blockMatch;
  
  while ((blockMatch = btetRegex.exec(content)) !== null) {
    const block = blockMatch[0];
    
    // TJ arrays: [(text) -10 (text2)] TJ
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjMatch;
    while ((tjMatch = tjArrayRegex.exec(block)) !== null) {
      const arrayContent = tjMatch[1];
      const textItems = arrayContent.match(/\(([^)]*)\)/g) || [];
      for (const item of textItems) {
        const text = item.slice(1, -1);
        if (text && /[a-zA-Z0-9]/.test(text)) {
          textParts.push(decodePdfString(text));
        }
      }
    }
    
    // Simple Tj: (text) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch2;
    while ((tjMatch2 = tjRegex.exec(block)) !== null) {
      const text = tjMatch2[1];
      if (text && /[a-zA-Z0-9]/.test(text)) {
        textParts.push(decodePdfString(text));
      }
    }
  }
  
  return textParts;
}

// Decode PDF string escape sequences
function decodePdfString(raw: string): string {
  if (!raw) return '';
  
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => {
      try {
        return String.fromCharCode(parseInt(oct, 8));
      } catch {
        return '';
      }
    })
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

// Clean extracted text
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if text is valid
function isValidText(text: string): boolean {
  if (!text || text.length < 30) return false;
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 10) return false;
  const letters = (text.match(/[a-zA-Z]/g) || []).length;
  return letters / text.length > 0.3;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle FormData
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      const lowerName = file.name.toLowerCase();
      const mimeType = file.type || '';
      return await processFile(arrayBuffer, lowerName, mimeType, file.name);
    }

    // Handle JSON body
    const body = await request.json();
    const { fileBase64, pdfBase64, fileName, fileType } = body;
    const base64Data = fileBase64 || pdfBase64;
    
    if (!base64Data) {
      return NextResponse.json({ error: 'No file data provided.' }, { status: 400 });
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const arrayBuffer = bytes.buffer;
    const lowerName = (fileName || 'file.pdf').toLowerCase();
    const mimeType = fileType || '';
    return await processFile(arrayBuffer, lowerName, mimeType, fileName || 'uploaded-file');

  } catch (error: any) {
    console.error('[parse-pdf] Error:', error);
    return NextResponse.json({ error: 'File parsing failed: ' + error.message }, { status: 500 });
  }
}

async function processFile(
  arrayBuffer: ArrayBuffer,
  lowerName: string,
  mimeType: string,
  originalName: string
): Promise<NextResponse> {
  
  // ─── PDF ───────────────────────────────────────────────────────────────────
  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    
    // Verify PDF header
    const header = new Uint8Array(arrayBuffer.slice(0, 5));
    if (String.fromCharCode(...header) !== '%PDF-') {
      return NextResponse.json({ error: 'Not a valid PDF file.' }, { status: 400 });
    }

    const buffer = Buffer.from(arrayBuffer);
    const content = buffer.toString('latin1');
    
    let allTextParts: string[] = [];
    
    // Strategy 1: Extract from compressed streams (FlateDecode)
    const compressedText = extractCompressedStreams(content, buffer);
    allTextParts.push(...compressedText);
    
    // Strategy 2: Extract from BT/ET blocks
    const btetText = extractBTETBlocks(content);
    allTextParts.push(...btetText);
    
    // Combine and clean
    let text = allTextParts.join(' ');
    text = cleanText(text);

    if (!isValidText(text)) {
      // Check for image-based PDF indicators
      const hasImages = content.includes('/Image') || content.includes('/DCTDecode');
      const hasFonts = content.includes('/Font');
      
      let errorMsg = 'Could not extract text from this PDF.\n\n';
      
      if (hasImages && !hasFonts) {
        errorMsg += 'This appears to be a scanned/image-based PDF.\n\n';
      } else if (content.includes('/Encrypt')) {
        errorMsg += 'This PDF is password-protected.\n\n';
      } else {
        errorMsg += 'The PDF may use special encoding.\n\n';
      }
      
      errorMsg += 'Solutions:\n';
      errorMsg += '1. Save your resume as DOCX and upload that instead\n';
      errorMsg += '2. Copy and paste your resume text directly\n';
      errorMsg += '3. Try "Print to PDF" to create a simpler PDF';
      
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({
      text,
      chars: text.length,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      _parser: 'server-flate-decode',
      _fileType: 'pdf'
    });
  }

  // ─── DOCX ──────────────────────────────────────────────────────────────────
  if (lowerName.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
    try {
      const mammoth = await import('mammoth');
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || '').trim();
      
      if (!text || text.length < 10) {
        return NextResponse.json({ error: 'DOCX appears empty or corrupted.' }, { status: 400 });
      }
      
      return NextResponse.json({
        text,
        chars: text.length,
        wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
        _parser: 'mammoth',
        _fileType: 'docx'
      });
    } catch (e: any) {
      return NextResponse.json({ error: 'Failed to parse DOCX: ' + e.message }, { status: 500 });
    }
  }

  // ─── TXT ───────────────────────────────────────────────────────────────────
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || mimeType === 'text/plain') {
    const buffer = Buffer.from(arrayBuffer);
    const text = buffer.toString('utf-8').trim();
    
    if (!text || text.length < 5) {
      return NextResponse.json({ error: 'Text file is empty.' }, { status: 400 });
    }
    
    return NextResponse.json({
      text,
      chars: text.length,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      _parser: 'text-raw',
      _fileType: 'txt'
    });
  }

  return NextResponse.json({
    error: `Unsupported file type: "${originalName}"\n\nSupported: PDF, DOCX, TXT`
  }, { status: 400 });
}
