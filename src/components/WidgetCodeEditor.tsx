import React, { useState, useEffect, useMemo, useRef } from 'react';
import ColorPicker from './ColorPicker';
import Editor from '@monaco-editor/react';
import FontSelector from './FontSelector';
import WeightSelector from './WeightSelector';
import { FontData } from '../App';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface WidgetProperty {
    id: string;
    name: string;
    type: 'text' | 'number' | 'date' | 'color' | 'font' | 'array' | 'select';
    value?: any;
    fontWeight?: string;
    options?: string[];
}

interface WidgetCodeEditorProps {
    isOpen: boolean;
    onClose: () => void;
    initialHtml: string;
    initialCss: string;
    initialJs: string;
    initialProperties?: WidgetProperty[];
    onSave: (name: string, html: string, css: string, js: string, icon: string, properties: WidgetProperty[]) => void;
    widgetName: string;
    initialIcon?: string;
    fonts?: FontData[];
    showNotification?: (message: string, type: 'error' | 'success' | 'info') => void;
}

const WidgetCodeEditor: React.FC<WidgetCodeEditorProps> = ({
    isOpen,
    onClose,
    initialHtml,
    initialCss,
    initialJs,
    initialProperties = [],
    onSave,
    widgetName,
    initialIcon = 'widgets',
    fonts = [],
    showNotification
}) => {
    const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js' | 'properties' | 'ai'>('html');
    const [html, setHtml] = useState(initialHtml);
    const [css, setCss] = useState(initialCss);
    const [js, setJs] = useState(initialJs);
    const [properties, setProperties] = useState<WidgetProperty[]>(initialProperties);
    const [name, setName] = useState(widgetName);
    const [icon, setIcon] = useState(initialIcon);
    const [optionsText, setOptionsText] = useState<Record<string, string>>({});
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    
    const nameInputRef = useRef<HTMLInputElement>(null);
    const iconPickerRef = useRef<HTMLDivElement>(null);

    const availableIcons = [
        'widgets', 'timer', 'share', 'mail', 'play_circle', 
        'rocket_launch', 'bolt', 'smart_toy', 'star'
    ];

    useEffect(() => {
        if (isOpen) {
            setHtml(initialHtml);
            setCss(initialCss);
            setJs(initialJs);
            setProperties(initialProperties);
            setName(widgetName);
            setIcon(initialIcon);
            setOptionsText({});
            
            // Auto-focus and select name input
            setTimeout(() => {
                if (nameInputRef.current) {
                    nameInputRef.current.focus();
                    nameInputRef.current.select();
                }
            }, 300);
        }
    }, [isOpen, initialHtml, initialCss, initialJs, widgetName, initialIcon]);

    // Close icon picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
                setShowIconPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const combinedContent = useMemo(() => {
        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
                    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
                    <style>
                        * { box-sizing: border-box; }
                        body { 
                            margin: 0; 
                            font-family: 'Outfit', 'Inter', sans-serif;
                            background: transparent;
                            overflow: hidden;
                        }
                        ${css}
                    </style>
                </head>
                <body>
                    ${html}
                    <script>
                        window.widgetProperties = ${JSON.stringify(properties.reduce((acc: any, p: WidgetProperty) => ({ ...acc, [p.name]: p.value }), {}))};
                        try {
                            ${js}
                        } catch (err) {
                            console.error('Widget Script Error:', err);
                        }
                    </script>
                </body>
            </html>
        `;
    }, [html, css, js, properties, previewKey]);

    if (!isOpen) return null;

    const generateWidgetCode = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiGenerating(true);
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_AI_KEY;
            const genAI = new GoogleGenerativeAI(apiKey);
            
            // Using gemini-3-flash-preview as requested
            const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

            const systemPrompt = `You are a professional web widget developer.
Deliver a high-quality, modern, and responsive widget based on the user's description.
Constraints:
- Use only standard HTML5, CSS3, and Vanilla JavaScript.
- Avoid external libraries unless they are essential and can be linked via CDN (but try to avoid if possible).
- The CSS should be scoped to the widget to avoid global conflicts (use unique classes).
- The JavaScript should handle interactivity.
- Your response MUST include three separate markdown code blocks for:
  1. \`\`\`html
  2. \`\`\`css
  3. \`\`\`javascript

User Goal: ${aiPrompt}`;

            const result = await model.generateContent(systemPrompt);
            const response = await result.response;
            const text = response.text();

            // Parse the blocks
            const htmlMatch = text.match(/```html\n([\s\S]*?)\n```/);
            const cssMatch = text.match(/```css\n([\s\S]*?)\n```/);
            const jsMatch = text.match(/```javascript\n([\s\S]*?)\n```/) || text.match(/```js\n([\s\S]*?)\n```/);

            if (htmlMatch) setHtml(htmlMatch[1].trim());
            if (cssMatch) setCss(cssMatch[1].trim());
            if (jsMatch) setJs(jsMatch[1].trim());

            if (!htmlMatch && !cssMatch && !jsMatch) {
                throw new Error("AI failed to provide code in the correct format. Try a clearer description.");
            }

            // Successfully generated, switch back to preview and update it
            setActiveTab('html');
            setPreviewKey(prev => prev + 1);
            showNotification?.("Widget generated successfully!", "success");

        } catch (error: any) {
            console.error("AI Generation Error:", error);
            showNotification?.(`AI Error: ${error.message || 'Unknown error'}`, "error");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleSave = () => {
        onSave(name, html, css, js, icon, properties);
        onClose();
    };

    const getLanguage = () => {
        if (activeTab === 'html') return 'html';
        if (activeTab === 'css') return 'css';
        return 'javascript';
    };

    const getValue = () => {
        if (activeTab === 'html') return html;
        if (activeTab === 'css') return css;
        return js;
    };

    const handleEditorChange = (value: string | undefined) => {
        const val = value || '';
        if (activeTab === 'html') setHtml(val);
        else if (activeTab === 'css') setCss(val);
        else if (activeTab === 'js') setJs(val);
    };

    const addProperty = () => {
        const newProp: WidgetProperty = {
            id: Math.random().toString(36).substr(2, 9),
            name: `variable_${properties.length + 1}`,
            type: 'text'
        };
        setProperties([...properties, newProp]);
    };

    const updateProperty = (id: string, updates: Partial<WidgetProperty>) => {
        setProperties(properties.map((p: WidgetProperty) => p.id === id ? { ...p, ...updates } : p));
    };

    const removeProperty = (id: string) => {
        setProperties(properties.filter((p: WidgetProperty) => p.id !== id));
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300 font-outfit">
            <div className="bg-white w-full max-w-[95vw] h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-4">
                        <div className="relative" ref={iconPickerRef}>
                            <button 
                                onClick={() => setShowIconPicker(!showIconPicker)}
                                className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner hover:bg-primary/20 transition-all group"
                                title="Change Icon"
                            >
                                <span className="material-symbols-outlined text-[26px] group-hover:scale-110 transition-transform">{icon}</span>
                            </button>
                            
                            {showIconPicker && (
                                <div className="absolute top-full left-0 mt-3 p-4 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 grid grid-cols-3 gap-3 z-[1100] animate-in fade-in zoom-in-95 duration-200 w-[180px]">
                                    {availableIcons.map(availIcon => (
                                        <button
                                            key={availIcon}
                                            onClick={() => {
                                                setIcon(availIcon);
                                                setShowIconPicker(false);
                                            }}
                                            className={`size-11 rounded-2xl flex items-center justify-center transition-all ${
                                                icon === availIcon 
                                                ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110' 
                                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-900 group/icon'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[22px] group-hover/icon:scale-110 transition-transform">{availIcon}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-col">
                            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">Widget Development IDE</h2>
                            <div className="flex items-center gap-2">
                                <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
                                <input 
                                    ref={nameInputRef}
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Widget Name"
                                    className="text-sm font-black text-gray-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/20 rounded px-1 -ml-1 w-64 tracking-tight"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 px-4 py-2 bg-green-50/50 border border-green-100/50 rounded-xl text-green-600">
                            <span className="material-symbols-outlined text-[18px]">bolt</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Real-time Engine</span>
                        </div>
                        <button 
                            onClick={onClose}
                            className="size-10 hover:bg-gray-100 rounded-2xl transition-all text-gray-400 hover:text-gray-900 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[24px]">close</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden bg-gray-50/50">
                    {/* Editor Pane */}
                    <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">
                        {/* Tabs */}
                        <div className="flex px-6 pt-3 bg-white gap-2 border-b border-gray-50 overflow-x-auto scrollbar-hide">
                            {[
                                { id: 'ai', label: 'AI GENERATOR', icon: 'auto_awesome', color: 'primary' },
                                { id: 'html', label: 'INDEX.HTML', icon: 'html', color: 'orange' },
                                { id: 'css', label: 'STYLE.CSS', icon: 'css', color: 'blue' },
                                { id: 'js', label: 'SCRIPT.JS', icon: 'javascript', color: 'yellow' },
                                { id: 'properties', label: 'PROPERTIES', icon: 'settings_input_component', color: 'purple' }
                            ].map((tab) => (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-5 py-3 text-[10px] font-black tracking-widest rounded-t-xl transition-all flex items-center gap-2.5 border-b-2 shrink-0 ${
                                        activeTab === tab.id 
                                        ? `bg-gray-50 text-${tab.color === 'primary' ? 'primary' : tab.color + '-600'} border-${tab.color === 'primary' ? 'primary' : tab.color + '-500'} shadow-[0_-4px_12px_rgba(0,0,0,0.02)]` 
                                        : 'text-gray-400 hover:bg-gray-50 border-transparent opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 p-6 overflow-hidden">
                            <div className="h-full rounded-2xl overflow-hidden border border-gray-200 shadow-2xl bg-white relative">
                                {activeTab === 'ai' ? (
                                    <div className="h-full flex flex-col bg-white overflow-y-auto">
                                        <div className="p-8 flex flex-col items-center justify-center max-w-2xl mx-auto w-full gap-8">
                                            <div className="flex flex-col items-center text-center gap-3">
                                                <div className="size-20 rounded-[32px] bg-primary/10 text-primary flex items-center justify-center shadow-inner animate-pulse">
                                                    <span className="material-symbols-outlined text-[42px]">auto_awesome</span>
                                                </div>
                                                <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">AI CMS Generator</h3>
                                                <p className="text-sm text-gray-400 font-medium max-w-md">Describe your widget in plain language and Gemini 3 Flash will build the code for you.</p>
                                            </div>

                                            <div className="w-full flex flex-col gap-4">
                                                <div className="relative group">
                                                    <textarea 
                                                        value={aiPrompt}
                                                        onChange={(e) => setAiPrompt(e.target.value)}
                                                        placeholder="e.g. Create a modern countdown timer with a circular progress bar and pulse animation..."
                                                        className="w-full h-48 p-6 bg-gray-50 border border-gray-100 rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 focus:bg-white transition-all shadow-inner resize-none"
                                                    />
                                                    <div className="absolute bottom-4 right-4 text-[10px] font-bold text-gray-300 uppercase tracking-widest bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-50">
                                                        Gemini 3 Flash Powered
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={generateWidgetCode}
                                                    disabled={isAiGenerating || !aiPrompt.trim()}
                                                    className={`w-full py-5 rounded-[24px] bg-primary text-white font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-[0_20px_40px_-12px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_25px_50px_-12px_rgba(var(--primary-rgb),0.4)] hover:-translate-y-1 active:translate-y-0.5 ${isAiGenerating || !aiPrompt.trim() ? 'opacity-50 grayscale cursor-not-allowed transform-none' : ''}`}
                                                >
                                                    {isAiGenerating ? (
                                                        <>
                                                            <div className="size-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                            Writing Complex Code...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="material-symbols-outlined text-[24px]">rocket_launch</span>
                                                            Generate Custom Widget
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 w-full">
                                                <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-100/50 flex items-center gap-4">
                                                    <span className="material-symbols-outlined text-orange-500">html</span>
                                                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">HTML Structure</span>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50 flex items-center gap-4">
                                                    <span className="material-symbols-outlined text-blue-500">css</span>
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Premium Styling</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : activeTab === 'properties' ? (
                                    <div className="h-full flex flex-col bg-white">
                                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                                            <div className="flex flex-col">
                                                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Design Variables</h3>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Define custom properties for the widget</p>
                                            </div>
                                            <button 
                                                onClick={addProperty}
                                                className="px-4 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:bg-black transition-all flex items-center gap-2 group"
                                            >
                                                <span className="material-symbols-outlined text-[18px] group-hover:rotate-90 transition-transform">add</span>
                                                Add Variable
                                            </button>
                                        </div>
                                        
                                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                                            {properties.length === 0 ? (
                                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                                                    <div className="size-16 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-300 mb-4">
                                                        <span className="material-symbols-outlined text-[32px]">settings_input_component</span>
                                                    </div>
                                                    <h4 className="text-sm font-black text-gray-700 uppercase tracking-tight">No Variables Defined</h4>
                                                    <p className="text-xs text-gray-400 mt-2 max-w-[240px] leading-relaxed">Add variables to make your widget customizable from the design panel.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-4">
                                                    {properties.map((prop: WidgetProperty) => (
                                                        <div key={prop.id} className="group p-5 bg-white border border-gray-100/80 rounded-[24px] shadow-sm hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all flex items-center gap-5">
                                                            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                                <span className="material-symbols-outlined text-[20px]">
                                                                    {prop.type === 'text' ? 'text_fields' : 
                                                                     prop.type === 'number' ? '123' : 
                                                                     prop.type === 'date' ? 'calendar_today' : 
                                                                     prop.type === 'color' ? 'palette' : 
                                                                     prop.type === 'font' ? 'font_download' : 
                                                                     prop.type === 'select' ? 'list' : 'data_object'}
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="flex-1 flex items-center gap-4">
                                                                <div className="flex-[2] flex flex-col gap-1 min-w-0">
                                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Variable Name</label>
                                                                    <input 
                                                                        type="text"
                                                                        value={prop.name}
                                                                        onChange={(e) => updateProperty(prop.id, { name: e.target.value })}
                                                                        className="w-full bg-gray-50/80 border border-gray-100/50 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 transition-all"
                                                                        placeholder="e.g. primaryColor"
                                                                    />
                                                                </div>
                                                                
                                                                <div className="flex-[1] flex flex-col gap-1 min-w-0">
                                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</label>
                                                                    <div className="relative">
                                                                        <select 
                                                                            value={prop.type}
                                                                            onChange={(e) => {
                                                                                const newType = e.target.value as any;
                                                                                let defaultValue = '';
                                                                                if (newType === 'number') defaultValue = '0';
                                                                                if (newType === 'color') defaultValue = '#000000';
                                                                                if (newType === 'select') defaultValue = '';
                                                                                updateProperty(prop.id, { type: newType, value: defaultValue, options: newType === 'select' ? [] : undefined });
                                                                            }}
                                                                            className="w-full bg-gray-50/80 border border-gray-100/50 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 appearance-none cursor-pointer transition-all pr-8"
                                                                        >
                                                                            <option value="text">Text / String</option>
                                                                            <option value="number">Number</option>
                                                                            <option value="date">Date & Time</option>
                                                                            <option value="color">Color</option>
                                                                            <option value="font">Font Family</option>
                                                                            <option value="select">Select Menu</option>
                                                                            <option value="array">Array List</option>
                                                                        </select>
                                                                        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-gray-400 pointer-events-none">expand_more</span>
                                                                    </div>
                                                                </div>
                                                                
                                                                {prop.type === 'select' ? (
                                                                    <div className="flex-[2] flex gap-4 min-w-0">
                                                                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Options (Comma separated)</label>
                                                                            <input 
                                                                                type="text"
                                                                                value={optionsText[prop.id] ?? (prop.options?.join(', ') || '')}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    setOptionsText(prev => ({ ...prev, [prop.id]: val }));
                                                                                    updateProperty(prop.id, { options: val.split(',').map(s => s.trim()).filter(s => s !== '') });
                                                                                }}
                                                                                onBlur={() => {
                                                                                    setOptionsText(prev => {
                                                                                        const next = { ...prev };
                                                                                        delete next[prop.id];
                                                                                        return next;
                                                                                    });
                                                                                }}
                                                                                className="w-full bg-gray-50/80 border border-gray-100/50 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 transition-all"
                                                                                placeholder="Option 1, Option 2..."
                                                                            />
                                                                        </div>
                                                                        <div className="w-36 flex flex-col gap-1 shrink-0">
                                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Default</label>
                                                                            <div className="relative">
                                                                                <select
                                                                                    value={prop.value || ''}
                                                                                    onChange={(e) => updateProperty(prop.id, { value: e.target.value })}
                                                                                    className="w-full bg-gray-50/80 border border-gray-100/50 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 appearance-none cursor-pointer pr-8 transition-all"
                                                                                >
                                                                                    <option value="">None</option>
                                                                                    {prop.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                                                                </select>
                                                                                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-gray-400 pointer-events-none">expand_more</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex-[2] flex flex-col gap-1 min-w-0">
                                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Default Value</label>
                                                                        {prop.type === 'color' ? (
                                                                                <ColorPicker 
                                                                                    value={prop.value || '#000000'}
                                                                                    onChange={(val) => updateProperty(prop.id, { value: val })}
                                                                                />
                                                                        ) : prop.type === 'font' ? (
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="relative flex-1 min-w-0">
                                                                                    <FontSelector 
                                                                                        fonts={fonts}
                                                                                        value={prop.value || 'Outfit'}
                                                                                        onChange={(value) => {
                                                                                            const newFont = fonts.find(f => f.family === value);
                                                                                            const updates: Partial<WidgetProperty> = { value };
                                                                                            if (newFont?.variants) {
                                                                                                const numericWeights = newFont.variants.filter((v: string) => /^\d+/.test(v));
                                                                                                const currentWeight = prop.fontWeight || '400';
                                                                                                if (numericWeights.length > 0 && !numericWeights.includes(currentWeight)) {
                                                                                                    updates.fontWeight = numericWeights.includes('400') ? '400' : numericWeights[0];
                                                                                                }
                                                                                            }
                                                                                            updateProperty(prop.id, updates);
                                                                                        }}
                                                                                        className="w-full h-9 pl-9 pr-3 bg-gray-50/80 border border-gray-100/50 rounded-xl text-xs font-bold text-gray-700 outline-none flex items-center justify-between cursor-pointer transition-all"
                                                                                    />
                                                                                </div>
                                                                                <div className="relative w-32 shrink-0">
                                                                                    <WeightSelector 
                                                                                        weights={(() => {
                                                                                             const currentFont = fonts.find(f => f.family === (prop.value || 'Outfit'));
                                                                                             if (currentFont?.variants) {
                                                                                                 return currentFont.variants.filter((v: string) => /^\d+/.test(v));
                                                                                             }
                                                                                            return ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
                                                                                        })()}
                                                                                        value={prop.fontWeight || '400'}
                                                                                        onChange={(val) => updateProperty(prop.id, { fontWeight: val })}
                                                                                        className="w-full h-9 pl-9 pr-3 bg-gray-50/80 border border-gray-100/50 rounded-xl text-xs font-bold text-gray-700 outline-none flex items-center justify-between cursor-pointer transition-all"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <input 
                                                                                type={prop.type === 'number' ? 'number' : prop.type === 'date' ? 'datetime-local' : 'text'}
                                                                                value={prop.value || ''}
                                                                                onChange={(e) => updateProperty(prop.id, { value: e.target.value })}
                                                                                className="w-full bg-gray-50/80 border border-gray-100/50 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 transition-all"
                                                                                placeholder="Value..."
                                                                            />
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            <button 
                                                                onClick={() => removeProperty(prop.id)}
                                                                className="size-10 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center"
                                                                title="Delete Variable"
                                                            >
                                                                <span className="material-symbols-outlined">delete</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <Editor
                                        height="100%"
                                        language={getLanguage()}
                                        value={getValue()}
                                        onChange={handleEditorChange}
                                        theme="light"
                                        options={{
                                            fontSize: 14,
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                            minimap: { enabled: true },
                                            scrollBeyondLastLine: false,
                                            automaticLayout: true,
                                            padding: { top: 20, bottom: 20 },
                                            renderLineHighlight: 'all',
                                            cursorBlinking: 'smooth',
                                            smoothScrolling: true,
                                            contextmenu: true,
                                            lineNumbersMinChars: 3,
                                            formatOnPaste: true,
                                            tabSize: 4,
                                            letterSpacing: 0.5,
                                            lineHeight: 22,
                                        }}
                                        loading={
                                            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                                                <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                <span className="text-xs font-bold uppercase tracking-widest">Initialising VSCode...</span>
                                            </div>
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preview Pane */}
                    <div className="w-[480px] flex flex-col bg-white">
                        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[20px] text-primary">visibility</span>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-800">Live Workspace</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setPreviewKey((prev: number) => prev + 1)}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary transition-all flex items-center gap-1.5"
                                    title="Reload Preview"
                                >
                                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                                </button>
                                <div className="h-4 w-px bg-gray-100 mx-1"></div>
                                <div className="flex gap-1">
                                    <div className="size-2 rounded-full bg-red-400/20"></div>
                                    <div className="size-2 rounded-full bg-yellow-400/20"></div>
                                    <div className="size-2 rounded-full bg-green-400/20"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex-1 p-8 bg-gray-50/50 flex items-center justify-center relative overflow-hidden">
                            {/* Grid background for designer feel */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                                 style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
                            />
                            
                            <div className="w-full h-full max-w-[400px] max-h-[600px] bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-3xl border border-gray-100 overflow-hidden relative group">
                                <iframe
                                    key={previewKey}
                                    title="preview"
                                    srcDoc={combinedContent}
                                    className="w-full h-full border-none bg-white font-outfit"
                                />
                            </div>
                        </div>
                        
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between bg-white z-10 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">System Ready</p>
                        </div>
                        <div className="h-4 w-px bg-gray-100"></div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                            <span className="text-primary/60">Help:</span> Check console for JS logs
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onClose}
                            className="px-6 py-3 text-xs font-black text-gray-400 hover:text-gray-900 rounded-2xl transition-all uppercase tracking-widest border border-transparent hover:border-gray-100"
                        >
                            Discard
                        </button>
                        <button 
                            onClick={handleSave}
                            className="group px-10 py-3 text-xs font-black text-white bg-primary hover:bg-black rounded-2xl shadow-[0_12px_24px_-8px_rgba(var(--primary-rgb),0.4)] transition-all flex items-center gap-3 uppercase tracking-widest relative overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-3">
                                <span className="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">rocket_launch</span>
                                Sync & Deploy
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WidgetCodeEditor;

