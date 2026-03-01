/// <reference types="vite/client" />
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface AiCmsContainerProps {
    onClose?: () => void;
    onAddLayer?: (type: 'text' | 'image' | 'shape', data: any) => void;
    selectedStageId?: string | null;
    stages?: any[];
}

const AiCmsContainer: React.FC<AiCmsContainerProps> = ({ onClose, onAddLayer, selectedStageId, stages = [] }) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [messages, setMessages] = useState<{
        role: 'user' | 'ai',
        content: string,
        type?: 'status' | 'result',
        layers?: any[]
    }[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    const apiKey = import.meta.env.VITE_GOOGLE_AI_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleGenerate = async () => {
        if (!prompt.trim() || isGenerating) return;

        const currentStage = stages.find(s => s.id === selectedStageId);
        const stageContext = currentStage ? `
        Current Stage Info:
        - Name: ${currentStage.name}
        - Dimensions: ${currentStage.width}x${currentStage.height}
        - Existing Layers: ${currentStage.layers.length} layers
        ` : 'No stage selected.';

        const userMsg = prompt;
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setPrompt('');
        setIsGenerating(true);

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

            const systemPrompt = `You are an AI Design Assistant for AdCropper.
            
            CRITICAL CONTEXT (The stage you are designing for):
            ${stageContext}
            
            USER REQUEST: "${userMsg}"
            
            RULES:
            1. All coordinates (x, y) and dimensions (width, height) MUST be based on the Stage Dimensions provided above.
            2. The coordinate system starts at (0,0) which is the TOP-LEFT corner of the stage.
            3. FOR BACKGROUND IMAGES: Always set x:0, y:0 and width/height to match the Stage Dimensions exactly.
            4. FOR CENTERED ELEMENTS: Calculate x and y such that the element is centered based on the Stage Dimensions.
            5. Text Variant: The "variant" property must be a stringified JSON containing CSS properties (fontSize, color, fontWeight, textAlign, etc.).
            6. Animations: Use entry animations like fade-in, zoom-in, slide-up.
            
            RESPONSE STRUCTURE:
            - A brief creative description in English.
            - A JSON block containing the suggested layers.
            
            JSON FORMAT EXAMPLE:
            \`\`\`json
            {
              "layers": [
                { 
                  "type": "image", 
                  "name": "Arka Plan",
                  "url": "AI_PROMPT: description of the image content",
                  "x": 0, "y": 0, 
                  "width": (Use Stage Width), "height": (Use Stage Height),
                  "animation": { "entry": { "name": "fade-in", "start": 0, "duration": 1.5 } }
                },
                { 
                  "type": "text", 
                  "name": "Baslik",
                  "content": "Gerçekçi Başlık", 
                  "x": (Calculate for Centering), "y": (Calculate for Layout), 
                  "width": (Realistic Width), "height": (Realistic Height),
                  "variant": "{\\"fontSize\\":\\"48px\\",\\"color\\":\\"#FFFFFF\\",\\"fontWeight\\":\\"800\\",\\"textAlign\\":\\"center\\"}"
                }
              ]
            }
            \`\`\`
            Respond in English. Do not explain the JSON or provide any text after the JSON.`;

            const result = await model.generateContent(systemPrompt);
            const response = await result.response;
            const text = response.text();

            let suggestedLayers = [];
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    suggestedLayers = (parsed.layers || []).map((l: any) => {
                        if (l.type === 'image' && l.url?.startsWith('AI_PROMPT:')) {
                            const genPrompt = l.url.replace('AI_PROMPT:', '').trim();
                            l.url = `https://image.pollinations.ai/prompt/${encodeURIComponent(genPrompt)}?width=${l.width || 800}&height=${l.height || 600}&nologo=true&seed=${Math.floor(Math.random() * 10000)}`;
                        }
                        return l;
                    });
                } catch (e) {
                    console.error("Failed to parse AI suggested layers:", e);
                }
            }

            setMessages(prev => [...prev, {
                role: 'ai',
                content: text.replace(/```json\n[\s\S]*?\n```/, '').trim(),
                type: 'result',
                layers: suggestedLayers
            }]);

            // AUTOMATICALLY add layers to the stage
            if (suggestedLayers.length > 0 && onAddLayer) {
                // Use a small delay for better UX (so user sees the message first)
                setTimeout(() => {
                    suggestedLayers.forEach((layer: any) => {
                        onAddLayer(layer.type, layer);
                    });
                }, 1000);
            }

        } catch (error: any) {
            console.error("AI Generation Error:", error);
            setMessages(prev => [...prev, { role: 'ai', content: `Error: ${error.message || 'Failed to generate content.'}`, type: 'status' }]);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="w-80 h-full bg-white border-r border-[#e5e8eb] shadow-sm flex flex-col overflow-hidden relative">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                        <span className="material-symbols-outlined text-white text-[20px]">auto_awesome</span>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-800">AI CMS Tool</h2>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Auto Design</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide bg-gray-50/30">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                            <span className="material-symbols-outlined text-indigo-400 text-[24px]">magic_button</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-700">Live Design Assistant</h3>
                        <p className="text-xs text-gray-500 mt-2">
                            Type what you want, and I will automatically place it on the stage.
                        </p>
                        <div className="grid grid-cols-1 gap-2 mt-6 w-full">
                            {[
                                'Add a sliding title to the stage',
                                'Create a majestic mountain landscape',
                                'Create a campaign design in yellow tones'
                            ].map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => setPrompt(s)}
                                    className="text-[11px] text-left p-2.5 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-gray-600"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] p-3 rounded-2xl text-[12px] leading-relaxed shadow-sm select-text selection:bg-indigo-100 ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-white border border-gray-100 text-gray-700 rounded-tl-none'
                            }`}>
                            <div className="whitespace-pre-wrap">{msg.content}</div>

                            {msg.type === 'result' && msg.layers && msg.layers.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-3">
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                                        Added to Stage
                                    </p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {msg.layers.map((layer, lIdx) => (
                                            <div key={lIdx} className="flex flex-col gap-2 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                                        <span className="material-symbols-outlined text-[16px] text-indigo-500">
                                                            {layer.type === 'image' ? 'image' : layer.type === 'text' ? 'title' : 'pentagon'}
                                                        </span>
                                                        <span className="text-[11px] font-bold text-gray-700 truncate">{layer.name || layer.type}</span>
                                                    </div>
                                                    <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase">Ready</span>
                                                </div>

                                                {layer.type === 'image' && (
                                                    <div className="aspect-video w-full rounded-md overflow-hidden bg-gray-200 border border-indigo-200">
                                                        <img src={layer.url} alt="Gen" className="w-full h-full object-cover" />
                                                    </div>
                                                )}

                                                {layer.type === 'text' && (
                                                    <div className="text-[10px] italic text-gray-500 truncate px-1">
                                                        "{layer.content}"
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isGenerating && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                            </div>
                            <span className="text-[11px] text-gray-400 font-medium">Preparing stage...</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-white border-t border-gray-100">
                <div className="relative group">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleGenerate();
                            }
                        }}
                        placeholder="Ex: Design a discount banner..."
                        className="w-full p-3 pr-10 border border-gray-200 rounded-xl text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-gray-400 min-h-[80px]"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className={`absolute bottom-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${prompt.trim() && !isGenerating
                            ? 'bg-indigo-600 text-white shadow-md hover:scale-105 active:scale-95'
                            : 'bg-gray-100 text-gray-400'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">send</span>
                    </button>
                </div>
                <p className="text-[9px] text-gray-400 mt-2 text-center flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">info</span>
                    Gemini 3 Pro & Pollinations: Full Auto Mode
                </p>
            </div>
        </div>
    );
};

export default AiCmsContainer;
