import { useState, useEffect } from "react";
import { Save, FolderOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

export function Settings() {
    const [libraryPath, setLibraryPath] = useState("");
    const [onedriveClientId, setOnedriveClientId] = useState("");
    const [onedriveClientSecret, setOnedriveClientSecret] = useState("");
    const [onedriveSyncFolder, setOnedriveSyncFolder] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [openaiKey, setOpenaiKey] = useState("");
    const [anthropicKey, setAnthropicKey] = useState("");

    useEffect(() => {
        invoke<string | null>("get_library_path").then(path => {
            if (path) setLibraryPath(path);
        }).catch(console.error);

        invoke<string | null>("get_onedrive_client_id").then(id => {
            if (id) setOnedriveClientId(id);
        }).catch(console.error);

        invoke<string | null>("get_onedrive_client_secret").then(secret => {
            if (secret) setOnedriveClientSecret(secret);
        }).catch(console.error);

        invoke<string | null>("get_onedrive_sync_folder").then(folder => {
            if (folder) setOnedriveSyncFolder(folder);
        }).catch(console.error);
    }, []);

    const saveSettings = async (silent = false) => {
        try {
            if (libraryPath) {
                await invoke("set_library_path", { path: libraryPath });
            }
            if (onedriveClientId) {
                await invoke("set_onedrive_client_id", { clientId: onedriveClientId });
            }
            if (onedriveClientSecret) {
                await invoke("set_onedrive_client_secret", { clientSecret: onedriveClientSecret });
            }
            if (onedriveSyncFolder) {
                await invoke("set_onedrive_sync_folder", { folder: onedriveSyncFolder });
            }
            if (!silent) alert("Settings saved!");
        } catch (e) {
            alert("Failed to save settings: " + e);
            throw e;
        }
    };

    const handleSave = () => saveSettings(false);

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
                    <h3 className="text-lg font-medium">Cloud Sync</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">OneDrive</p>
                            <p className="text-sm text-neutral-500">Sync your library to Microsoft OneDrive.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Client ID</label>
                            <input
                                type="text"
                                value={onedriveClientId}
                                onChange={(e) => setOnedriveClientId(e.target.value)}
                                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                                placeholder="Azure Portal Application (client) ID"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Client Secret (Required for Web App)</label>
                            <input
                                type="password"
                                value={onedriveClientSecret}
                                onChange={(e) => setOnedriveClientSecret(e.target.value)}
                                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                                placeholder="Azure Portal Client Secret"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">OneDrive Sync Folder</label>
                            <input
                                type="text"
                                value={onedriveSyncFolder}
                                onChange={(e) => setOnedriveSyncFolder(e.target.value)}
                                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                                placeholder="Documents/LibrisArk"
                            />
                            <p className="text-xs text-neutral-500">The folder path in your OneDrive to sync with.</p>
                        </div>

                        <p className="text-xs text-neutral-500">Register an app in Azure Portal and paste the details here.</p>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            onClick={async () => {
                                try {
                                    setIsSyncing(true);
                                    await saveSettings(true); // Auto-save first
                                    await invoke("sync_onedrive");
                                    alert("Sync completed!");
                                } catch (e) {
                                    alert("Sync failed: " + e);
                                } finally {
                                    setIsSyncing(false);
                                }
                            }}
                            disabled={isSyncing}
                            className={`px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors ${isSyncing ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {isSyncing ? "Syncing..." : "Sync Now"}
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    await saveSettings(true); // Auto-save first

                                    if (!onedriveClientId) {
                                        alert("Please enter a Client ID first.");
                                        return;
                                    }

                                    const url = await invoke<string>("onedrive_login");
                                    await openUrl(url);
                                    // In a real app, we'd listen for a deep link or use a local server
                                    const code = prompt("Please enter the code from the redirect URL:");
                                    if (code) {
                                        await invoke("onedrive_callback", { code });
                                        alert("OneDrive connected!");
                                    }
                                } catch (e) {
                                    alert("Failed to connect OneDrive: " + e);
                                }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            Connect OneDrive
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
