
import React, { useState, useEffect, useRef } from 'react';

interface Props {
  onJoin: (roomId: string) => void;
  onCancel: () => void;
}

export const MultiplayerLobby: React.FC<Props> = ({ onJoin, onCancel }) => {
  const [roomId, setRoomId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input on mount
    if (inputRef.current) {
        inputRef.current.focus();
    }

    // Handle ESC key to close
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div 
        className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-[fadeIn_0.3s_ease-out] pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lobby-title"
    >
        <div className="w-full max-w-md border-2 border-emerald-500 p-8 relative overflow-hidden bg-slate-900 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <h2 id="lobby-title" className="text-2xl text-emerald-400 pixel-font mb-6 text-center">NETPLAY PROTOCOL</h2>
            
            <div className="flex flex-col gap-4">
                <div>
                    <label htmlFor="room-input" className="text-xs text-emerald-700 tech-font block mb-2">TARGET ROOM ID</label>
                    <input 
                        id="room-input"
                        ref={inputRef}
                        type="text" 
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                            // Prevent game inputs from triggering while typing
                            e.stopPropagation();
                            if (e.key === 'Enter' && roomId) {
                                onJoin(roomId);
                            }
                        }}
                        placeholder="ROOM-001"
                        className="w-full bg-black border border-emerald-700 text-emerald-400 p-4 text-center pixel-font focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-900 transition-all"
                        autoComplete="off"
                    />
                </div>
                
                <div className="flex gap-4 mt-4">
                    <button 
                        onClick={onCancel}
                        className="flex-1 py-3 border border-red-900 text-red-500 hover:bg-red-900/20 tech-font transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        ABORT
                    </button>
                    <button 
                        onClick={() => roomId && onJoin(roomId)}
                        className="flex-[2] py-3 bg-emerald-700 text-black font-bold hover:bg-emerald-400 tech-font transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                        CONNECT
                    </button>
                </div>
            </div>
            
            <div className="mt-8 text-center">
                 <p className="text-[10px] text-gray-500 tech-font">
                     SERVER STATUS: <span className="text-emerald-500">ONLINE</span><br/>
                     REGION: US-EAST
                 </p>
            </div>
        </div>
    </div>
  );
};
