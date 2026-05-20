import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { ChatPanel } from "./ChatPanel";
import { Paper } from "../types";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker to point to CDN (for ease of setup without a bundler headache in Vite)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ReaderProps {
    selectedPaper: Paper | null;
}

export function Reader({ selectedPaper }: ReaderProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [_pageNumber, _setPageNumber] = useState(1);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        _setPageNumber(1);
    }

    return (
        <div className="h-full w-full bg-neutral-100 dark:bg-neutral-950 flex">
            <PanelGroup orientation="horizontal" className="h-full w-full">
                <Panel defaultSize="70" minSize="50" className="h-full relative overflow-y-auto">
                    {selectedPaper ? (
                        <div className="w-full flex justify-center py-8">
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
                                        width={800} // A decent readable width
                                        className="bg-white"
                                    />
                                ))}
                            </Document>
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

                <Panel defaultSize="30" minSize="20" maxSize="50" className="h-full border-l border-neutral-200 dark:border-neutral-800">
                    <ChatPanel selectedPaper={selectedPaper} />
                </Panel>
            </PanelGroup>
        </div>
    );
}
