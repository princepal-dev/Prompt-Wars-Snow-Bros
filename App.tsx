import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './core/GameEngine';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  const [uiState, setUiState] = useState({
    score: 0,
    wave: 0,
    lives: 3,
    message: "SYSTEM READY",
    blizzard: false,
    gameOver: false
  });

  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(canvasRef.current, (data) => {
        setUiState(prev => ({ ...prev, ...data }));
      });
    }
  }, []);

  const handleStart = () => {
    if (engineRef.current && !hasStarted) {
      engineRef.current.start();
      setHasStarted(true);
      setUiState(prev => ({ ...prev, message: "INITIATING WAVE 1...", lives: 3 }));
    } else if (engineRef.current && uiState.message.includes("GAME OVER")) {
        window.location.reload();
    }
  };

  return (
    <div className="relative w-screen h-screen flex justify-center items-center bg-zinc-950 overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-80"></div>
      
      {/* HUD Layer */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-6 flex flex-col justify-between z-30">
        
        {/* Top Header Bar */}
        <div className="flex justify-between items-start w-full max-w-5xl mx-auto">
          
          {/* Left Panel: Score & Lives */}
          <div className="flex flex-col gap-2">
            <div className="bg-black/60 backdrop-blur-sm border border-cyan-500/30 p-3 rounded-sm shadow-[0_0_15px_rgba(6,182,212,0.1)] transform skew-x-[-10deg]">
               <div className="transform skew-x-[10deg]">
                  <div className="text-xs text-cyan-500 tracking-widest font-bold mb-1 tech-font">SCORE INT</div>
                  <div className="text-2xl text-white pixel-font text-shadow-cyan">{uiState.score.toString().padStart(6, '0')}</div>
               </div>
            </div>

            <div className="bg-black/60 backdrop-blur-sm border border-red-500/30 p-2 rounded-sm transform skew-x-[-10deg] w-fit">
               <div className="transform skew-x-[10deg] flex items-center gap-2">
                  <span className="text-xs text-red-400 font-bold tech-font">VITALS</span>
                  <div className="flex space-x-1">
                    {[...Array(3)].map((_, i) => (
                      <span key={i} className={`text-lg transition-all duration-300 ${i < uiState.lives ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]' : 'text-gray-800'}`}>
                        ♥
                      </span>
                    ))}
                  </div>
               </div>
            </div>
          </div>

          {/* Center Panel: Title (Only visible when playing) */}
          {hasStarted && !uiState.message && (
             <div className="hidden md:block opacity-50">
                <h1 className="text-2xl text-cyan-900/50 font-black tracking-[0.5em] italic">SB-2026</h1>
             </div>
          )}

          {/* Right Panel: Wave & Status */}
          <div className="flex flex-col items-end gap-2">
             <div className="bg-black/60 backdrop-blur-sm border border-fuchsia-500/30 p-3 rounded-sm shadow-[0_0_15px_rgba(232,121,249,0.1)] transform skew-x-[10deg]">
               <div className="transform skew-x-[-10deg] text-right">
                  <div className="text-xs text-fuchsia-500 tracking-widest font-bold mb-1 tech-font">WAVE INDEX</div>
                  <div className="text-2xl text-white pixel-font drop-shadow-[0_0_5px_rgba(232,121,249,0.5)]">
                    {uiState.wave.toString().padStart(2, '0')}
                  </div>
               </div>
            </div>
            
            {uiState.blizzard && (
              <div className="bg-red-900/20 border border-red-500 p-2 animate-pulse">
                <div className="text-red-500 font-bold text-xs tracking-widest tech-font">⚠ BLIZZARD WARNING ⚠</div>
              </div>
            )}
          </div>
        </div>

        {/* Center Screen Messages / Start Menu */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg text-center pointer-events-auto z-50">
          
          {!hasStarted ? (
            <div className="bg-black/80 border-2 border-cyan-500 p-8 shadow-[0_0_50px_rgba(6,182,212,0.3)] backdrop-blur-md clip-path-polygon">
               <h1 className="text-5xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 font-black tracking-tighter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] mb-2 italic">
                 SNOW BROS
               </h1>
               <div className="text-xl text-fuchsia-400 font-bold tracking-[0.3em] mb-8">2026 PROTOCOL</div>
               
               <div className="space-y-4 mb-8">
                 <div className="text-cyan-200/70 tech-font text-sm">SYSTEM STATUS: ONLINE</div>
                 <div className="text-cyan-200/70 tech-font text-sm">AI DIRECTOR: CONNECTED</div>
               </div>

               <button 
                  onClick={handleStart}
                  className="group relative px-8 py-3 bg-cyan-900/30 border border-cyan-400 text-cyan-300 font-bold tracking-widest hover:bg-cyan-500 hover:text-black transition-all duration-200"
               >
                  <span className="absolute inset-0 w-full h-full bg-cyan-400/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
                  <span className="relative pixel-font text-sm animate-pulse">INSERT COIN / START</span>
               </button>
            </div>
          ) : uiState.message ? (
             <div className="pointer-events-none">
                 <h2 className="text-3xl md:text-4xl text-yellow-400 pixel-font drop-shadow-[4px_4px_0_rgba(0,0,0,1)] animate-bounce mb-4">
                   {uiState.message}
                 </h2>
                 {uiState.message.includes("GAME OVER") && (
                    <button 
                      onClick={() => window.location.reload()}
                      className="mt-6 px-6 py-2 bg-red-600 text-white font-bold pixel-font text-xs hover:bg-red-500 pointer-events-auto border-2 border-white shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
                    >
                      RETRY MISSION
                    </button>
                 )}
             </div>
          ) : null}
        </div>

        {/* Footer Controls */}
        <div className="w-full max-w-4xl mx-auto flex justify-center opacity-70">
            <div className="flex gap-8 text-[10px] md:text-xs text-cyan-600/80 tech-font border-t border-cyan-900/50 pt-2 px-8">
                <span className="flex items-center gap-1"><kbd className="bg-cyan-900/30 px-1 rounded">WASD</kbd> MOVE</span>
                <span className="flex items-center gap-1"><kbd className="bg-cyan-900/30 px-1 rounded">SPACE</kbd> JUMP</span>
                <span className="flex items-center gap-1"><kbd className="bg-cyan-900/30 px-1 rounded">L</kbd> SHOOT</span>
            </div>
        </div>
      </div>

      {/* Game Canvas Container */}
      <div className="relative z-20 group">
        {/* Glow behind canvas */}
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-fuchsia-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        
        <canvas 
          ref={canvasRef} 
          className="relative block border-[3px] border-zinc-800 bg-black rounded-sm shadow-2xl crt-flicker"
          style={{ width: '800px', height: '600px', maxWidth: '100vw', maxHeight: '80vh' }}
        />
        
        {/* Canvas overlays */}
        <div className="absolute inset-0 pointer-events-none rounded-sm bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-20"></div>
        <div className="scanline-bar z-20"></div>
        <div className="absolute inset-0 pointer-events-none rounded-sm shadow-[inset_0_0_50px_rgba(0,0,0,0.7)] z-20"></div>
      </div>
    </div>
  );
}