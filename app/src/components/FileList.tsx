import { FileText, Search, SortAsc, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Paper } from "../types";
import { clsx } from "clsx";

interface FileListProps {
    onSelectPaper: (paper: Paper) => void;
    selectedPaperId?: string;
}

export function FileList({ onSelectPaper, selectedPaperId }: FileListProps) {
    const [papers, setPapers] = useState<Paper[]>([]);

    const fetchPapers = async () => {
        try {
            console.log("Fetching papers...");
            const result = await invoke<Paper[]>("get_papers");
            console.log("Helper fetched:", result);
            setPapers(result);
        } catch (error) {
            console.error("Failed to fetch papers:", error);
        }
    };

    useEffect(() => {
        fetchPapers();

        const unlistenPromise = listen("library-update", (event) => {
            console.log("Library updated event:", event);
            fetchPapers();
        });

        return () => {
            unlistenPromise.then(unlisten => unlisten());
        };
    }, []);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-neutral-950">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    <input
                        className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 pl-9 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-800"
                        placeholder="Search papers..."
                    />
                </div>
                <button
                    onClick={fetchPapers}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md"
                    title="Refresh List"
                >
                    <RefreshCw size={18} className="text-neutral-500" />
                </button>
                <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md">
                    <SortAsc size={18} className="text-neutral-500" />
                </button>
            </div>

            <div className="flex-1 overflow-auto">
                {papers.length === 0 ? (
                    <div className="p-8 text-center text-neutral-500">
                        No papers found. Check your library path in Settings.
                    </div>
                ) : (
                    papers.map(paper => (
                        <div
                            key={paper.id}
                            onClick={() => onSelectPaper(paper)}
                            className={clsx(
                                "p-4 border-b border-neutral-100 dark:border-neutral-900 cursor-pointer group transition-colors",
                                selectedPaperId === paper.id
                                    ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500"
                                    : "hover:bg-neutral-50 dark:hover:bg-neutral-900 border-l-4 border-l-transparent"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className={clsx(
                                    "mt-1 p-2 rounded",
                                    selectedPaperId === paper.id
                                        ? "bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300"
                                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                                )}>
                                    <FileText size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className={clsx(
                                        "font-medium transition-colors truncate",
                                        selectedPaperId === paper.id
                                            ? "text-blue-700 dark:text-blue-300"
                                            : "text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                                    )}>
                                        {paper.title || paper.path.split('/').pop()}
                                    </h3>
                                    <p className="text-sm text-neutral-500 mt-1 truncate">
                                        {paper.path}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
