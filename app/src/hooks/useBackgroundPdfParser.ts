import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Paper } from '../types';
import { extractTextFromPdf, extractDoiFromText, inferTitleFromText } from '../utils/pdfExtractor';

export function useBackgroundPdfParser() {
  const isParsing = useRef(false);

  useEffect(() => {
    // Poll every 5 seconds for unparsed papers
    const interval = setInterval(async () => {
      if (isParsing.current) return;

      try {
        isParsing.current = true;
        const unparsedPapers: Paper[] = await invoke('get_unparsed_papers');
        
        for (const paper of unparsedPapers) {
          try {
            console.log(`Extracting text for ${paper.title || paper.id}...`);
            const fileUrl = convertFileSrc(paper.path);
            const res = await fetch(fileUrl);
            if (!res.ok) {
              throw new Error(`Failed to fetch file: HTTP ${res.status}`);
            }
            const buffer = await res.arrayBuffer();
            const fullText = await extractTextFromPdf(new Uint8Array(buffer));
            
            // Only try to guess DOI/Title if they are currently unknown
            let title = null;
            let doi = null;
            
            if (!paper.doi) {
              doi = extractDoiFromText(fullText);
            }
            if (paper.title === 'Unknown' || !paper.title) {
              title = inferTitleFromText(fullText);
            }

            await invoke('save_paper_text', {
              paperId: paper.id,
              fullText,
              title,
              doi
            });
            console.log(`Successfully parsed and saved text for ${paper.title || paper.id}`);
          } catch (e) {
            console.error(`Failed to parse PDF for ${paper.id}:`, e);
          }
        }
      } catch (error) {
        console.error('Error fetching unparsed papers:', error);
      } finally {
        isParsing.current = false;
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);
}
