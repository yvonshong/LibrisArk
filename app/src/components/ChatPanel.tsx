import { Send, Bot, User, BookmarkPlus, Sparkles, RefreshCw, Plus, FileText, ClipboardCopy, Info, Trash2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import ReactMarkdown from 'react-markdown';
import { invoke } from "@tauri-apps/api/core";
import { Note, Paper } from "../types";

interface ChatPanelProps {
    selectedPaper: Paper | null;
    externalSelectedText?: string;
    onNoteClick?: (note: Note) => void;
}

export function ChatPanel({ selectedPaper, externalSelectedText, onNoteClick }: ChatPanelProps) {
    const [activeTab, setActiveTab] = useState<'copilot' | 'notes' | 'info'>('copilot');
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [input, setInput] = useState("");
    const [selectedTextContext, setSelectedTextContext] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNoteText, setNewNoteText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!selectedPaper) {
            setNotes([]);
            setMessages([]);
            return;
        }

        invoke<Note[]>("get_notes", { paperId: selectedPaper.id })
            .then(setNotes)
            .catch((error) => console.error("Failed to load notes:", error));
            
        invoke<{ role: string, content: string }[]>("get_chat_history", { paperId: selectedPaper.id })
            .then(history => {
                setMessages(history.filter(m => m.role !== 'system')); // Hide system prompt from UI
            })
            .catch((error) => console.error("Failed to load chat history:", error));
    }, [selectedPaper]);

    useEffect(() => {
        if (externalSelectedText) {
            setSelectedTextContext(externalSelectedText);
            if (activeTab !== 'copilot') {
                setActiveTab('notes');
            }
        } else {
            setSelectedTextContext("");
        }
    }, [externalSelectedText]);

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

    const handleStartCopilot = async () => {
        if (!selectedPaper) return;
        try {
            setIsInitializing(true);
            await invoke("start_copilot_session", { paperId: selectedPaper.id });
            const history = await invoke<{ role: string, content: string }[]>("get_chat_history", { paperId: selectedPaper.id });
            setMessages(history.filter(m => m.role !== 'system'));
        } catch (e) {
            alert("Failed to start copilot: " + e);
        } finally {
            setIsInitializing(false);
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

    const handleDeleteNote = async (noteId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedPaper) return;

        try {
            await invoke("delete_note", { noteId });
            const refreshed = await invoke<Note[]>("get_notes", { paperId: selectedPaper.id });
            setNotes(refreshed);
        } catch (error) {
            console.error("Failed to delete note:", error);
        }
    };

    return (
        <div className="h-full flex bg-neutral-50 dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800">
            {/* Tab Header (Vertical) */}
            <div className="flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 w-14 items-center py-4 space-y-4 shrink-0">
                <button
                    onClick={() => setActiveTab('copilot')}
                    title="AI Copilot"
                    className={`p-2 rounded-lg transition-colors ${
                        activeTab === 'copilot'
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                >
                    <Bot size={20} />
                </button>
                <button
                    onClick={() => setActiveTab('notes')}
                    title="Notes"
                    className={`p-2 rounded-lg transition-colors relative ${
                        activeTab === 'notes'
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                >
                    <FileText size={20} />
                    {notes.length > 0 && (
                        <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            {notes.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('info')}
                    title="Paper Info"
                    className={`p-2 rounded-lg transition-colors ${
                        activeTab === 'info'
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                >
                    <Info size={20} />
                </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'copilot' && (
                    <div className="h-full flex flex-col justify-between">
                        {!selectedPaper ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6">
                                <Bot size={40} className="text-neutral-400 mb-3" />
                                <p className="font-semibold text-sm mb-1 text-neutral-700 dark:text-neutral-300">AI Copilot</p>
                                <p className="text-xs text-neutral-500 max-w-[200px]">Select a paper to start your copilot session.</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6">
                                <Sparkles size={40} className="text-blue-500 mb-4 animate-pulse" />
                                <p className="font-semibold text-base mb-2 text-neutral-800 dark:text-neutral-200">Start AI Copilot</p>
                                <p className="text-sm text-neutral-500 mb-6 max-w-[240px]">
                                    Initialize the copilot to extract a summary, generate smart tags, and start a chat session.
                                </p>
                                <button
                                    onClick={handleStartCopilot}
                                    disabled={isInitializing}
                                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95"
                                >
                                    {isInitializing ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={16} />
                                            <span>Initializing Session...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={16} />
                                            <span>Start Copilot...</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <>
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
                                                <div className={`prose prose-sm dark:prose-invert max-w-none ${msg.role === 'user' ? 'prose-p:text-white prose-headings:text-white prose-strong:text-white prose-a:text-blue-200' : ''}`}>
                                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                </div>
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
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/50 space-y-2">
                                    {selectedTextContext && (
                                        <div className="relative group">
                                            <div className="border-l-4 border-neutral-300 dark:border-neutral-600 pl-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 italic bg-neutral-50 dark:bg-neutral-900/30 rounded-r-md max-h-24 overflow-y-auto break-words">
                                                {selectedTextContext}
                                            </div>
                                            <button
                                                onClick={() => setSelectedTextContext('')}
                                                className="absolute top-1 right-1 p-1 bg-white dark:bg-neutral-800 rounded-md shadow-sm border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Clear context"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}
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
                                            disabled={isLoading || !input.trim()}
                                            className="absolute right-2 top-2.5 p-1 text-neutral-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                                        >
                                            {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </>
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
                                    <div 
                                        key={note.id} 
                                        className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 shadow-sm space-y-2 relative group animate-fade-in cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                                        onClick={() => onNoteClick?.(note)}
                                    >
                                        <div className="flex justify-between items-center text-[10px] text-neutral-400">
                                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(note.content);
                                                    }}
                                                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-opacity"
                                                    title="Copy note"
                                                >
                                                    <ClipboardCopy size={12} />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleDeleteNote(note.id, e)}
                                                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-opacity"
                                                    title="Delete note"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
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

                {activeTab === 'info' && (
                    <div className="h-full overflow-auto p-4 space-y-4">
                        {!selectedPaper ? (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <Info size={40} className="text-neutral-400 mb-3" />
                                <p className="font-semibold text-sm mb-1 text-neutral-700 dark:text-neutral-300">No Paper Selected</p>
                                <p className="text-xs text-neutral-500 max-w-[200px]">Select a paper to view its info.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 text-sm">
                                <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">Title</h4>
                                    <p className="font-medium text-neutral-900 dark:text-neutral-100">{selectedPaper.title || "Untitled"}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">Year</h4>
                                        <p className="text-neutral-800 dark:text-neutral-200">{selectedPaper.year || "Unknown"}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">DOI</h4>
                                        <p className="text-neutral-800 dark:text-neutral-200">{selectedPaper.doi || "Unknown"}</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">File Path</h4>
                                    <p className="text-xs text-neutral-600 dark:text-neutral-400 break-all bg-neutral-100 dark:bg-neutral-800 p-2 rounded">{selectedPaper.path}</p>
                                </div>
                                {(selectedPaper.tags?.length || 0) > 0 && (
                                    <div>
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">Tags</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedPaper.tags.map(tag => (
                                                <span key={tag} className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
