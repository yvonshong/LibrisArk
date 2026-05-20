import { Library, Folder, Tag, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LibraryFilter, VirtualFacets } from "../types";
import { listen } from "@tauri-apps/api/event";

interface SidebarProps {
    currentView: "library" | "settings";
    onViewChange: (view: "library" | "settings") => void;
    filter: LibraryFilter;
    onFilterChange: (filter: LibraryFilter) => void;
}

export function Sidebar({ currentView, onViewChange, filter, onFilterChange }: SidebarProps) {
    const [facets, setFacets] = useState<VirtualFacets>({ years: [], authors: [], tags: [] });

    const fetchFacets = () => {
        invoke<VirtualFacets>("get_virtual_facets")
            .then(setFacets)
            .catch((error) => console.error("Failed to load virtual facets:", error));
    };

    useEffect(() => {
        if (currentView !== "library") return;
        fetchFacets();

        const unlistenPromise = listen("library-update", () => {
            fetchFacets();
        });

        return () => {
            unlistenPromise.then(unlisten => unlisten());
        };
    }, [currentView]);

    return (
        <div className="h-full bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col">
            <div className="font-bold text-xl mb-6 px-2">LibrisArk</div>

            <nav className="space-y-1 flex-1">
                <NavItem
                    icon={<Library size={18} />}
                    label="All Papers"
                    active={currentView === "library" && filter.kind === "all"}
                    onClick={() => {
                        onViewChange("library");
                        onFilterChange({ kind: "all", value: null });
                    }}
                />
                <NavItem icon={<Folder size={18} />} label="Collections" active={filter.kind === "year" || filter.kind === "author"} onClick={() => onViewChange("library")} />
                <NavItem icon={<Tag size={18} />} label="Tags" active={filter.kind === "tag"} onClick={() => onViewChange("library")} />

                {currentView === "library" && (
                    <div className="pt-4 space-y-4">
                        <FacetGroup
                            title="Years"
                            items={facets.years}
                            activeValue={filter.kind === "year" ? filter.value : null}
                            onPick={(value) => onFilterChange({ kind: "year", value })}
                        />
                        <FacetGroup
                            title="Authors"
                            items={facets.authors}
                            activeValue={filter.kind === "author" ? filter.value : null}
                            onPick={(value) => onFilterChange({ kind: "author", value })}
                        />
                        <FacetGroup
                            title="Tags"
                            items={facets.tags}
                            activeValue={filter.kind === "tag" ? filter.value : null}
                            onPick={(value) => onFilterChange({ kind: "tag", value })}
                        />
                    </div>
                )}
            </nav>

            <div className="mt-auto">
                <NavItem
                    icon={<Settings size={18} />}
                    label="Settings"
                    active={currentView === "settings"}
                    onClick={() => onViewChange("settings")}
                />
            </div>
        </div>
    );
}

function FacetGroup({
    title,
    items,
    activeValue,
    onPick,
}: {
    title: string;
    items: { value: string; count: number }[];
    activeValue: string | null;
    onPick: (value: string) => void;
}) {
    if (items.length === 0) return null;

    return (
        <div>
            <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-neutral-500">{title}</p>
            <div className="space-y-1 max-h-32 overflow-auto">
                {items.map(item => (
                    <button
                        key={`${title}-${item.value}`}
                        onClick={() => onPick(item.value)}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${activeValue === item.value
                                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            }`}
                    >
                        <span className="truncate inline-block max-w-[80%] align-middle">{item.value}</span>
                        <span className="float-right text-[10px] opacity-70">{item.count}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${active
                    ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}>
            {icon}
            <span>{label}</span>
        </button>
    );
}
