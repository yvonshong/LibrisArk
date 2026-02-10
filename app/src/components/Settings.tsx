import { useState, useEffect } from "react";
import { Save, FolderOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export function Settings() {
    const [libraryPath, setLibraryPath] = useState("");
    const [openaiKey, setOpenaiKey] = useState("");
    const [anthropicKey, setAnthropicKey] = useState("");

    useEffect(() => {
        invoke<string | null>("get_library_path").then(path => {
            if (path) setLibraryPath(path);
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        if (libraryPath) {
            try {
                await invoke("set_library_path", { path: libraryPath });
                alert("Settings saved!");
            } catch (e) {
                alert("Failed to save settings: " + e);
            }
        }
    };

    const handleBrowse = async () => {
        // Placeholder for dialog integration
        alert("Please manually paste your library path.");
    };

    return (
        <div className="h-full bg-neutral-50 dark:bg-neutral-900 p-8 overflow-auto">
            <div className="max-w-2xl mx-auto space-y-8">
                <div>
                    <h2 className="text-2xl font-bold mb-2">Settings</h2>
                    <p className="text-neutral-500">Manage your application settings and API keys.</p>
                </div>

                <div className="space-y-4 bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700">
                    <h3 className="text-lg font-medium">General</h3>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Library Path</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={libraryPath}
                                onChange={(e) => setLibraryPath(e.target.value)}
                                className="flex-1 p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                                placeholder="/path/to/your/pdf/library"
                            />
                            <button onClick={handleBrowse} className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-600">
                                <FolderOpen size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-neutral-500">The folder where your PDF files are stored. (Restart app to apply watcher changes)</p>
                    </div>

                    <div className="pt-4">
                        <button onClick={handleSave} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                            <Save size={16} />
                            <span>Save Changes</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-4 bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700">
                    <h3 className="text-lg font-medium">AI Providers (Coming Soon)</h3>
                    <p className="text-sm text-neutral-500">Configure API keys for LLM integration.</p>

                    <div className="space-y-2 opacity-50 pointer-events-none">
                        <label className="text-sm font-medium">OpenAI API Key</label>
                        <input
                            type="password"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                            placeholder="sk-..."
                        />
                    </div>

                    <div className="space-y-2 opacity-50 pointer-events-none">
                        <label className="text-sm font-medium">Anthropic API Key</label>
                        <input
                            type="password"
                            value={anthropicKey}
                            onChange={(e) => setAnthropicKey(e.target.value)}
                            className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                            placeholder="sk-ant-..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
