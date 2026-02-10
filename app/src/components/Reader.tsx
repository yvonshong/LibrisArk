import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { ChatPanel } from "./ChatPanel";
import { Paper } from "../types";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ReaderProps {
    selectedPaper: Paper | null;
}

export function Reader({ selectedPaper }: ReaderProps) {
    return (
        <div className="h-full w-full bg-neutral-100 dark:bg-neutral-950">
            <PanelGroup orientation="horizontal" className="h-full w-full">
                <Panel defaultSize="70" minSize="50" className="h-full">
                    {selectedPaper ? (
                        <iframe
                            src={convertFileSrc(selectedPaper.path)}
                            className="w-full h-full border-none"
                            title="PDF Viewer"
                        />
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
                    <ChatPanel />
                </Panel>
            </PanelGroup>
        </div>
    );
}
