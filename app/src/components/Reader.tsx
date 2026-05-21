import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { ChatPanel } from "./ChatPanel";
import { Paper, Note } from "../types";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker using Vite's URL handling for offline support
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

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
    const containerRef = useRef<HTMLDivElement>(null);

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

    // Handle Wheel Zoom (depends on selectedPaper so it binds correctly when paper loads)
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
    }, [selectedPaper]);

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

    return (
        <div className="h-full w-full bg-neutral-100 dark:bg-neutral-950 flex">
            <PanelGroup orientation="horizontal" className="h-full w-full">
                <Panel defaultSize="70" minSize="50" className="h-full relative overflow-auto">
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
                                <Document
                                    file={convertFileSrc(selectedPaper.path)}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    className="shadow-lg flex flex-col gap-4"
                                    loading={<div className="p-8 text-neutral-500">Loading PDF...</div>}
                                >
                                    {Array.from(new Array(numPages || 0), (_, index) => (
                                        <Page
                                            key={`page_${index + 1}`}
                                            pageNumber={index + 1}
                                            renderAnnotationLayer
                                            renderTextLayer
                                            width={800 * pdfScale} // Apply debounced scale to react-pdf to prevent re-rendering flickers
                                            className="bg-white shadow-sm"
                                        />
                                    ))}
                                </Document>
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
