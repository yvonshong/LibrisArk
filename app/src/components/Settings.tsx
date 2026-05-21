import { useState, useEffect } from "react";
import { Save, FolderOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";

export function Settings() {
    const [activeTab, setActiveTab] = useState<"general" | "sync" | "ai">("general");

    const [libraryPath, setLibraryPath] = useState("");
    const [onedriveClientId, setOnedriveClientId] = useState("");
    const [onedriveClientSecret, setOnedriveClientSecret] = useState("");
    const [onedriveSyncFolder, setOnedriveSyncFolder] = useState("");
    const [syncIntervalMinutes, setSyncIntervalMinutes] = useState("30");
    const [isSyncing, setIsSyncing] = useState(false);
    const [isOneDriveConnected, setIsOneDriveConnected] = useState(false);
    const [syncProgressText, setSyncProgressText] = useState("");
    const [appVersion, setAppVersion] = useState("");
    
    // General
    const [language, setLanguage] = useState("en");

    // AI Settings
    const [aiProvider, setAiProvider] = useState("openai");
    const [aiCopilotModel, setAiCopilotModel] = useState("gpt-4o");
    const [aiSummaryModel, setAiSummaryModel] = useState("gpt-4o-mini");
    const [aiAutoSummarize, setAiAutoSummarize] = useState(false);

    const [openaiKey, setOpenaiKey] = useState("");
    const [anthropicKey, setAnthropicKey] = useState("");
    const [geminiKey, setGeminiKey] = useState("");
    const [deepseekKey, setDeepseekKey] = useState("");
    const [customKey, setCustomKey] = useState("");

    const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
    const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
    const [hasGeminiKey, setHasGeminiKey] = useState(false);
    const [hasDeepseekKey, setHasDeepseekKey] = useState(false);
    const [hasCustomKey, setHasCustomKey] = useState(false);

    const [openaiBaseUrl, setOpenaiBaseUrl] = useState("");
    const [anthropicBaseUrl, setAnthropicBaseUrl] = useState("");
    const [geminiBaseUrl, setGeminiBaseUrl] = useState("");
    const [deepseekBaseUrl, setDeepseekBaseUrl] = useState("");
    const [customBaseUrl, setCustomBaseUrl] = useState("");

    useEffect(() => {
        invoke<string>("get_app_version").then(version => setAppVersion(version)).catch(console.error);

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

        invoke<boolean>("get_onedrive_status").then(connected => {
            setIsOneDriveConnected(connected);
        }).catch(console.error);

        const unlistenSync = listen<string>("sync-progress", (event) => {
            setSyncProgressText(event.payload);
        });

        invoke<string | null>("get_app_setting", { key: "sync_interval_minutes" }).then(val => {
            if (val) setSyncIntervalMinutes(val);
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
        
        invoke<boolean>("get_ai_key_exists", { provider: "deepseek" }).then(exists => {
            setHasDeepseekKey(exists);
            if (exists) setDeepseekKey("••••••••••••••••");
        }).catch(console.error);
        
        invoke<boolean>("get_ai_key_exists", { provider: "custom" }).then(exists => {
            setHasCustomKey(exists);
            if (exists) setCustomKey("••••••••••••••••");
        }).catch(console.error);

        invoke<string | null>("get_app_setting", { key: "ai_openai_base_url" }).then(val => {
            if (val) setOpenaiBaseUrl(val);
        }).catch(console.error);
        invoke<string | null>("get_app_setting", { key: "ai_anthropic_base_url" }).then(val => {
            if (val) setAnthropicBaseUrl(val);
        }).catch(console.error);
        invoke<string | null>("get_app_setting", { key: "ai_gemini_base_url" }).then(val => {
            if (val) setGeminiBaseUrl(val);
        }).catch(console.error);
        invoke<string | null>("get_app_setting", { key: "ai_deepseek_base_url" }).then(val => {
            if (val) setDeepseekBaseUrl(val);
        }).catch(console.error);
        invoke<string | null>("get_app_setting", { key: "ai_custom_base_url" }).then(val => {
            if (val) setCustomBaseUrl(val);
        }).catch(console.error);

        return () => {
            unlistenSync.then(f => f());
        };
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

            await invoke("set_app_setting", { key: "sync_interval_minutes", value: syncIntervalMinutes });

            // Save AI Settings
            await invoke("set_app_setting", { key: "ai_provider", value: aiProvider });
            await invoke("set_app_setting", { key: "ai_copilot_model", value: aiCopilotModel });
            await invoke("set_app_setting", { key: "ai_summary_model", value: aiSummaryModel });
            await invoke("set_app_setting", { key: "ai_auto_summarize", value: aiAutoSummarize ? "true" : "false" });
            
            await invoke("set_app_setting", { key: "ai_openai_base_url", value: openaiBaseUrl });
            await invoke("set_app_setting", { key: "ai_anthropic_base_url", value: anthropicBaseUrl });
            await invoke("set_app_setting", { key: "ai_gemini_base_url", value: geminiBaseUrl });
            await invoke("set_app_setting", { key: "ai_deepseek_base_url", value: deepseekBaseUrl });
            await invoke("set_app_setting", { key: "ai_custom_base_url", value: customBaseUrl });

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
            if (deepseekKey !== "••••••••••••••••") {
                await invoke("save_ai_key", { provider: "deepseek", key: deepseekKey });
                setHasDeepseekKey(deepseekKey.trim() !== "");
            }
            if (customKey !== "••••••••••••••••") {
                await invoke("save_ai_key", { provider: "custom", key: customKey });
                setHasCustomKey(customKey.trim() !== "");
            }

            if (!silent) alert("Settings saved!");
        } catch (e) {
            alert("Failed to save settings: " + e);
            throw e;
        }
    };

    const handleSave = () => saveSettings(false);

    const handleBrowse = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });
            if (selected) {
                setLibraryPath(selected as string);
            }
        } catch (e) {
            console.error("Failed to open dialog:", e);
        }
    };

    const handleCheckUpdate = async () => {
        try {
            const release = await invoke<any>("check_for_updates");
            if (release) {
                if (window.confirm(`New update available: ${release.tag_name}\nWould you like to download it?`)) {
                    openUrl(release.html_url);
                }
            } else {
                alert("You are up to date!");
            }
        } catch (e) {
            alert("Failed to check for updates: " + e);
        }
    };

    return (
        <div className="flex h-full bg-neutral-50 dark:bg-neutral-900">
            {/* Sidebar */}
            <div className="w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
                <h2 className="text-2xl font-bold mb-6">Settings</h2>
                <nav className="space-y-2">
                    <button
                        onClick={() => setActiveTab("general")}
                        className={`w-full text-left px-4 py-2 rounded-md transition-colors ${activeTab === "general" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab("sync")}
                        className={`w-full text-left px-4 py-2 rounded-md transition-colors ${activeTab === "sync" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                    >
                        Sync
                    </button>
                    <button
                        onClick={() => setActiveTab("ai")}
                        className={`w-full text-left px-4 py-2 rounded-md transition-colors ${activeTab === "ai" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                    >
                        AI Integration
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-2xl mx-auto space-y-8">
                    {activeTab === "general" && (
                        <div className="space-y-6 bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 animate-in fade-in">
                            <div>
                                <h3 className="text-lg font-medium">General Settings</h3>
                                <p className="text-sm text-neutral-500">Manage basic application preferences.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Language</label>
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-800"
                                    >
                                        <option value="en">English</option>
                                        <option value="zh">中文</option>
                                    </select>
                                </div>

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

                                <div className="pt-2 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">App Version</p>
                                        <p className="text-xs text-neutral-500">{appVersion.startsWith('v') ? appVersion : `v${appVersion}`}</p>
                                    </div>
                                    <button onClick={handleCheckUpdate} className="text-sm px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                                        Check for Updates
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button onClick={handleSave} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                                    <Save size={16} />
                                    <span>Save General</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "sync" && (
                        <div className="space-y-6 bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 animate-in fade-in">
                            <div>
                                <h3 className="text-lg font-medium">Cloud Sync</h3>
                                <p className="text-sm text-neutral-500">Configure your cloud storage provider and sync schedule.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2 border-b border-neutral-200 dark:border-neutral-700 pb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-medium">OneDrive Configuration</span>
                                    </div>
                                    
                                    <label className="text-sm font-medium">OneDrive Sync Folder</label>
                                    <input
                                        type="text"
                                        value={onedriveSyncFolder}
                                        onChange={(e) => setOnedriveSyncFolder(e.target.value)}
                                        className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                                        placeholder="Documents/LibrisArk"
                                    />
                                    <p className="text-xs text-neutral-500">The folder path in your OneDrive to sync with.</p>

                                    <div className="flex gap-2 mt-4">
                                        {isOneDriveConnected ? (
                                            <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-md font-medium text-center">
                                                Connected
                                            </div>
                                        ) : (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await saveSettings(true);
                                                        const url = await invoke<string>("onedrive_login");
                                                        await openUrl(url);
                                                        
                                                        const input = prompt("If your browser didn't return you automatically, paste the full URL or 'code' here:");
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
                                                                    code = decodeURIComponent(code);
                                                                }
                                                            } catch(e) {
                                                                console.warn("Failed to parse URL", e);
                                                            }
                                                            
                                                            try {
                                                                await invoke("onedrive_callback", { code });
                                                                setIsOneDriveConnected(true);
                                                                alert("OneDrive connected successfully!");
                                                            } catch (e) {
                                                                alert("Failed to connect OneDrive: " + e);
                                                            }
                                                        }
                                                    } catch (e) {
                                                        alert("Failed to connect OneDrive: " + e);
                                                    }
                                                }}
                                                className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                                            >
                                                Connect OneDrive
                                            </button>
                                        )}
                                        <button
                                            onClick={async () => {
                                                try {
                                                    setIsSyncing(true);
                                                    setSyncProgressText("Starting sync...");
                                                    await saveSettings(true);
                                                    await invoke("sync_onedrive");
                                                    alert("Sync completed!");
                                                } catch (e) {
                                                    alert("Sync failed: " + e);
                                                } finally {
                                                    setIsSyncing(false);
                                                }
                                            }}
                                            disabled={isSyncing}
                                            className={`px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${isSyncing ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                            {isSyncing ? "Syncing..." : "Sync Now"}
                                        </button>
                                    </div>
                                    {isSyncing && syncProgressText && (
                                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 animate-pulse">{syncProgressText}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Automatic Sync Interval (minutes)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={syncIntervalMinutes}
                                        onChange={(e) => setSyncIntervalMinutes(e.target.value)}
                                        className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent"
                                        placeholder="30"
                                    />
                                    <p className="text-xs text-neutral-500">Set to 0 to disable automatic background syncing.</p>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button onClick={handleSave} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                                    <Save size={16} />
                                    <span>Save Sync Settings</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "ai" && (
                        <div className="space-y-6 bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 animate-in fade-in">
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
                                            if (provider === "openai") {
                                                setAiCopilotModel("gpt-4o");
                                                setAiSummaryModel("gpt-4o-mini");
                                            } else if (provider === "anthropic") {
                                                setAiCopilotModel("claude-3-5-sonnet-latest");
                                                setAiSummaryModel("claude-3-5-haiku-latest");
                                            } else if (provider === "gemini") {
                                                setAiCopilotModel("gemini-1.5-pro");
                                                setAiSummaryModel("gemini-1.5-flash");
                                            } else if (provider === "deepseek") {
                                                setAiCopilotModel("deepseek-chat");
                                                setAiSummaryModel("deepseek-chat");
                                            } else if (provider === "custom") {
                                                setAiCopilotModel("custom-model");
                                                setAiSummaryModel("custom-model");
                                            }
                                        }}
                                        className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent dark:bg-neutral-800"
                                    >
                                        <option value="openai">OpenAI</option>
                                        <option value="anthropic">Anthropic</option>
                                        <option value="gemini">Google Gemini</option>
                                        <option value="deepseek">DeepSeek</option>
                                        <option value="custom">Custom (OpenAI Compatible)</option>
                                    </select>
                                </div>

                                <div className="space-y-4 p-4 border border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-900/50">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400">API Base URL (Optional)</label>
                                        <input
                                            type="text"
                                            value={
                                                aiProvider === 'openai' ? openaiBaseUrl :
                                                aiProvider === 'anthropic' ? anthropicBaseUrl :
                                                aiProvider === 'gemini' ? geminiBaseUrl :
                                                aiProvider === 'deepseek' ? deepseekBaseUrl : customBaseUrl
                                            }
                                            onChange={(e) => {
                                                if (aiProvider === 'openai') setOpenaiBaseUrl(e.target.value);
                                                else if (aiProvider === 'anthropic') setAnthropicBaseUrl(e.target.value);
                                                else if (aiProvider === 'gemini') setGeminiBaseUrl(e.target.value);
                                                else if (aiProvider === 'deepseek') setDeepseekBaseUrl(e.target.value);
                                                else setCustomBaseUrl(e.target.value);
                                            }}
                                            className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-sm"
                                            placeholder={
                                                aiProvider === 'openai' ? "Default: https://api.openai.com/v1/chat/completions" :
                                                aiProvider === 'anthropic' ? "Default: https://api.anthropic.com/v1/messages" :
                                                aiProvider === 'gemini' ? "Default: https://generativelanguage.googleapis.com/v1beta" :
                                                aiProvider === 'deepseek' ? "Default: https://api.deepseek.com/chat/completions" :
                                                "e.g. https://api.openai.com/v1/chat/completions"
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium flex justify-between">
                                            <span>{aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1)} API Key</span>
                                            {(aiProvider === 'openai' ? hasOpenaiKey :
                                              aiProvider === 'anthropic' ? hasAnthropicKey :
                                              aiProvider === 'gemini' ? hasGeminiKey :
                                              aiProvider === 'deepseek' ? hasDeepseekKey : hasCustomKey) && 
                                              <span className="text-xs text-green-600 dark:text-green-400">✓ Securely Stored</span>}
                                        </label>
                                        <input
                                            type="password"
                                            value={
                                                aiProvider === 'openai' ? openaiKey :
                                                aiProvider === 'anthropic' ? anthropicKey :
                                                aiProvider === 'gemini' ? geminiKey :
                                                aiProvider === 'deepseek' ? deepseekKey : customKey
                                            }
                                            onChange={(e) => {
                                                if (aiProvider === 'openai') setOpenaiKey(e.target.value);
                                                else if (aiProvider === 'anthropic') setAnthropicKey(e.target.value);
                                                else if (aiProvider === 'gemini') setGeminiKey(e.target.value);
                                                else if (aiProvider === 'deepseek') setDeepseekKey(e.target.value);
                                                else setCustomKey(e.target.value);
                                            }}
                                            className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950"
                                            placeholder="Enter API Key..."
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Copilot Model</label>
                                            <input
                                                type="text"
                                                list={`${aiProvider}-models`}
                                                value={aiCopilotModel}
                                                onChange={(e) => setAiCopilotModel(e.target.value)}
                                                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Summary Model</label>
                                            <input
                                                type="text"
                                                list={`${aiProvider}-models`}
                                                value={aiSummaryModel}
                                                onChange={(e) => setAiSummaryModel(e.target.value)}
                                                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950"
                                            />
                                        </div>
                                        <datalist id="openai-models">
                                            <option value="gpt-4o" />
                                            <option value="gpt-4o-mini" />
                                            <option value="o1-mini" />
                                            <option value="o3-mini" />
                                        </datalist>
                                        <datalist id="anthropic-models">
                                            <option value="claude-3-7-sonnet-latest" />
                                            <option value="claude-3-5-sonnet-latest" />
                                            <option value="claude-3-5-haiku-latest" />
                                        </datalist>
                                        <datalist id="gemini-models">
                                            <option value="gemini-2.5-pro" />
                                            <option value="gemini-2.0-flash" />
                                            <option value="gemini-1.5-pro" />
                                            <option value="gemini-1.5-flash" />
                                        </datalist>
                                        <datalist id="deepseek-models">
                                            <option value="deepseek-chat" />
                                            <option value="deepseek-reasoner" />
                                        </datalist>
                                        <datalist id="custom-models">
                                            <option value="custom-model" />
                                        </datalist>
                                    </div>
                                </div>

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
                    )}
                </div>
            </div>
        </div>
    );
}
