import { Send, Bot, User, BookmarkPlus, Sparkles, RefreshCw, Plus, FileText, ClipboardCopy } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Note, Paper } from "../types";

interface ChatPanelProps {
    selectedPaper: Paper | null;
}

export function ChatPanel({ selectedPaper }: ChatPanelProps) {
    const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'notes'>('chat');
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Hello! I am your research assistant. How can I help you with this paper?' }
    ]);
    const [input, setInput] = useState("");
    const [selectedTextContext, setSelectedTextContext] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNoteText, setNewNoteText] = useState("");

    useEffect(() => {
        if (!selectedPaper) {
            setNotes([]);
            return;
        }

        invoke<Note[]>("get_notes", { paperId: selectedPaper.id })
            .then(setNotes)
            .catch((error) => console.error("Failed to load notes:", error));
    }, [selectedPaper]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const question = input;
        setMessages(prev => [...prev, { role: 'user', content: question }]);
        setInput("");

        if (!selectedPaper) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Please select a paper first, then ask your question." }]);
            return;
        }

        try {
            setIsLoading(true);
            const answer = await invoke<string>("ask_paper", {
                paperId: selectedPaper.id,
                question,
                selectedText: selectedTextContext || null
            });
            setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Failed to answer from PDF: ${error}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveNote = async (content: string) => {
        if (!selectedPaper) return;

        try {
            await invoke("save_note", {
                paperId: selectedPaper.id,
                content,
                anchorText: selectedTextContext || null
            });

            const refreshed = await invoke<Note[]>("get_notes", { paperId: selectedPaper.id });
            setNotes(refreshed);
        } catch (error) {
            console.error("Failed to save note:", error);
        }
    };

    const handleGenerateSummary = async () => {
        if (!selectedPaper) return;
        try {
            setIsSummarizing(true);
            await invoke("generate_ai_summary", { paperId: selectedPaper.id });
        } catch (e) {
            alert("Failed to generate summary: " + e);
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800">
            {/* Tab Header */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-colors ${
                        activeTab === 'chat'
                            ? 'border-b-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                >
                    Chat Copilot
                </button>
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-colors ${
                        activeTab === 'summary'
                            ? 'border-b-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                >
                    AI Summary
                </button>
                <button
                    onClick={() => setActiveTab('notes')}
                    className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-colors ${
                        activeTab === 'notes'
                            ? 'border-b-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                >
                    Notes ({notes.length})
                </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'chat' && (
                    <div className="h-full flex flex-col justify-between">
                        {/* Chat Messages */}
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                        msg.role === 'assistant'
                                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                                    }`}>
                                        {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                                    </div>
                                    <div className={`rounded-lg p-3 text-sm max-w-[85%] ${
                                        msg.role === 'user'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 shadow-sm'
                                    }`}>
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                        {msg.role === 'assistant' && selectedPaper && (
                                            <button
                                                onClick={() => handleSaveNote(msg.content)}
                                                className="mt-2 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-blue-600 transition-colors"
                                            >
                                                <BookmarkPlus size={12} />
                                                Save as note
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/50 space-y-2">
                            <input
                                className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-805 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-800 dark:text-neutral-100"
                                placeholder="Optional selected text/context..."
                                value={selectedTextContext}
                                onChange={(e) => setSelectedTextContext(e.target.value)}
                            />
                            <div className="relative">
                                <input
                                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-805 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-800 dark:text-neutral-100"
                                    placeholder="Ask a question about this paper..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={isLoading}
                                    className="absolute right-2 top-2.5 p-1 text-neutral-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'summary' && (
                    <div className="h-full overflow-auto p-4 space-y-4">
                        {!selectedPaper ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6">
                                <FileText size={40} className="text-neutral-400 mb-3" />
                                <p className="font-semibold text-sm mb-1 text-neutral-700 dark:text-neutral-300">No Paper Selected</p>
                                <p className="text-xs text-neutral-500 max-w-[200px]">Select a paper from the list to view its summary.</p>
                            </div>
                        ) : selectedPaper.oneSentenceSummary || selectedPaper.structuredSummary ? (
                            <div className="space-y-4">
                                {selectedPaper.oneSentenceSummary && (
                                    <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg p-4 shadow-sm">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5 flex items-center gap-1">
                                            <Sparkles size={12} />
                                            Overview
                                        </h4>
                                        <p className="text-sm italic font-medium text-neutral-800 dark:text-neutral-200">
                                            "{selectedPaper.oneSentenceSummary}"
                                        </p>
                                    </div>
                                )}

                                {selectedPaper.structuredSummary && (
                                    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 space-y-3 shadow-sm">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 pb-1.5 border-b border-neutral-100 dark:border-neutral-700">Detailed Summary</h4>
                                        <div className="text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                            {selectedPaper.structuredSummary}
                                        </div>
                                    </div>
                                )}

                                {selectedPaper.tags && selectedPaper.tags.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Keywords</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedPaper.tags.map(tag => (
                                                <span key={tag} className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        onClick={handleGenerateSummary}
                                        disabled={isSummarizing}
                                        className="w-full flex items-center justify-center gap-1.5 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 py-2 rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
                                    >
                                        {isSummarizing ? (
                                            <>
                                                <RefreshCw className="animate-spin" size={14} />
                                                <span>Regenerating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw size={14} />
                                                <span>Update AI Summary</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6">
                                <Bot size={40} className="text-neutral-400 mb-3" />
                                <p className="font-semibold text-sm mb-1 text-neutral-700 dark:text-neutral-300">No AI Summary Yet</p>
                                <p className="text-xs text-neutral-500 mb-4 max-w-[200px]">Generate a smart summary and scientific tags using LLM.</p>
                                <button
                                    onClick={handleGenerateSummary}
                                    disabled={isSummarizing}
                                    className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
                                >
                                    {isSummarizing ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={14} />
                                            <span>Generating Summary...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={14} />
                                            <span>Generate AI Summary</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'notes' && (
                    <div className="h-full flex flex-col justify-between p-4">
                        <div className="flex-1 overflow-auto space-y-3 mb-4">
                            {!selectedPaper ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <FileText size={40} className="text-neutral-400 mb-3" />
                                    <p className="font-semibold text-sm mb-1 text-neutral-700 dark:text-neutral-300">No Paper Selected</p>
                                    <p className="text-xs text-neutral-500 max-w-[200px]">Select a paper to view or write notes.</p>
                                </div>
                            ) : notes.length === 0 ? (
                                <p className="text-center text-xs text-neutral-500 mt-8">No notes saved for this paper yet. Highlight text in PDF or save Copilot answers as notes.</p>
                            ) : (
                                notes.map(note => (
                                    <div key={note.id} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 shadow-sm space-y-2 relative group animate-fade-in">
                                        <div className="flex justify-between items-center text-[10px] text-neutral-400">
                                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(note.content);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-opacity"
                                                title="Copy note"
                                            >
                                                <ClipboardCopy size={12} />
                                            </button>
                                        </div>
                                        {note.anchorText && (
                                            <div className="text-[11px] border-l-2 border-neutral-300 dark:border-neutral-600 pl-2 text-neutral-500 italic">
                                                "{note.anchorText}"
                                            </div>
                                        )}
                                        <p className="text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
                                            {note.content}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>

                        {selectedPaper && (
                            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
                                <textarea
                                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-800 dark:text-neutral-100 resize-none h-16"
                                    placeholder="Type a note to save..."
                                    value={newNoteText}
                                    onChange={(e) => setNewNoteText(e.target.value)}
                                />
                                <button
                                    onClick={async () => {
                                        if (!newNoteText.trim()) return;
                                        await handleSaveNote(newNoteText);
                                        setNewNoteText("");
                                    }}
                                    className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-md text-xs font-semibold transition-colors shadow-sm flex items-center justify-center gap-1"
                                >
                                    <Plus size={14} />
                                    <span>Add Note</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
