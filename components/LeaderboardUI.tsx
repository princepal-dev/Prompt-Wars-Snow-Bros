
import React, { useEffect, useState } from 'react';
import { getLeaderboard, LeaderboardEntry } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderboardUI: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getLeaderboard().then(data => {
        setEntries(data);
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-md bg-slate-900 border-2 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)] relative overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-cyan-900/30 p-4 border-b border-cyan-700 flex justify-between items-center shrink-0">
          <h2 className="text-xl text-white pixel-font text-cyan-300">GLOBAL RANKING</h2>
          <button onClick={onClose} className="text-cyan-500 hover:text-white font-bold text-xl">&times;</button>
        </div>

        {/* User Status Bar */}
        <div className="p-4 bg-black/40 border-b border-cyan-900/50 shrink-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src={user?.photoURL || ''} alt="User" className="w-8 h-8 rounded-full border border-cyan-500" />
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-400 tech-font">OPERATOR</span>
                        <span className="text-sm text-white font-bold truncate max-w-[120px]">{user?.displayName}</span>
                    </div>
                </div>
                <button onClick={logout} className="text-[10px] text-red-400 hover:text-red-300 border border-red-900 px-3 py-1 hover:bg-red-900/20 transition-colors">
                    LOGOUT
                </button>
            </div>
            
            {user?.isAnonymous && (
                <div className="mt-3 bg-yellow-900/30 border border-yellow-700 p-2 flex items-center gap-2">
                    <div className="text-yellow-500 text-xs">⚠️</div>
                    <p className="text-[10px] text-yellow-200 tech-font">
                        GUEST MODE: SCORES ARE NOT SAVED TO LEADERBOARD. LOGOUT AND SIGN IN WITH GOOGLE TO COMPETE.
                    </p>
                </div>
            )}
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto crt-scanline flex-1 min-h-0">
          {loading ? (
             <div className="text-center text-cyan-500 py-8 tech-font animate-pulse">FETCHING DATA...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="text-[10px] text-cyan-600 border-b border-cyan-900">
                  <th className="pb-2 pl-2">RANK</th>
                  <th className="pb-2">OPERATOR</th>
                  <th className="pb-2 text-right">WAVE</th>
                  <th className="pb-2 pr-2 text-right">SCORE</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-500 tech-font text-xs">NO RECORDS FOUND</td>
                    </tr>
                ) : (
                    entries.map((entry, index) => {
                    const isMe = user?.uid === entry.uid;
                    return (
                        <tr key={entry.uid} className={`tech-font text-sm ${isMe ? 'bg-cyan-900/40 text-white' : 'text-gray-300'} hover:bg-white/5 transition-colors border-b border-white/5 last:border-0`}>
                        <td className="py-3 pl-2 font-bold text-fuchsia-400">#{index + 1}</td>
                        <td className="py-3 flex items-center gap-2">
                            <img src={entry.photoURL || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${entry.uid}`} className="w-5 h-5 rounded-full bg-slate-800" />
                            <span className="truncate max-w-[120px]">{entry.displayName}</span>
                        </td>
                        <td className="py-3 text-right text-gray-500">{entry.highestWave}</td>
                        <td className="py-3 pr-2 text-right font-mono text-cyan-300">{entry.highScore.toLocaleString()}</td>
                        </tr>
                    );
                    })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 bg-black text-center text-[10px] text-gray-600 tech-font border-t border-cyan-900 shrink-0">
           SECURE CONNECTION :: FIREBASE
        </div>
      </div>
    </div>
  );
};
