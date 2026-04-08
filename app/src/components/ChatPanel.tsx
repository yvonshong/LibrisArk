import { Send, Bot, User, BookmarkPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Note, Paper } from "../types";

interface ChatPanelProps {
    selectedPaper: Paper | null;
}

export function ChatPanel({ selectedPaper }: ChatPanelProps) {
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Hello! I am your research assistant. How can I help you with this paper?' }
    ]);
    const [input, setInput] = useState("");
    const [selectedTextContext, setSelectedTextContext] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [notes, setNotes] = useState<Note[]>([]);

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

    return (
        <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800">
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 font-medium text-sm">
                Copilot
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'assistant' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'bg-neutral-200 dark:bg-neutral-700'}`}>
                            {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                        </div>
                        <div className={`rounded-lg p-3 text-sm max-w-[85%] ${msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                            }`}>
                            {msg.content}
                            {msg.role === 'assistant' && selectedPaper && (
                                <button
                                    onClick={() => handleSaveNote(msg.content)}
                                    className="mt-2 flex items-center gap-1 text-xs text-neutral-500 hover:text-blue-600"
                                >
                                    <BookmarkPlus size={12} />
                                    Save as note
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="px-3 pb-2">
                <input
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional selected text/context..."
                    value={selectedTextContext}
                    onChange={(e) => setSelectedTextContext(e.target.value)}
                />
            </div>

            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800">
                <div className="relative">
                    <input
                        className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ask a question..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading}
                        className="absolute right-2 top-2 p-1 text-neutral-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>

            {selectedPaper && notes.length > 0 && (
                <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 max-h-40 overflow-auto space-y-2">
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Saved Notes</p>
                    {notes.slice(0, 6).map(note => (
                        <div key={note.id} className="text-xs text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-800 rounded p-2 border border-neutral-200 dark:border-neutral-700">
                            {note.content}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
