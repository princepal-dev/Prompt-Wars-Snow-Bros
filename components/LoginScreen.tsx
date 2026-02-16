
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { loginGoogle, loginGuest, loading } = useAuth();
  const [guestName, setGuestName] = useState('');
  const [mode, setMode] = useState<'SELECT' | 'GUEST_INPUT'>('SELECT');
  const [reducedMotion, setReducedMotion] = useState(false); // Local toggle just for this screen

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
    <div className="relative w-screen h-screen flex justify-center items-center bg-[#050505] overflow-hidden">
        {/* Background FX */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-80"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>

        <div className="relative z-10 w-full max-w-lg p-8">
            {/* Title Block */}
            <div className="text-center mb-12">
               <h1 className="text-5xl md:text-7xl text-white font-black tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.6)] mb-2 italic skew-x-[-10deg]">
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
               
               <div className="mb-6 text-center">
                 <h2 className="text-cyan-300 tech-font text-sm tracking-widest mb-1">AUTHENTICATION REQUIRED</h2>
                 <p className="text-gray-500 text-[10px] tech-font">IDENTIFY YOURSELF TO ENTER THE ARENA</p>
               </div>

               {mode === 'SELECT' ? (
                 <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => loginGoogle()}
                      className="group relative flex items-center justify-center gap-3 px-6 py-4 bg-white text-black font-bold hover:bg-cyan-50 transition-all clip-path-polygon focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                       <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" />
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

               <div className="mt-6 pt-4 border-t border-cyan-900/30 text-center">
                   <p className="text-[9px] text-gray-600 tech-font">
                       SECURE CONNECTION ESTABLISHED. <br/> 
                       WARNING: GUEST SESSIONS ARE NOT SAVED TO LEADERBOARD.
                   </p>
               </div>
            </div>
        </div>
    </div>
  );
};
