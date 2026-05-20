import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { FileList } from "./components/FileList";
import { Reader } from "./components/Reader";
import { Settings } from "./components/Settings";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { LibraryFilter, Paper } from "./types";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [currentView, setCurrentView] = useState<"library" | "settings">("library");
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

  return (
    <div className="h-screen w-screen overflow-hidden bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 flex flex-col">
      <PanelGroup orientation="horizontal" className="h-full w-full font-sans">
        <Panel defaultSize="20" minSize="15" maxSize="30" className="h-full border-r border-neutral-200 dark:border-neutral-800">
          <Sidebar
            currentView={currentView}
            onViewChange={setCurrentView}
            filter={libraryFilter}
            onFilterChange={setLibraryFilter}
          />
        </Panel>

        <PanelResizeHandle className="w-1 bg-transparent hover:bg-blue-500 transition-colors cursor-col-resize z-10 -ml-0.5 relative" />

        {currentView === "library" ? (
          <>
            <Panel defaultSize="30" minSize="20" maxSize="40" className="h-full border-r border-neutral-200 dark:border-neutral-800">
              <FileList
                onSelectPaper={setSelectedPaper}
                selectedPaperId={selectedPaper?.id}
                filter={libraryFilter}
              />
            </Panel>

            <PanelResizeHandle className="w-1 bg-transparent hover:bg-blue-500 transition-colors cursor-col-resize z-10 -ml-0.5 relative" />

            <Panel defaultSize="50" minSize="30" className="h-full">
              <Reader selectedPaper={selectedPaper} />
            </Panel>
          </>
        ) : (
          <Panel defaultSize="80" className="h-full">
            <Settings />
          </Panel>
        )}
      </PanelGroup>
    </div>
  );
}

export default App;
