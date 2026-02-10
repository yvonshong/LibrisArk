import { Library, Folder, Tag, Settings } from "lucide-react";

interface SidebarProps {
    currentView: "library" | "settings";
    onViewChange: (view: "library" | "settings") => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
    return (
        <div className="h-full bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col">
            <div className="font-bold text-xl mb-6 px-2">LibrisArk</div>

            <nav className="space-y-1 flex-1">
                <NavItem
                    icon={<Library size={18} />}
                    label="All Papers"
                    active={currentView === "library"}
                    onClick={() => onViewChange("library")}
                />
                <NavItem icon={<Folder size={18} />} label="Collections" />
                <NavItem icon={<Tag size={18} />} label="Tags" />
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
