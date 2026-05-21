import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { ChatPanel } from "./ChatPanel";
import { Paper, Note } from "../types";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useState, useEffect, useRef, useMemo, memo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { extractTextFromPdf, extractDoiFromText, inferTitleFromText } from "../utils/pdfExtractor";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface LazyPageProps {
    pageNumber: number;
    pdfScale: number;
    pageRatiosRef: React.MutableRefObject<Record<number, number>>;
}

const LazyPage = memo(function LazyPage({ pageNumber, pdfScale, pageRatiosRef }: LazyPageProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isRendered, setIsRendered] = useState(false);
    const [ratio, setRatio] = useState(() => pageRatiosRef.current[pageNumber] || 1.414);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                const isPageIntersecting = entry.isIntersecting;
                setIsVisible(isPageIntersecting);
                if (!isPageIntersecting) {
                    setIsRendered(false);
                }
            },
            {
                rootMargin: "1200px 0px", // Preloads/keeps rendered ~1.5 pages above/below viewport
            }
        );

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    const height = 800 * pdfScale * ratio;
    const width = 800 * pdfScale;

    const handlePageLoadSuccess = (page: any) => {
        if (page.width && page.height) {
            const newRatio = page.height / page.width;
            pageRatiosRef.current[pageNumber] = newRatio;
            setRatio(newRatio);
        }
    };

    return (
        <div
            ref={elementRef}
            style={{
                width: `${width}px`,
                height: `${height}px`,
                contentVisibility: "auto",
                containIntrinsicSize: `${width}px ${height}px`,
                transform: 'translateZ(0)', // Force GPU composite layer promotion
            }}
            className="bg-white shadow-sm mb-4 relative flex items-center justify-center overflow-hidden"
        >
            {/* Optimized canvas container (no transitional layout changes or composite rendering blocks) */}
            {isVisible && (
                <div className="w-full h-full">
                    <Page
                        pageNumber={pageNumber}
                        renderAnnotationLayer
                        renderTextLayer
                        width={width}
                        devicePixelRatio={Math.min(window.devicePixelRatio, 1.5)} // Cap high-DPI scaling to prevent rendering lag
                        onLoadSuccess={handlePageLoadSuccess}
                        onRenderSuccess={() => setIsRendered(true)}
                        className="bg-white"
                        loading={null} // Suppress react-pdf default text loader
                    />
                </div>
            )}

            {/* Premium Loading Skeleton */}
            {!isRendered && (
                <div className="absolute inset-0 bg-white dark:bg-neutral-900 flex flex-col items-center justify-center p-6 space-y-4">
                    <div className="w-10 h-10 rounded-full border-4 border-neutral-200 dark:border-neutral-800 border-t-blue-500 animate-spin" />
                    <div className="text-neutral-400 dark:text-neutral-500 select-none text-sm font-medium animate-pulse">
                        Rendering Page {pageNumber}...
                    </div>
                </div>
            )}
        </div>
    );
});

interface ReaderProps {
    selectedPaper: Paper | null;
    onPaperUpdated?: (paper: Paper) => void;
}

