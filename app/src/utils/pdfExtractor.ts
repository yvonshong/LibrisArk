import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();


export async function extractTextFromPdf(source: string | Uint8Array): Promise<string> {
  const loadingTask = pdfjsLib.getDocument(source instanceof Uint8Array ? { data: source } : source);
  const pdf = await loadingTask.promise;
  
  try {
    const numPages = pdf.numPages;
    let fullText = '';
    
    // Extract text page by page
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
      // Help GC
      page.cleanup();
    }
    
    return fullText;
  } finally {
    pdf.destroy();
  }
}

export function extractDoiFromText(text: string): string | null {
  const doiRegex = /(?:doi\.org\/|DOI:\s*)(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;
  const match = text.match(doiRegex);
  return match ? match[1] : null;
}

// A simple heuristic for title: first few long lines that are not numbers or purely uppercase noise
export function inferTitleFromText(text: string): string | null {
  const lines = text.split('\n').filter(l => l.trim().length > 10);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (!/^\d/.test(line) && line.length > 20 && line.length < 200) {
      return line;
    }
  }
  return null;
}
