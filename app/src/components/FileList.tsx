import { Search, RefreshCw, WandSparkles, Trash2, Tag, ChevronLeft } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LibraryFilter, Paper, VirtualFacets } from "../types";
import { clsx } from "clsx";

interface FileListProps {
    onSelectPaper: (paper: Paper) => void;
    selectedPaperId?: string;
    filter: LibraryFilter;
    onFilterChange: (filter: LibraryFilter) => void;
    currentView: "library" | "tags" | "search" | "settings";
}

interface RenamePreview {
    id: string;
    oldPath: string;
    newName: string;
    newPath: string;
}

export function FileList({ onSelectPaper, selectedPaperId, filter, onFilterChange, currentView }: FileListProps) {
    const [papers, setPapers] = useState<Paper[]>([]);
    const [isEnriching, setIsEnriching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [renameTemplate, setRenameTemplate] = useState("{Author}_{Year}_{Title}.pdf");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // For Tags view
    const [facets, setFacets] = useState<VirtualFacets>({ years: [], authors: [], tags: [] });
    const searchInputRef = useRef<HTMLInputElement>(null);

    const fetchPapers = async () => {
        try {
            const result = await invoke<Paper[]>("get_papers_filtered", {
                filterKind: filter.kind === "all" ? null : filter.kind,
                filterValue: filter.value,
                search: searchTerm.trim() ? searchTerm.trim() : null
            });
            setPapers(result);
        } catch (error) {
            console.error("Failed to fetch papers:", error);
        }
    };

    const fetchFacets = async () => {
        try {
            const result = await invoke<VirtualFacets>("get_virtual_facets");
            setFacets(result);
        } catch (error) {
            console.error("Failed to load virtual facets:", error);
        }
    };

    useEffect(() => {
        fetchPapers();

        let debounceTimeout: ReturnType<typeof setTimeout>;
        const unlistenPromise = listen("library-update", () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(async () => {
                try {
                    await invoke("rescan_library");
                } catch (error) {
                    console.error("Failed to rescan library:", error);
                }
                fetchPapers();
                if (currentView === "tags") fetchFacets();
            }, 1000); // 1s debounce
        });

        return () => {
            clearTimeout(debounceTimeout);
            unlistenPromise.then(unlisten => unlisten());
        };
    }, [filter.kind, filter.value, searchTerm]);

    useEffect(() => {
        if (currentView === "tags") {
            fetchFacets();
            setSearchTerm("");
        }
        if (currentView === "search") {
            searchInputRef.current?.focus();
        }
        if (currentView === "library") {
            setSearchTerm("");
        }
    }, [currentView]);

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
            if (next.has(paperId)) next.delete(paperId);
            else next.add(paperId);
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
            const previewText = previews.slice(0, 8).map(p => `${p.oldPath.split('/').pop()} -> ${p.newName}`).join("\n");
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

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = confirm(`Delete ${selectedIds.size} selected files from library and disk?`);
        if (!confirmed) return;

        try {
            await invoke<number>("delete_paper", {
                paperIds: Array.from(selectedIds),
            });
            await invoke("rescan_library");
            await fetchPapers();
            setSelectedIds(new Set());
        } catch (error) {
            console.error("Failed to delete papers:", error);
            alert("Failed to delete papers: " + error);
        }
    };

    // TAGS VIEW
    if (currentView === "tags" && filter.kind !== "tag") {
        return (
            <div className="h-full flex flex-col bg-white dark:bg-neutral-950">
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 items-center">
                    <Tag className="text-neutral-500" size={20} />
                    <h2 className="font-semibold text-lg">Tags</h2>
                </div>
                <div className="flex-1 overflow-auto p-4">
                    {facets.tags.length === 0 ? (
                        <div className="text-center text-neutral-500 mt-10">No tags found in the library.</div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {facets.tags.map(tag => (
                                <button
                                    key={tag.value}
                                    onClick={() => {
                                        onFilterChange({ kind: "tag", value: tag.value });
                                    }}
                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors text-left"
                                >
                                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{tag.value}</span>
                                    <span className="bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs px-2 py-1 rounded-full">{tag.count}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // SEARCH VIEW
    if (currentView === "search" && !searchTerm) {
        return (
            <div className="h-full flex flex-col bg-white dark:bg-neutral-950 p-6">
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-neutral-400" />
                    <input
                        ref={searchInputRef}
                        className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-4 py-3 pl-11 text-base placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Type to search papers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex-1 flex items-center justify-center text-neutral-400">
                    <div className="text-center">
                        <Search size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Search by title, author, or content</p>
                    </div>
                </div>
            </div>
        );
    }

    // LIBRARY VIEW (or Search with term)
    return (
        <div className="h-full flex flex-col bg-white dark:bg-neutral-950">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 items-center">
                {currentView === "tags" && filter.kind === "tag" && (
                    <>
                        <button
                            onClick={() => onFilterChange({ kind: "all", value: null })}
                            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md flex items-center gap-1 text-sm font-medium shrink-0"
                        >
                            <ChevronLeft size={16} /> Back
                        </button>
                        <h2 className="font-semibold text-neutral-700 dark:text-neutral-300 text-sm flex-1 truncate ml-1">#{filter.value}</h2>
                    </>
                )}
                {currentView === "search" && (
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                        <input
                            ref={searchInputRef}
                            className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 pl-9 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Search papers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}
                {currentView === "library" && (
                    <h2 className="font-semibold text-lg flex-1">All Papers</h2>
                )}

                <button
                    onClick={async () => {
                        try { await invoke("rescan_library"); } catch (e) { console.error(e); }
                        await fetchPapers();
                    }}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md shrink-0"
                    title="Refresh List"
                >
                    <RefreshCw size={18} className="text-neutral-500" />
                </button>
                <button
                    onClick={enrichMetadata}
                    disabled={isEnriching}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md disabled:opacity-50 shrink-0"
                    title="Enrich metadata from CrossRef"
                >
                    <WandSparkles size={18} className="text-neutral-500" />
                </button>
            </div>

            <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-2 items-center bg-neutral-50/50 dark:bg-neutral-900/50">
                <input
                    value={renameTemplate}
                    onChange={(e) => setRenameTemplate(e.target.value)}
                    className="flex-1 min-w-[100px] rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-[11px]"
                    placeholder="{Author}_{Year}_{Title}.pdf"
                />
                <div className="flex gap-1">
                    <button
                        onClick={previewRename}
                        disabled={selectedIds.size === 0}
                        className="px-2 py-1 text-[11px] rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                    >
                        Preview
                    </button>
                <button
                    onClick={applyRename}
                    disabled={selectedIds.size === 0}
                    className="px-2 py-1 text-[11px] rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                    Apply
                </button>
                <button
                    onClick={deleteSelected}
                    disabled={selectedIds.size === 0}
                    className="px-2 py-1 text-[11px] rounded border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 flex items-center gap-1"
                    title="Delete from disk and library"
                >
                    <Trash2 size={12} />
                    Delete
                </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {papers.length === 0 ? (
                    <div className="p-8 text-center text-neutral-500 text-sm">
                        No papers found.
                    </div>
                ) : (
                    papers.map(paper => (
                        <div
                            key={paper.id}
                            onClick={() => onSelectPaper(paper)}
                            className={clsx(
                                "p-3 border-b border-neutral-100 dark:border-neutral-900 cursor-pointer group transition-colors",
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
                                    className="mt-1.5"
                                />
                                <div className="min-w-0 flex-1">
                                    <h3 className={clsx(
                                        "font-medium text-sm transition-colors line-clamp-2",
                                        selectedPaperId === paper.id
                                            ? "text-blue-700 dark:text-blue-300"
                                            : "text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                                    )}>
                                        {paper.title || paper.path.split('/').pop()?.split('\\').pop()}
                                    </h3>
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {paper.year && (
                                            <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded">
                                                {paper.year}
                                            </span>
                                        )}
                                        {paper.tags && paper.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/50 truncate max-w-[80px]">
                                                {tag}
                                            </span>
                                        ))}
                                        {paper.tags && paper.tags.length > 3 && (
                                            <span className="text-[10px] bg-neutral-50 dark:bg-neutral-900 text-neutral-500 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800">
                                                +{paper.tags.length - 3}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
