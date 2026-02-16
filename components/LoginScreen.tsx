
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLeaderboard, LeaderboardEntry } from '../lib/firebase';

export const LoginScreen: React.FC = () => {
  const { loginGoogle, loginGuest, loading } = useAuth();
  const [guestName, setGuestName] = useState('');
  const [mode, setMode] = useState<'SELECT' | 'GUEST_INPUT'>('SELECT');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);

  // Fetch leaderboard immediately on mount (Public Read)
  useEffect(() => {
    const fetchLb = () => {
        getLeaderboard().then(data => {
            setLeaderboard(data);
            setLbLoading(false);
        }).catch(err => {
            console.error("Failed to load public leaderboard", err);
            setLbLoading(false);
        });
    };

    fetchLb();
    // Refresh every 30s
    const interval = setInterval(fetchLb, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim()) {
      loginGuest(guestName.trim());
    }
  };

  if (loading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-500 tech-font animate-pulse">ESTABLISHING UPLINK...</div>
      </div>
    );
  }

  return (
    <div className="relative w-screen min-h-screen flex justify-center items-center bg-[#050505] overflow-hidden p-4">
        {/* Background FX */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-80"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>

        <div className="relative z-10 w-full max-w-6xl flex flex-col md:flex-row gap-6 md:gap-12 items-stretch">
            
            {/* LEFT COLUMN: Game Title & Auth */}
            <div className="flex-1 flex flex-col justify-center">
                <div className="mb-10 text-center md:text-left">
                   <h1 className="text-5xl md:text-6xl lg:text-7xl text-white font-black tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.6)] mb-2 italic skew-x-[-10deg]">
                     SNOW<span className="text-cyan-400">BROS</span>
                   </h1>
                   <div className="text-lg text-fuchsia-400 font-bold tracking-[0.4em] tech-font">AI PROTOCOL 2026</div>
                </div>

                {/* Login Box */}
                <div className="bg-black/85 border border-cyan-800 p-8 shadow-[0_0_50px_rgba(6,182,212,0.15)] backdrop-blur-md relative overflow-hidden">
                   {/* Decorators */}
                   <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500"></div>
                   <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-500"></div>
                   <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-500"></div>
                   <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-500"></div>
                   
                   <div className="mb-6 text-center md:text-left">
                     <h2 className="text-cyan-300 tech-font text-sm tracking-widest mb-1">ACCESS TERMINAL</h2>
                     <p className="text-gray-500 text-[10px] tech-font">LOGIN TO SAVE PROGRESS & COMPETE GLOBALLY</p>
                   </div>

                   {mode === 'SELECT' ? (
                     <div className="flex flex-col gap-4">
                        <button 
                          onClick={() => loginGoogle()}
                          className="group relative flex items-center justify-center gap-3 px-6 py-4 bg-white text-black font-bold hover:bg-cyan-50 transition-all clip-path-polygon focus:outline-none focus:ring-2 focus:ring-cyan-400"
                        >
                           <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                           <span className="pixel-font text-xs">SIGN IN WITH GOOGLE</span>
                           <div className="absolute inset-0 border-2 border-transparent group-hover:border-cyan-400 pointer-events-none"></div>
                        </button>

                        <button 
                          onClick={() => setMode('GUEST_INPUT')}
                          className="group relative px-6 py-4 bg-transparent border border-cyan-800 text-cyan-400 font-bold hover:bg-cyan-900/20 transition-all clip-path-polygon focus:outline-none focus:ring-2 focus:ring-cyan-400"
                        >
                           <span className="pixel-font text-xs">CONTINUE AS GUEST</span>
                        </button>
                     </div>
                   ) : (
                     <form onSubmit={handleGuestSubmit} className="flex flex-col gap-4 animate-[fadeIn_0.3s_ease-out]">
                        <div>
                            <label className="block text-xs text-cyan-600 tech-font mb-2">ENTER CODENAME</label>
                            <input 
                                type="text" 
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="w-full bg-black border border-cyan-700 text-white p-3 text-center pixel-font text-sm focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] placeholder-gray-800"
                                placeholder="PLAYER 1"
                                maxLength={12}
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-2 mt-2">
                            <button 
                                type="button" 
                                onClick={() => setMode('SELECT')}
                                className="flex-1 py-3 border border-red-900 text-red-500 hover:bg-red-900/20 pixel-font text-[10px]"
                            >
                                BACK
                            </button>
                            <button 
                                type="submit" 
                                disabled={!guestName.trim()}
                                className="flex-[2] py-3 bg-cyan-700 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed pixel-font text-[10px]"
                            >
                                ENTER
                            </button>
                        </div>
                     </form>
                   )}

                   <div className="mt-6 pt-4 border-t border-cyan-900/30 text-center md:text-left">
                       <p className="text-[9px] text-gray-600 tech-font">
                           STATUS: ONLINE <br/> 
                           SERVER: US-CENTRAL1
                       </p>
                   </div>
                </div>
            </div>

            {/* RIGHT COLUMN: Public Leaderboard */}
            <div className="flex-1 flex flex-col">
                <div className="bg-slate-900/80 border border-fuchsia-900/50 flex-1 p-0 backdrop-blur-sm relative overflow-hidden flex flex-col shadow-[0_0_30px_rgba(192,38,211,0.15)] h-[500px] md:h-auto">
                    {/* Header */}
                    <div className="bg-fuchsia-950/30 p-4 border-b border-fuchsia-800/50 flex justify-between items-center">
                        <h3 className="text-fuchsia-400 font-bold tracking-widest tech-font flex items-center gap-3">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-fuchsia-500"></span>
                            </span>
                            TOP OPERATORS
                        </h3>
                        <span className="text-[10px] text-fuchsia-600 tech-font border border-fuchsia-900 px-2 py-0.5 rounded">LIVE FEED</span>
                    </div>

                    {/* Table */}
                    <div className="overflow-y-auto flex-1 p-2 crt-scanline">
                        {lbLoading ? (
                             <div className="h-full flex flex-col items-center justify-center gap-2 text-fuchsia-500/50">
                                 <div className="w-8 h-8 border-2 border-t-transparent border-fuchsia-500 rounded-full animate-spin"></div>
                                 <span className="text-xs tech-font">DOWNLOADING DATA...</span>
                             </div>
                        ) : leaderboard.length === 0 ? (
                             <div className="h-full flex items-center justify-center text-gray-500 text-xs tech-font">NO DATA AVAILABLE</div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-slate-900/95 z-10 backdrop-blur">
                                    <tr className="text-[10px] text-fuchsia-600 border-b border-fuchsia-900/30">
                                        <th className="pb-2 pl-2">RANK</th>
                                        <th className="pb-2">OPERATOR</th>
                                        <th className="pb-2 text-right">LVL</th>
                                        <th className="pb-2 pr-2 text-right">SCORE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map((entry, index) => (
                                        <tr key={entry.uid || index} className="text-sm text-gray-300 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 group">
                                            <td className="py-3 pl-2 font-bold text-cyan-500 tech-font group-hover:text-cyan-300">
                                                {index + 1 <= 3 ? ['🥇','🥈','🥉'][index] : `#${index + 1}`}
                                            </td>
                                            <td className="py-3 flex items-center gap-3">
                                                <img src={entry.photoURL || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${entry.uid}`} className="w-6 h-6 rounded-full bg-slate-800 border border-gray-700" alt="Avatar" />
                                                <span className="truncate max-w-[100px] md:max-w-[140px] font-bold text-xs md:text-sm tech-font">{entry.displayName}</span>
                                            </td>
                                            <td className="py-3 text-right text-gray-500 tech-font">{entry.highestWave}</td>
                                            <td className="py-3 pr-2 text-right font-mono text-fuchsia-300 group-hover:text-fuchsia-100">{entry.highScore.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    
                    {/* Footer Legend */}
                    <div className="p-2 bg-black/60 border-t border-fuchsia-900/30 text-[9px] text-gray-600 tech-font flex justify-between">
                         <span>RANKING: GLOBAL</span>
                         <span>UPDATES: REAL-TIME</span>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};
