import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceChatContainerProps {
    userId: string;
    userName: string;
    firstName: string;
    lastName: string;
    versionId: string;
    roomId: string;
    setId: string | null;
    collaborators: Record<string, any>; // Record of id -> userData
    onClose: () => void;
    isConnected: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
}

const VoiceChatContainer: React.FC<VoiceChatContainerProps> = ({ 
    userId, userName, firstName, lastName, versionId, roomId, setId, collaborators, onClose, 
    isConnected, isMuted, isDeafened, onConnect, onDisconnect, onToggleMute, onToggleDeafen 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTalkTarget, setActiveTalkTarget] = useState<string | null>(null);
    const [voiceCollaborators, setVoiceCollaborators] = useState<Record<string, any>>({});
    const [isConnecting, setIsConnecting] = useState(false);
    const [lastReceivedFrom, setLastReceivedFrom] = useState<string | null>(null);

    const souncdSocket = useRef<WebSocket | null>(null);
    const mainStreamRef = useRef<MediaStream | null>(null);
    const isManualDisconnectRef = useRef<boolean>(false);
    const isActiveRef = useRef<boolean>(true);
    
    const isMutedRef = useRef(isMuted);
    const isDeafenedRef = useRef(isDeafened);
    const activeTalkTargetRef = useRef(activeTalkTarget);

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { isDeafenedRef.current = isDeafened; }, [isDeafened]);
    useEffect(() => { activeTalkTargetRef.current = activeTalkTarget; }, [activeTalkTarget]);

    const currentTemplateId = (window as any).templateId || roomId || (window as any).versionId || versionId || 'room1';

    const getSupportedMimeType = () => {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
        return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
    };

    const handleDisconnect = useCallback(() => {
        isManualDisconnectRef.current = true;
        isActiveRef.current = false;
        onDisconnect();
        setActiveTalkTarget(null);
        if (mainStreamRef.current) {
            mainStreamRef.current.getTracks().forEach(t => t.stop());
            mainStreamRef.current = null;
        }
        if (souncdSocket.current) {
            souncdSocket.current.close();
            souncdSocket.current = null;
        }
    }, [onDisconnect]);

    // Removal of automatic disconnect on unmount to satisfy "Don't disconnect on X" requirement
    useEffect(() => {
        isActiveRef.current = true;
        // We only cleanup if the whole app is destroyed or if user manually disconnects (handled in toggle)
    }, []);

    const playBase64Audio = (base64Data: string, fromId: string, mimeType: string = 'audio/webm') => {
        if (isDeafenedRef.current) return;
        try {
            setLastReceivedFrom(fromId);
            setTimeout(() => setLastReceivedFrom(null), 1200);
            const decodedMime = mimeType || 'audio/webm';
            const audio = new Audio(`data:${decodedMime};base64,${base64Data}`);
            audio.play().catch(e => {
                if (e.name === 'NotSupportedError' && decodedMime.includes('webm')) {
                    const altAudio = new Audio(`data:audio/mp4;base64,${base64Data}`);
                    altAudio.play().catch(() => {});
                }
            });
        } catch (e) {}
    };

    const initVoiceSocket = useCallback(async () => {
        const wsUrl = `wss://test-tool-vc.adcropper.com/sound?roomId=${encodeURIComponent(currentTemplateId)}&userId=${encodeURIComponent(userId)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`;
        console.log(`🔌 [SoundSocket] INITIATING: ${wsUrl}`);
        
        const socket = new WebSocket(wsUrl);
        souncdSocket.current = socket;

        socket.onopen = () => {
            console.log('✅ [SoundSocket] Connected');
            onConnect();
            setIsConnecting(false);
            isManualDisconnectRef.current = false;
            socket.send(JSON.stringify({
                type: 'join',
                roomId: currentTemplateId,
                userId: userId,
                firstName: firstName,
                lastName: lastName,
                timestamp: Date.now()
            }));
        };

        socket.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'audio' && message.content && message.userId !== userId) {
                    playBase64Audio(message.content, message.userId, message.mimeType);
                } else if (message.type === 'VOICE_USER_LIST' || message.type === 'user_list') {
                    const usersRecord: Record<string, any> = {};
                    const usersList = Array.isArray(message.users) ? message.users : [];
                    usersList.forEach((u: any) => usersRecord[u.userId || u.id] = u);
                    setVoiceCollaborators(usersRecord);
                }
            } catch (err) {}
        };

        socket.onclose = () => {
            setIsConnecting(false);
            if (!isManualDisconnectRef.current) setTimeout(() => initVoiceSocket(), 3000);
            else if (isConnected) onDisconnect();
        };
        socket.onerror = () => setIsConnecting(false);
    }, [currentTemplateId, userId, firstName, lastName, isConnected, onConnect, onDisconnect]);

    useEffect(() => {
        if (!isConnected || isMuted) return;

        const startClipRecording = async () => {
            if (!isActiveRef.current || isMutedRef.current) return;
            try {
                if (!mainStreamRef.current) {
                    mainStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                }
                const mime = getSupportedMimeType();
                const recorder = new MediaRecorder(mainStreamRef.current, { mimeType: mime });
                const chunks: Blob[] = [];
                recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                recorder.onstop = () => {
                    if (chunks.length > 0 && isActiveRef.current && !isMutedRef.current) {
                        const blob = new Blob(chunks, { type: mime });
                        const reader = new FileReader();
                        reader.readAsDataURL(blob);
                        reader.onloadend = () => {
                            const base64 = (reader.result as string).split(',')[1];
                            if (base64 && base64.length > 100) {
                                const payload: any = {
                                    type: 'audio',
                                    roomId: currentTemplateId,
                                    userId: userId,
                                    firstName: firstName,
                                    lastName: lastName,
                                    content: base64,
                                    mimeType: mime,
                                    timestamp: Date.now()
                                };
                                if (activeTalkTargetRef.current) payload.targetUserId = activeTalkTargetRef.current;
                                souncdSocket.current?.send(JSON.stringify(payload));
                            }
                        };
                    }
                    if (isActiveRef.current && !isMutedRef.current && isConnected) setTimeout(startClipRecording, 10);
                };
                recorder.start();
                setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 1000);
            } catch (err) {}
        };
        startClipRecording();
    }, [isConnected, isMuted, currentTemplateId, userId, firstName, lastName]);

    const startTalkingTo = (id: string) => { if (!isConnected || isMuted) return; setActiveTalkTarget(id); };
    const stopTalkingTo = () => setActiveTalkTarget(null);

    const toggleConnect = async () => {
        if (isConnected) handleDisconnect();
        else { setIsConnecting(true); isManualDisconnectRef.current = false; isActiveRef.current = true; await initVoiceSocket(); }
    };

    const listToUse = isConnected && Object.keys(voiceCollaborators).length > 0 ? voiceCollaborators : collaborators;
    const filteredUsers = Object.entries(listToUse).filter(([id, data]) => {
        if (id === userId) return false;
        const name = data.name || data.firstName || 'User';
        return !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="w-[320px] bg-white border-r border-[#e5e8eb] flex flex-col shrink-0 h-full animate-in slide-in-from-left-4 duration-300 shadow-[2px_0_15px_rgba(0,0,0,0.02)]">
            {/* Header with Quick Controls */}
            <div className="px-5 py-4 border-b border-[#e5e8eb] flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">headset_mic</span>
                    <h2 className="text-sm font-bold text-gray-800 tracking-tight">Sound Chat</h2>
                </div>
                
                <div className="flex items-center gap-1.5">
                    {isConnected && (
                        <>
                            <button 
                                onClick={onToggleMute}
                                className={`size-8 rounded-lg flex items-center justify-center transition-all ${isMuted ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:bg-gray-100'}`}
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                <span className="material-symbols-outlined text-[18px]">{isMuted ? 'mic_off' : 'mic'}</span>
                            </button>
                            <button 
                                onClick={onToggleDeafen}
                                className={`size-8 rounded-lg flex items-center justify-center transition-all ${isDeafened ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:bg-gray-100'}`}
                                title={isDeafened ? "Undeafen" : "Deafen"}
                            >
                                <span className="material-symbols-outlined text-[18px]">{isDeafened ? 'headset_off' : 'headset'}</span>
                            </button>
                            <div className="w-[1px] h-4 bg-gray-200 mx-0.5"></div>
                        </>
                    )}
                    <button onClick={onClose} className="size-8 rounded-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            </div>

            {/* Connection Area */}
            <div className="p-5 flex flex-col gap-4 border-b border-[#e5e8eb]">
                <button onClick={toggleConnect} disabled={isConnecting}
                    className={`w-full py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm ${isConnected ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 'bg-primary text-white hover:bg-primary/90'} ${isConnecting ? 'opacity-70 cursor-wait' : ''}`}>
                    <span className={`material-symbols-outlined text-[18px] ${isConnecting ? 'animate-spin' : ''}`}>
                        {isConnecting ? 'sync' : isConnected ? 'call_end' : 'call'}
                    </span>
                    {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
                </button>

                {isConnected && !isMuted && (
                    <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-50 rounded-xl border border-green-100 animate-pulse">
                        <span className="material-symbols-outlined text-green-500 text-[14px]">graphic_eq</span>
                        <span className="text-[10px] font-bold text-green-700">{activeTalkTarget ? 'PTT TARGETED' : 'ROOM LIVE'}</span>
                    </div>
                )}
            </div>

            {/* User List Detail */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2 bg-gray-50/30">
                {listToUse && filteredUsers.map(([id, data]) => {
                    const isTalking = activeTalkTarget === id;
                    const isHeTalking = lastReceivedFrom === id;
                    const name = data.name || data.firstName || id;
                    return (
                        <div key={id} 
                            onMouseDown={() => startTalkingTo(id)} onMouseUp={stopTalkingTo} onMouseLeave={stopTalkingTo}
                            className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none group ${isTalking ? 'bg-primary/10 border-primary' : isHeTalking ? 'bg-green-50 border-green-300 shadow-sm scale-[1.02]' : 'bg-white border-gray-100 hover:border-gray-300 hover:translate-x-0.5'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`size-10 rounded-xl flex items-center justify-center text-white font-bold transition-all ${isHeTalking ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : isTalking ? 'bg-primary' : 'bg-gray-800'}`}>
                                    {name[0].toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-[12px] font-bold ${isTalking ? 'text-primary' : 'text-gray-800'}`}>{name}</span>
                                    <span className={`text-[9px] ${isTalking ? 'text-primary' : 'text-gray-400'}`}>{isHeTalking ? 'SPEAKING...' : isTalking ? 'PTT ACTIVE' : 'Hold to talk private'}</span>
                                </div>
                            </div>
                            <span className={`material-symbols-outlined text-[18px] ${isHeTalking ? 'text-green-600 animate-bounce' : isTalking ? 'text-primary animate-pulse' : 'text-gray-300'}`}>
                                {isHeTalking ? 'volume_up' : 'mic'}
                            </span>
                        </div>
                    );
                })}
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }`}</style>
        </div>
    );
};

export default VoiceChatContainer;