export function Reader({ selectedPaper, onPaperUpdated }: ReaderProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [_pageNumber, _setPageNumber] = useState(1);
    const [selectedText, setSelectedText] = useState("");
    const [scale, setScale] = useState(1.0);
    const [pdfScale, setPdfScale] = useState(1.0);
    const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRatiosRef = useRef<Record<number, number>>({});

    const paperPath = selectedPaper?.path;
    const paperId = selectedPaper?.id;
    const selectedPaperRef = useRef(selectedPaper);

    useEffect(() => {
        selectedPaperRef.current = selectedPaper;
    }, [selectedPaper]);

    // Load PDF as ArrayBuffer using Tauri asset protocol + fetch
    useEffect(() => {
        pageRatiosRef.current = {};

        if (!paperPath) {
            setPdfData(null);
            return;
        }

        let isMounted = true;
        const fileUrl = convertFileSrc(paperPath);
        
        fetch(fileUrl)
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch file via asset protocol: HTTP ${res.status}`);
                }
                return res.arrayBuffer();
            })
            .then((buffer) => {
                if (isMounted) {
                    setPdfData(buffer);
                }
            })
            .catch((err) => {
                console.error("Failed to load PDF via asset protocol fetch:", err);
            });

        return () => {
            isMounted = false;
        };
    }, [paperPath]);

    // Memoize the document file object to keep references stable across renders
    const documentFile = useMemo(() => {
        return pdfData ? { data: pdfData } : null;
    }, [pdfData]);

    // On-demand text extraction
    useEffect(() => {
        if (!paperId || !pdfData) return;
        
        let isMounted = true;
        const checkAndExtract = async () => {
            try {
                const isParsed = await invoke<boolean>("check_paper_parsed", { id: paperId });
                if (!isParsed && isMounted) {
                    console.log("Paper not parsed, extracting text...", paperId);
                    const fullText = await extractTextFromPdf(new Uint8Array(pdfData));
                    if (isMounted) {
                        const currentPaper = selectedPaperRef.current;
                        if (!currentPaper) return;

                        let title = null;
                        let doi = null;
                        if (!currentPaper.doi) {
                            doi = extractDoiFromText(fullText);
                        }
                        if (currentPaper.title === 'Unknown' || !currentPaper.title) {
                            title = inferTitleFromText(fullText);
                        }
                        
                        await invoke("save_paper_text", {
                            paperId: paperId,
                            fullText: fullText,
                            title,
                            doi
                        });
                        console.log("Text extraction complete and saved.");
                        
                        const finalTitle = title || currentPaper.title;
                        const finalDoi = doi || currentPaper.doi;
                        if (onPaperUpdated && (finalTitle !== currentPaper.title || finalDoi !== currentPaper.doi)) {
                            onPaperUpdated({
                                ...currentPaper,
                                title: finalTitle,
                                doi: finalDoi,
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to check/extract paper text:", err);
            }
        };
        
        checkAndExtract();
        return () => {
            isMounted = false;
        };
    }, [paperId, pdfData, onPaperUpdated]);

    // Debounce pdfScale to prevent flickering on continuous zoom
    useEffect(() => {
        const t = setTimeout(() => {
            setPdfScale(scale);
        }, 200);
        return () => clearTimeout(t);
    }, [scale]);

    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });
    const [scrollPan, setScrollPan] = useState({ left: 0, top: 0 });

    // Handle Wheel Zoom (depends on paperId so it binds correctly when paper loads)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const zoomAmount = e.deltaY > 0 ? -0.1 : 0.1;
                setScale(prev => Math.max(0.5, Math.min(prev + zoomAmount, 3.0)));
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [paperId]);

    // Handle Keyboard Zoom
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+' || e.key === '-') {
                    e.preventDefault();
                    const zoomAmount = e.key === '-' ? -0.1 : 0.1;
                    setScale(prev => Math.max(0.5, Math.min(prev + zoomAmount, 3.0)));
                } else if (e.key === '0') {
                    e.preventDefault();
                    setScale(1.0);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, { passive: false });
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle Panning (Middle Click Drag)
    useEffect(() => {
        if (!isPanning) return;

        const scrollContainer = containerRef.current?.parentElement;
        if (!scrollContainer) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - startPan.x;
            const dy = e.clientY - startPan.y;
            scrollContainer.scrollLeft = scrollPan.left - dx;
            scrollContainer.scrollTop = scrollPan.top - dy;
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 1) { // Middle click release
                setIsPanning(false);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isPanning, startPan, scrollPan]);

    useEffect(() => {
        const handleMouseUp = (e: MouseEvent) => {
            const selection = window.getSelection();
            const text = selection?.toString().trim();
            
            if (text && selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                setSelectedText(text);
                
                if ('highlights' in CSS) {
                    try {
                        const highlight = new (window as any).Highlight(range);
                        (CSS as any).highlights.set('active-annotation', highlight);
                    } catch (err) {
                        console.error("Highlight API error:", err);
                    }
                }
            } else {
                const target = e.target as HTMLElement;
                const isInsideChatPanel = target.closest('.chat-panel-container');
                if (!isInsideChatPanel) {
                    setSelectedText("");
                    if ('highlights' in CSS) {
                        (CSS as any).highlights.delete('active-annotation');
                    }
                }
            }
        };
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            if ('highlights' in CSS) {
                (CSS as any).highlights.delete('active-annotation');
            }
        };
    }, []);

    const handleNoteClick = (note: Note) => {
        if (!note.anchorText) return;
        
        window.getSelection()?.removeAllRanges();
        
        let found = (window as any).find(note.anchorText, false, false, true, false, false, false);
        if (!found) {
            // Fallback: try finding first 30 chars
            const partial = note.anchorText.substring(0, 30);
            found = (window as any).find(partial, false, false, true, false, false, false);
        }
        
        if (found) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if ('highlights' in CSS) {
                    try {
                        const highlight = new (window as any).Highlight(range);
                        (CSS as any).highlights.set('active-annotation', highlight);
                    } catch (err) {
                        console.error("Highlight API error:", err);
                    }
                }
            }
        }
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        _setPageNumber(1);
    }

    const options = useMemo(() => ({
        cMapUrl: '/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/standard_fonts/',
    }), []);

    return (
        <div className="h-full w-full bg-neutral-100 dark:bg-neutral-950 flex">
            <PanelGroup orientation="horizontal" className="h-full w-full">
                <Panel defaultSize="70" minSize="50" className="h-full relative overflow-auto scroll-gpu">
                    {selectedPaper ? (
                        <div 
                            ref={containerRef} 
                            className={`w-max min-w-full flex flex-col items-center py-8 outline-none ${isPanning ? 'cursor-grabbing' : ''}`}
                            tabIndex={0}
                            onMouseDown={(e) => {
                                if (e.button === 1) { // Middle click
                                    e.preventDefault();
                                    const scrollContainer = containerRef.current?.parentElement;
                                    if (scrollContainer) {
                                        setIsPanning(true);
                                        setStartPan({ x: e.clientX, y: e.clientY });
                                        setScrollPan({ left: scrollContainer.scrollLeft, top: scrollContainer.scrollTop });
                                    }
                                }
                            }}
                        >
                            <div 
                                style={{ 
                                    transform: `scale(${scale / pdfScale})`, 
                                    transformOrigin: 'top center',
                                    transition: scale === pdfScale ? 'none' : 'transform 0.05s ease-out'
                                }}
                            >
                                {documentFile ? (
                                    <Document
                                        file={documentFile}
                                        options={options}
                                        onLoadSuccess={onDocumentLoadSuccess}
                                        className="shadow-lg flex flex-col gap-4"
                                        loading={<div className="p-8 text-neutral-500">Loading PDF...</div>}
                                        error={<div className="p-8 text-red-500">Failed to load PDF.</div>}
                                    >
                                        {Array.from(new Array(numPages || 0), (_, index) => (
                                            <LazyPage
                                                key={`page_${index + 1}`}
                                                pageNumber={index + 1}
                                                pdfScale={pdfScale}
                                                pageRatiosRef={pageRatiosRef}
                                            />
                                        ))}
                                    </Document>
                                ) : (
                                    <div className="p-8 text-neutral-500">Loading PDF data from disk...</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-neutral-400">
                            <div className="text-center">
                                <p className="text-xl font-semibold mb-2">PDF Viewer</p>
                                <p>Select a paper to render PDF here.</p>
                            </div>
                        </div>
                    )}
                </Panel>

                <PanelResizeHandle className="w-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-blue-500 transition-colors cursor-col-resize z-10" />

                <Panel id="chat-panel" defaultSize={30} minSize={20} className="h-full border-l border-neutral-200 dark:border-neutral-800">
                    <ChatPanel selectedPaper={selectedPaper} externalSelectedText={selectedText} onNoteClick={handleNoteClick} onPaperUpdated={onPaperUpdated} />
                </Panel>
            </PanelGroup>
        </div>
    );
}
