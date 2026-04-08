import { FileText, Search, SortAsc, RefreshCw, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LibraryFilter, Paper } from "../types";
import { clsx } from "clsx";

interface FileListProps {
    onSelectPaper: (paper: Paper) => void;
    selectedPaperId?: string;
    filter: LibraryFilter;
}

interface RenamePreview {
    id: string;
    oldPath: string;
    newName: string;
    newPath: string;
}

export function FileList({ onSelectPaper, selectedPaperId, filter }: FileListProps) {
    const [papers, setPapers] = useState<Paper[]>([]);
    const [isEnriching, setIsEnriching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [renameTemplate, setRenameTemplate] = useState("{Author}_{Year}_{Title}.pdf");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fetchPapers = async () => {
        try {
            console.log("Fetching papers...");
            const result = await invoke<Paper[]>("get_papers_filtered", {
                filterKind: filter.kind === "all" ? null : filter.kind,
                filterValue: filter.value,
                search: searchTerm.trim() ? searchTerm.trim() : null
            });
            console.log("Helper fetched:", result);
            setPapers(result);
        } catch (error) {
            console.error("Failed to fetch papers:", error);
        }
    };

    useEffect(() => {
        fetchPapers();

        const unlistenPromise = listen("library-update", async (event) => {
            console.log("Library updated event:", event);
            try {
                await invoke("rescan_library");
            } catch (error) {
                console.error("Failed to rescan library:", error);
            }
            fetchPapers();
        });

        return () => {
            unlistenPromise.then(unlisten => unlisten());
        };
    }, [filter.kind, filter.value, searchTerm]);

    const enrichMetadata = async () => {
        try {
            setIsEnriching(true);
            await invoke<number>("enrich_metadata");
            await fetchPapers();
        } catch (error) {
            console.error("Failed to enrich metadata:", error);
        } finally {
            setIsEnriching(false);
        }
    };

    const togglePaperSelection = (paperId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(paperId)) {
                next.delete(paperId);
            } else {
                next.add(paperId);
            }
            return next;
        });
    };

    const previewRename = async () => {
        if (selectedIds.size === 0) return;
        try {
            const previews = await invoke<RenamePreview[]>("preview_rename", {
                paperIds: Array.from(selectedIds),
                template: renameTemplate
            });
            const previewText = previews
                .slice(0, 8)
                .map(p => `${p.oldPath.split('/').pop()} -> ${p.newName}`)
                .join("\n");
            alert(previews.length === 0 ? "No preview available." : `Rename preview (${previews.length} files):\n${previewText}`);
        } catch (error) {
            console.error("Failed to preview rename:", error);
        }
    };

    const applyRename = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = confirm(`Rename ${selectedIds.size} selected files?`);
        if (!confirmed) return;

        try {
            await invoke<number>("apply_rename", {
                paperIds: Array.from(selectedIds),
                template: renameTemplate
            });
            await invoke("rescan_library");
            await fetchPapers();
            setSelectedIds(new Set());
        } catch (error) {
            console.error("Failed to apply rename:", error);
        }
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-neutral-950">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    <input
                        className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 pl-9 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-800"
                        placeholder="Search papers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={fetchPapers}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md"
                    title="Refresh List"
                >
                    <RefreshCw size={18} className="text-neutral-500" />
                </button>
                <button
                    onClick={enrichMetadata}
                    disabled={isEnriching}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md disabled:opacity-50"
                    title="Enrich metadata from CrossRef"
                >
                    <WandSparkles size={18} className="text-neutral-500" />
                </button>
                <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md">
                    <SortAsc size={18} className="text-neutral-500" />
                </button>
            </div>

            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 items-center">
                <input
                    value={renameTemplate}
                    onChange={(e) => setRenameTemplate(e.target.value)}
                    className="flex-1 rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-xs"
                    placeholder="{Author}_{Year}_{Title}.pdf"
                />
                <button
                    onClick={previewRename}
                    disabled={selectedIds.size === 0}
                    className="px-2 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 disabled:opacity-50"
                >
                    Preview
                </button>
                <button
                    onClick={applyRename}
                    disabled={selectedIds.size === 0}
                    className="px-2 py-2 text-xs rounded-md bg-blue-600 text-white disabled:opacity-50"
                >
                    Apply
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
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(paper.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => togglePaperSelection(paper.id)}
                                    className="mt-2"
                                />
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
                                    <p className="text-xs text-neutral-500 mt-1 truncate">
                                        {paper.year ? `${paper.year}` : "Year N/A"}
                                        {paper.doi ? ` • DOI: ${paper.doi}` : " • DOI N/A"}
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
