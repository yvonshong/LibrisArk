import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { FileList } from "./components/FileList";
import { Reader } from "./components/Reader";
import { Settings } from "./components/Settings";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels";
import { LibraryFilter, Paper } from "./types";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [currentView, setCurrentView] = useState<"library" | "tags" | "search" | "settings">("library");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>({ kind: "all", value: null });

  useEffect(() => {
    if (!selectedPaper) return;

    const unlistenPromise = listen("library-update", async () => {
      try {
        const papers = await invoke<Paper[]>("get_papers");
        const found = papers.find(p => p.id === selectedPaper.id);
        if (found) {
          setSelectedPaper(found);
        }
      } catch (e) {
        console.error("Failed to refresh selected paper:", e);
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [selectedPaper?.id]);

  const fileListPanelRef = useRef<ImperativePanelHandle>(null);

  return (
    <div className="h-screen w-screen overflow-hidden bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 flex">
      <div className="h-full shrink-0 z-10">
        <Sidebar
          currentView={currentView}
          onViewChange={(view) => {
            setCurrentView(view);
            if (view !== "settings") {
              setLibraryFilter({ kind: "all", value: null });
            }
            fileListPanelRef.current?.expand();
          }}
        />
      </div>

      <div className="flex-1 min-w-0 h-full">
        {/* @ts-ignore */}
        <PanelGroup autoSaveId="librisark-layout-v5" orientation="horizontal" className="h-full w-full font-sans">
          {currentView === "settings" ? (
            <Panel id="settings-panel" defaultSize={100} className="h-full overflow-hidden">
              <Settings />
            </Panel>
          ) : (
            <>
              <Panel id="file-list-panel" ref={fileListPanelRef} defaultSize={30} minSize={15} collapsible={true} className="h-full border-r border-neutral-200 dark:border-neutral-800 overflow-hidden">
                <FileList
                  onSelectPaper={setSelectedPaper}
                  selectedPaperId={selectedPaper?.id}
                  filter={libraryFilter}
                  onFilterChange={setLibraryFilter}
                  currentView={currentView}
                />
              </Panel>

              <PanelResizeHandle className="w-2 bg-transparent hover:bg-blue-500/50 transition-colors cursor-col-resize z-10 -ml-1 relative flex items-center justify-center">
                <div className="w-0.5 h-8 bg-neutral-300 dark:bg-neutral-700 rounded-full" />
              </PanelResizeHandle>

              <Panel id="reader-panel" defaultSize={70} minSize={20} className="h-full">
                <Reader selectedPaper={selectedPaper} onPaperUpdated={setSelectedPaper} />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}

export default App;
