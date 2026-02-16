
import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './core/GameEngine';
import { EnemyTheme } from './types';
import { saveScore } from './lib/firebase';
import { LeaderboardUI } from './components/LeaderboardUI';
import { LoginScreen } from './components/LoginScreen';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="w-screen h-screen bg-black" />; // Flicker prevention
  }

  if (!user) {
    return <LoginScreen />;
  }

  // If user exists, Render the Game Interface
  return <GameInterface />;
}

// Separated Game Interface Component
function GameInterface() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [uiState, setUiState] = useState({
    score: 0,
    wave: 0,
    lives: 3,
    message: "SYSTEM READY",
    blizzard: false,
    gameOver: false,
    enemyTheme: null as EnemyTheme | null,
    isMuted: false,
    bossHealth: null as number | null,
    bossMaxHealth: 100
  });

  const [hasStarted, setHasStarted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showEnemyIntro, setShowEnemyIntro] = useState(false);

  // Handle Game Over Score Save
  useEffect(() => {
    if (uiState.gameOver && user && uiState.score > 0) {
      // Auto-save on game over
      saveScore(user, uiState.score, uiState.wave);
      // Auto-show leaderboard after a short delay
      setTimeout(() => setShowLeaderboard(true), 1500);
    }
  }, [uiState.gameOver, user]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);

    const handleGlobalKey = (e: KeyboardEvent) => {
        if (e.code === 'KeyM') {
            engineRef.current?.toggleAudio();
        }
    };
    window.addEventListener('keydown', handleGlobalKey);

    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(canvasRef.current, (data) => {
        setUiState(prev => {
           if (data.enemyTheme && data.enemyTheme.name !== prev.enemyTheme?.name) {
               setShowEnemyIntro(true);
               setTimeout(() => setShowEnemyIntro(false), 5000); 
           }
           return { ...prev, ...data };
        });
      });
      // Preload Menu Music? 
      // Ideally GameEngine handles music, but if we want Menu music on THIS screen before start:
      // engineRef.current.soundManager.playTrack('MENU');
      // However, browsers block audio until interaction.
    }

    return () => {
      mediaQuery.removeEventListener('change', handler);
      window.removeEventListener('keydown', handleGlobalKey);
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let timer: number;
    if (hasStarted && uiState.message && !uiState.message.includes("GAME OVER")) {
        timer = window.setTimeout(() => {
            setUiState(prev => ({ ...prev, message: "" }));
        }, 5000);
    }
    return () => {
        if (timer) clearTimeout(timer);
    };
  }, [uiState.message, hasStarted]);

  const handleStart = () => {
    if (engineRef.current && !hasStarted) {
      engineRef.current.start();
      setHasStarted(true);
      setUiState(prev => ({ ...prev, message: "ENTERING LEVEL 1...", lives: 3 }));
      setTimeout(() => canvasRef.current?.focus(), 100);
    }
  };
  
  const handleRestart = () => {
      if (engineRef.current) {
          engineRef.current.restart();
          setShowLeaderboard(false);
          setTimeout(() => canvasRef.current?.focus(), 100);
      }
  };

  const toggleMotion = () => setReducedMotion(!reducedMotion);

  const toggleSound = () => {
      engineRef.current?.toggleAudio();
  };

  return (
    <div className="relative w-screen h-screen flex justify-center items-center bg-[#050505] overflow-hidden" role="application" aria-label="Snow Bros 2026 Game">
      
      {!reducedMotion && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-80" aria-hidden="true"></div>
      )}
      
      {/* -------------------- HUD LAYER -------------------- */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-6 flex flex-col justify-between z-30">
        
        {/* Header Bar */}
        <div className="flex justify-between items-start w-full max-w-5xl mx-auto pointer-events-auto">
          
          <div className="flex flex-col gap-2 pointer-events-none">
             <div className="relative">
                 <div className="bg-slate-900/80 border-l-4 border-cyan-500 pl-3 pr-8 py-2 skew-x-[-12deg] shadow-lg shadow-cyan-900/20">
                    <div className="skew-x-[12deg]" role="status" aria-label={`Score ${uiState.score}`}>
                        <div className="text-[10px] text-cyan-400 font-bold tracking-widest tech-font uppercase">Score</div>
                        <div className="text-3xl text-white pixel-font leading-none">{uiState.score.toString().padStart(6, '0')}</div>
                    </div>
                 </div>
             </div>
             
             <div className="relative mt-1">
                 <div className="flex gap-1 items-center bg-slate-900/60 px-2 py-1 rounded-sm w-fit border border-red-900/50" role="status" aria-label={`Health ${uiState.lives} of 3`}>
                    <span className="text-[10px] text-red-500 font-bold tech-font mr-2">HP</span>
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className={`w-3 h-3 rotate-45 border border-red-500 ${i < uiState.lives ? 'bg-red-500 shadow-[0_0_5px_red]' : 'bg-transparent opacity-20'} transition-all duration-300`} aria-hidden="true" />
                    ))}
                 </div>
             </div>
          </div>

          {/* Right: Sound Toggle & Level Info & Leaderboard Button */}
          <div className="flex flex-col items-end gap-2 pointer-events-auto">
             <div className="flex gap-4 items-center mb-2">
                 
                 <button 
                    onClick={() => setShowLeaderboard(true)}
                    className="flex items-center justify-center w-10 h-10 bg-slate-900/80 border border-fuchsia-700 text-fuchsia-400 hover:bg-fuchsia-900/50 transition-colors"
                    title="Leaderboard"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                 </button>

                 <button 
                    onClick={toggleSound}
                    className="flex items-center justify-center w-10 h-10 bg-slate-900/80 border border-cyan-700 text-cyan-400 hover:bg-cyan-900/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-colors"
                    aria-label={uiState.isMuted ? "Unmute Sound" : "Mute Sound"}
                    aria-pressed={uiState.isMuted}
                    title="Toggle Sound (M)"
                 >
                    {uiState.isMuted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                    )}
                 </button>
                 
                 <div className="pointer-events-none bg-slate-900/80 border-r-4 border-fuchsia-500 pr-3 pl-8 py-2 skew-x-[12deg] shadow-lg shadow-fuchsia-900/20 text-right">
                    <div className="skew-x-[-12deg]" role="status" aria-label={`Level ${uiState.wave}`}>
                        <div className="text-[10px] text-fuchsia-400 font-bold tracking-widest tech-font uppercase">LEVEL</div>
                        <div className="text-3xl text-white pixel-font leading-none">{uiState.wave.toString().padStart(2, '0')}</div>
                    </div>
                 </div>
             </div>
             
             {uiState.blizzard && (
               <div className="bg-red-950/80 border border-red-500 px-3 py-1 animate-pulse pointer-events-none" role="alert">
                  <span className="text-red-500 font-bold text-xs tracking-[0.2em] tech-font">⚠ BLIZZARD ⚠</span>
               </div>
             )}

            {uiState.bossHealth !== null && (
                 <div className="mt-4 w-64 bg-slate-900/90 border-2 border-red-600 p-1 shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-[slideIn_0.5s]">
                     <div className="text-[10px] text-red-400 font-bold mb-1 flex justify-between">
                         <span>BOSS INTEGRITY</span>
                         <span>{Math.ceil(uiState.bossHealth)}%</span>
                     </div>
                     <div className="w-full h-3 bg-red-950">
                         <div 
                           className="h-full bg-red-600 transition-all duration-300" 
                           style={{ width: `${(uiState.bossHealth / uiState.bossMaxHealth) * 100}%` }}
                         ></div>
                     </div>
                 </div>
             )}
          </div>
        </div>
        
        <LeaderboardUI 
            isOpen={showLeaderboard} 
            onClose={() => setShowLeaderboard(false)} 
        />

        {showEnemyIntro && uiState.enemyTheme && !uiState.gameOver && (
           <div className="absolute top-1/4 left-0 w-full flex flex-col items-center justify-center animate-[slideIn_0.5s_ease-out]" aria-live="polite">
               <div className="bg-black/90 border-y-2 border-cyan-400 w-full py-8 backdrop-blur-sm relative overflow-hidden">
                   {!reducedMotion && (
                       <div className="absolute inset-0 bg-cyan-900/20 w-full h-full skew-x-[-45deg] translate-x-[-50%] animate-[scanline_2s_linear_infinite]"></div>
                   )}
                   <div className="relative z-10 flex flex-col items-center text-center px-4">
                       <div className="text-cyan-300 tech-font text-sm tracking-[0.5em] mb-2 uppercase">Incoming Threat</div>
                       <h2 className="text-4xl md:text-6xl text-white pixel-font drop-shadow-[4px_4px_0_rgba(6,182,212,0.8)] mb-4" style={{ color: uiState.enemyTheme.color }}>
                           {uiState.enemyTheme.name}
                       </h2>
                       <p className="text-gray-300 max-w-xl tech-font text-lg border-t border-gray-700 pt-2 italic">
                           "{uiState.enemyTheme.description}"
                       </p>
                   </div>
               </div>
           </div>
        )}

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg text-center pointer-events-auto z-50">
          {!hasStarted ? (
            <div className="bg-black/85 border border-cyan-800 p-8 shadow-[0_0_100px_rgba(6,182,212,0.15)] backdrop-blur-md relative">
               <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500"></div>
               <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-500"></div>
               <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-500"></div>
               <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-500"></div>

               <div className="mb-8">
                   <div className="text-sm text-cyan-400 font-bold tech-font tracking-widest mb-2">OPERATIVE: {user?.displayName?.toUpperCase()}</div>
                   <div className="w-16 h-1 bg-cyan-600 mx-auto"></div>
               </div>
               
               <button 
                  onClick={handleStart}
                  className="group relative px-10 py-4 bg-cyan-600 text-black font-bold tracking-widest hover:bg-white hover:scale-105 transition-all duration-200 clip-path-polygon focus:outline-none focus:ring-4 focus:ring-cyan-400"
                  aria-label="Start Game"
               >
                  <span className="relative pixel-font text-sm">INITIALIZE MISSION</span>
               </button>

               <div className="mt-8 flex justify-center gap-4">
                  <button onClick={toggleMotion} className="text-[10px] text-gray-500 hover:text-cyan-400 transition-colors uppercase tracking-widest focus:text-cyan-400 focus:outline-none">
                    [{reducedMotion ? "Enable CRT FX" : "Disable CRT FX"}]
                  </button>
               </div>
            </div>
          ) : (uiState.message && !showEnemyIntro) ? (
             <div className="pointer-events-none flex flex-col items-center">
                 <h2 className={`text-2xl md:text-3xl pixel-font mb-4 drop-shadow-md ${uiState.gameOver ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                   {uiState.message}
                 </h2>
                 
                 {uiState.gameOver && (
                    <div className="flex flex-col gap-4 items-center">
                        <button 
                          onClick={handleRestart}
                          className="mt-6 px-8 py-3 bg-red-600 text-white font-bold pixel-font text-sm hover:bg-red-500 pointer-events-auto border-2 border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.5)] cursor-pointer focus:outline-none focus:ring-4 focus:ring-red-300"
                          aria-label="Restart Game"
                        >
                          RESTART GAME
                        </button>
                        <button
                          onClick={() => setShowLeaderboard(true)}
                          className="text-cyan-400 hover:text-white underline text-xs tech-font pointer-events-auto"
                        >
                            VIEW RANKINGS
                        </button>
                    </div>
                 )}
             </div>
          ) : null}
        </div>

        <div className="w-full max-w-4xl mx-auto flex justify-center opacity-60 hover:opacity-100 transition-opacity duration-300">
            <div className="flex gap-8 text-[10px] text-cyan-500/80 tech-font border-t border-cyan-900/30 pt-3 px-12">
                <span className="flex items-center gap-2"><div className="w-4 h-4 border border-cyan-700 flex items-center justify-center rounded-[2px]">A</div> MOVE</span>
                <span className="flex items-center gap-2"><div className="w-12 h-4 border border-cyan-700 flex items-center justify-center rounded-[2px]">SPACE</div> JUMP</span>
                <span className="flex items-center gap-2"><div className="w-4 h-4 border border-cyan-700 flex items-center justify-center rounded-[2px]">L</div> FIRE</span>
                <span className="flex items-center gap-2"><div className="w-4 h-4 border border-cyan-700 flex items-center justify-center rounded-[2px]">M</div> MUTE</span>
            </div>
        </div>
      </div>

      <div className="relative z-20">
        {!reducedMotion && (
          <div className={`absolute -inset-4 bg-gradient-to-r rounded-lg blur-xl opacity-30 transition-colors duration-1000 ${
              uiState.blizzard ? 'from-white to-cyan-200' : 
              uiState.enemyTheme ? `from-[${uiState.enemyTheme.color}] to-black` : 
              'from-cyan-900 to-fuchsia-900'
          }`}></div>
        )}
        
        <div className="relative border-4 border-[#1a1a1a] bg-black shadow-2xl">
            <canvas 
            ref={canvasRef} 
            tabIndex={0}
            aria-label="Game Screen. Use Arrow keys to move, Space to jump, L to shoot."
            className={`block focus:outline-none cursor-none ${!reducedMotion ? 'crt-flicker' : ''} focus:ring-4 focus:ring-cyan-500`}
            style={{ width: '800px', height: '600px', maxWidth: '100vw', maxHeight: '80vh' }}
            />
            {!reducedMotion && (
            <>
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-20 opacity-40"></div>
                <div className="scanline-bar z-20"></div>
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] z-20"></div>
            </>
            )}
        </div>
      </div>
    </div>
  );
}
