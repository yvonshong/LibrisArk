import { Library, Tag, Settings, Search, AlertCircle } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import logo from "../assets/logo.png";

interface SidebarProps {
    currentView: "library" | "tags" | "search" | "settings";
    onViewChange: (view: "library" | "tags" | "search" | "settings") => void;
    updateAvailable?: { tag_name: string; html_url: string; body: string } | null;
}

export function Sidebar({ currentView, onViewChange, updateAvailable }: SidebarProps) {
    return (
        <div className="h-full bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center py-4 w-14 border-r border-neutral-200 dark:border-neutral-800">
            <div className="mb-8">
                <img src={logo} alt="LibrisArk Logo" className="w-8 h-8 object-contain rounded-md shadow-sm" title="LibrisArk" />
            </div>

            <nav className="flex flex-col space-y-4 flex-1 items-center">
                <NavItem
                    icon={<Search size={20} />}
                    title="Search"
                    active={currentView === "search"}
                    onClick={() => onViewChange("search")}
                />
                <NavItem
                    icon={<Library size={20} />}
                    title="All Papers"
                    active={currentView === "library"}
                    onClick={() => onViewChange("library")}
                />
                <NavItem 
                    icon={<Tag size={20} />} 
                    title="Tags" 
                    active={currentView === "tags"} 
                    onClick={() => onViewChange("tags")} 
                />
            </nav>

            <div className="mt-auto flex flex-col items-center space-y-4">
                {updateAvailable && (
                    <button
                        onClick={() => openUrl(updateAvailable.html_url)}
                        title={`Update Available: ${updateAvailable.tag_name}`}
                        className="text-red-500 hover:text-red-600 relative p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <AlertCircle size={20} />
                        <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                    </button>
                )}
                <NavItem
                    icon={<Settings size={20} />}
                    title="Settings"
                    active={currentView === "settings"}
                    onClick={() => onViewChange("settings")}
                />
            </div>
        </div>
    );
}

function NavItem({ icon, title, active = false, onClick }: { icon: React.ReactNode, title: string, active?: boolean, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${active
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                }`}
        >
            {icon}
        </button>
    );
}
