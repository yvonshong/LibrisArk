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
    
    // AI Settings
    const [aiProvider, setAiProvider] = useState("openai");
    const [aiCopilotModel, setAiCopilotModel] = useState("gpt-4o");
    const [aiSummaryModel, setAiSummaryModel] = useState("gpt-4o-mini");
    const [aiAutoSummarize, setAiAutoSummarize] = useState(false);

    const [openaiKey, setOpenaiKey] = useState("");
    const [anthropicKey, setAnthropicKey] = useState("");
    const [geminiKey, setGeminiKey] = useState("");

    const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
    const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
    const [hasGeminiKey, setHasGeminiKey] = useState(false);

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

        // Load AI Settings
        invoke<string | null>("get_app_setting", { key: "ai_provider" }).then(val => {
            if (val) setAiProvider(val);
        }).catch(console.error);

        invoke<string | null>("get_app_setting", { key: "ai_copilot_model" }).then(val => {
            if (val) setAiCopilotModel(val);
        }).catch(console.error);

        invoke<string | null>("get_app_setting", { key: "ai_summary_model" }).then(val => {
            if (val) setAiSummaryModel(val);
        }).catch(console.error);

        invoke<string | null>("get_app_setting", { key: "ai_auto_summarize" }).then(val => {
            setAiAutoSummarize(val === "true");
        }).catch(console.error);

        // Check if API keys exist in keyring
        invoke<boolean>("get_ai_key_exists", { provider: "openai" }).then(exists => {
            setHasOpenaiKey(exists);
            if (exists) setOpenaiKey("••••••••••••••••");
        }).catch(console.error);

        invoke<boolean>("get_ai_key_exists", { provider: "anthropic" }).then(exists => {
            setHasAnthropicKey(exists);
            if (exists) setAnthropicKey("••••••••••••••••");
        }).catch(console.error);

        invoke<boolean>("get_ai_key_exists", { provider: "gemini" }).then(exists => {
            setHasGeminiKey(exists);
            if (exists) setGeminiKey("••••••••••••••••");
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

            // Save AI Settings
            await invoke("set_app_setting", { key: "ai_provider", value: aiProvider });
            await invoke("set_app_setting", { key: "ai_copilot_model", value: aiCopilotModel });
            await invoke("set_app_setting", { key: "ai_summary_model", value: aiSummaryModel });
            await invoke("set_app_setting", { key: "ai_auto_summarize", value: aiAutoSummarize ? "true" : "false" });

            // Save Keys if modified
            if (openaiKey !== "••••••••••••••••") {
                await invoke("save_ai_key", { provider: "openai", key: openaiKey });
                setHasOpenaiKey(openaiKey.trim() !== "");
            }
            if (anthropicKey !== "••••••••••••••••") {
                await invoke("save_ai_key", { provider: "anthropic", key: anthropicKey });
                setHasAnthropicKey(anthropicKey.trim() !== "");
            }
            if (geminiKey !== "••••••••••••••••") {
                await invoke("save_ai_key", { provider: "gemini", key: geminiKey });
                setHasGeminiKey(geminiKey.trim() !== "");
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

                                    

                                    const url = await invoke<string>("onedrive_login");
                                    await openUrl(url);
                                    
                                    const input = prompt("If your browser didn't automatically return you to the app, please paste the full URL or the 'code' here:");
                                    if (input) {
                                        let code = input.trim();
                                        try {
                                            if (input.includes("http")) {
                                                const urlObj = new URL(input);
                                                code = urlObj.searchParams.get("code") || code;
                                            } else if (input.includes("code=")) {
                                                const match = input.match(/code=([^&]+)/);
                                                if (match?.[1]) {
                                                    code = decodeURIComponent(match[1]);
                                                }
                                            } else {
                                                // If they just pasted the code directly, it might be URL encoded
                                                code = decodeURIComponent(code);
                                            }
                                        } catch(e) {
                                            console.warn("Failed to parse URL", e);
                                        }
                                        
                                        try {
                                            await invoke("onedrive_callback", { code });
                                            alert("OneDrive connected!");
                                        } catch (e) {
                                            alert("Failed to connect OneDrive: " + e);
                                        }
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


                <div className="space-y-6 bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700">
                    <div>
                        <h3 className="text-lg font-medium">AI Integration</h3>
                        <p className="text-sm text-neutral-500">Configure LLM providers and models for Chat Copilot and Summarization.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Active Provider</label>
                            <select
                                value={aiProvider}
                                onChange={(e) => {
                                    const provider = e.target.value;
                                    setAiProvider(provider);
                                    // Set sensible defaults for the selected provider
                                    if (provider === "openai") {
                                        setAiCopilotModel("gpt-4o");
                                        setAiSummaryModel("gpt-4o-mini");
                                    } else if (provider === "anthropic") {
                                        setAiCopilotModel("claude-3-5-sonnet-latest");
                                        setAiSummaryModel("claude-3-5-haiku-latest");
                                    } else if (provider === "gemini") {
                                        setAiCopilotModel("gemini-1.5-pro");
                                        setAiSummaryModel("gemini-1.5-flash");
                                    }
                                }}
                                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-800"
                            >
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="gemini">Google Gemini</option>
                            </select>
                        </div>

                        {/* OpenAI Keys & Models */}
                        {aiProvider === "openai" && (
                            <div className="space-y-4 p-4 border border-neutral-200 dark:border-neutral-700 rounded-md">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex justify-between">
                                        <span>OpenAI API Key</span>
                                        {hasOpenaiKey && <span className="text-xs text-green-600 dark:text-green-400">✓ Securely Stored</span>}
                                    </label>
                                    <input
                                        type="password"
                                        value={openaiKey}
                                        onChange={(e) => setOpenaiKey(e.target.value)}
                                        className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                                        placeholder="sk-..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Copilot Model</label>
                                        <select
                                            value={aiCopilotModel}
                                            onChange={(e) => setAiCopilotModel(e.target.value)}
                                            className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-800"
                                        >
                                            <option value="gpt-4o">gpt-4o (Recommended)</option>
                                            <option value="gpt-4o-mini">gpt-4o-mini</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Summary Model</label>
                                        <select
                                            value={aiSummaryModel}
                                            onChange={(e) => setAiSummaryModel(e.target.value)}
                                            className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-800"
                                        >
                                            <option value="gpt-4o-mini">gpt-4o-mini (Recommended)</option>
                                            <option value="gpt-4o">gpt-4o</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Anthropic Keys & Models */}
                        {aiProvider === "anthropic" && (
                            <div className="space-y-4 p-4 border border-neutral-200 dark:border-neutral-700 rounded-md">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex justify-between">
                                        <span>Anthropic API Key</span>
                                        {hasAnthropicKey && <span className="text-xs text-green-600 dark:text-green-400">✓ Securely Stored</span>}
                                    </label>
                                    <input
                                        type="password"
                                        value={anthropicKey}
                                        onChange={(e) => setAnthropicKey(e.target.value)}
                                        className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                                        placeholder="sk-ant-..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Copilot Model</label>
                                        <select
                                            value={aiCopilotModel}
                                            onChange={(e) => setAiCopilotModel(e.target.value)}
                                            className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-800"
                                        >
                                            <option value="claude-3-5-sonnet-latest">claude-3-5-sonnet-latest</option>
                                            <option value="claude-3-5-haiku-latest">claude-3-5-haiku-latest</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Summary Model</label>
                                        <select
                                            value={aiSummaryModel}
                                            onChange={(e) => setAiSummaryModel(e.target.value)}
                                            className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-800"
                                        >
                                            <option value="claude-3-5-haiku-latest">claude-3-5-haiku-latest</option>
                                            <option value="claude-3-5-sonnet-latest">claude-3-5-sonnet-latest</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Gemini Keys & Models */}
                        {aiProvider === "gemini" && (
                            <div className="space-y-4 p-4 border border-neutral-200 dark:border-neutral-700 rounded-md">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex justify-between">
                                        <span>Gemini API Key</span>
                                        {hasGeminiKey && <span className="text-xs text-green-600 dark:text-green-400">✓ Securely Stored</span>}
                                    </label>
                                    <input
                                        type="password"
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                        className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                                        placeholder="AIzaSy..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Copilot Model</label>
                                        <select
                                            value={aiCopilotModel}
                                            onChange={(e) => setAiCopilotModel(e.target.value)}
                                            className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-800"
                                        >
                                            <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                                            <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Summary Model</label>
                                        <select
                                            value={aiSummaryModel}
                                            onChange={(e) => setAiSummaryModel(e.target.value)}
                                            className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-800"
                                        >
                                            <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                                            <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="ai-auto-summarize"
                                checked={aiAutoSummarize}
                                onChange={(e) => setAiAutoSummarize(e.target.checked)}
                                className="rounded text-blue-600 border-neutral-300 dark:border-neutral-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <label htmlFor="ai-auto-summarize" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Auto-generate summary & tags for newly added papers
                            </label>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button onClick={handleSave} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                            <Save size={16} />
                            <span>Save AI Config</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
