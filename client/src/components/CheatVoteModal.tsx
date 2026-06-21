import { ShieldAlert, CheckCircle2, XCircle } from "lucide-react";


export default function CheatVoteModal({
  clueWord,
  submitterName,
  votes,
  isHost,
  hasVoted,
  onVote,
  onResolve,
  totalEligibleVoters
}: {
  clueWord: string;
  submitterName: string;
  votes: Record<string, 'yes'|'no'>;
  isHost: boolean;
  hasVoted: boolean;
  onVote: (v: 'yes'|'no') => void;
  onResolve: (isCheat: boolean) => void;
  totalEligibleVoters: number;
}) {
  const yesVotes = Object.values(votes).filter(v => v === 'yes').length;
  const noVotes = Object.values(votes).filter(v => v === 'no').length;
  const totalVotes = yesVotes + noVotes;

  console.log("CheatVoteModal rendered with active state");

  return (
    <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-slate-700 shadow-2xl rounded-3xl w-full max-w-lg p-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>

        <h2 className="text-2xl font-black text-white text-center uppercase tracking-widest mb-2">
          Potential Cheat Detected!
        </h2>
        
        <div className="text-slate-300 text-center text-sm md:text-base mb-6 w-full">
          A player has flagged <span className="font-bold text-white">{submitterName}'s</span> clue:
          <div className="bg-slate-800 border border-slate-700 p-3 rounded-xl mt-2 font-black text-xl text-white">
            {clueWord.startsWith('data:image') ? <img src={clueWord} alt="Clue" className="h-12 mx-auto" /> : clueWord}
          </div>
        </div>

        {!isHost ? (
          !hasVoted ? (
            <div className="w-full flex gap-3">
              <button onClick={() => onVote('yes')} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-red-900/50 text-xs sm:text-sm">
                <XCircle className="w-5 h-5" /> Yes, it's a cheat
              </button>
              <button onClick={() => onVote('no')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-900/50 text-xs sm:text-sm">
                <CheckCircle2 className="w-5 h-5" /> No, it's fair
              </button>
            </div>
          ) : (
            <div className="w-full bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
              <p className="text-amber-400 font-bold uppercase tracking-wider text-sm animate-pulse">
                Waiting for the Host's decision...
              </p>
            </div>
          )
        ) : (
          <div className="w-full bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-3 text-center">
              Player Votes ({totalVotes} / {totalEligibleVoters})
            </h3>
            <div className="flex gap-2 mb-6">
              <div className="flex-1 bg-red-900/50 rounded-lg p-2 text-center border border-red-500/30">
                <span className="block text-red-400 text-[10px] font-bold uppercase tracking-widest">Cheats</span>
                <span className="text-2xl font-black text-white">{yesVotes}</span>
              </div>
              <div className="flex-1 bg-emerald-900/50 rounded-lg p-2 text-center border border-emerald-500/30">
                <span className="block text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Fair</span>
                <span className="text-2xl font-black text-white">{noVotes}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => onResolve(true)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm py-3 rounded-xl uppercase tracking-wider shadow-lg active:scale-95 transition-all">
                Confirm Cheat
              </button>
              <button onClick={() => onResolve(false)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm py-3 rounded-xl uppercase tracking-wider shadow-lg active:scale-95 transition-all">
                Declare Fair
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
