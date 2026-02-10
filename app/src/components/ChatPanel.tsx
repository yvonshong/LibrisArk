import { Send, Bot, User } from "lucide-react";
import { useState } from "react";

export function ChatPanel() {
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Hello! I am your research assistant. How can I help you with this paper?' }
    ]);
    const [input, setInput] = useState("");

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages([...messages, { role: 'user', content: input }]);
        setInput("");

        // Mock response
        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'assistant', content: "I am a mock AI. I can't read the paper yet because the backend isn't connected, but I'm ready to help once we're live!" }]);
        }, 1000);
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
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800">
                <div className="relative">
                    <input
                        className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ask a question..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        className="absolute right-2 top-2 p-1 text-neutral-400 hover:text-blue-600 transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
