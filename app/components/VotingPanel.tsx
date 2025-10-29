import { useState } from "react";
import { Player, callFunction } from "../lib/firebase";

interface VotingPanelProps {
  meeting: any;
  player: Player;
  allPlayers: Player[];
  gameId: string;
}

export default function VotingPanel({ meeting, player, allPlayers, gameId }: VotingPanelProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const alivePlayers = allPlayers.filter(p => p.alive);
  const myVote = meeting.votes?.[player.uid];

  const handleVote = async () => {
    if (!selectedTarget || hasVoted) return;

    try {
      const vote = callFunction("submitVote");
      await vote({
        gameId,
        meetingId: meeting.id,
        targetPlayerId: selectedTarget === 'abstain' ? null : selectedTarget
      });
      setHasVoted(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const voteCount: { [key: string]: number } = {};
  if (meeting.votes) {
    Object.values(meeting.votes).forEach((vote: any) => {
      if (vote.target) {
        voteCount[vote.target] = (voteCount[vote.target] || 0) + 1;
      }
    });
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 text-white">
      <h3 className="text-xl font-bold mb-4">Vote to Eject</h3>

      {!player.alive ? (
        <div className="text-center text-gray-500 py-8">
          Dead players cannot vote
        </div>
      ) : myVote ? (
        <div className="text-center py-8">
          <div className="text-lg">You voted for:</div>
          <div className="text-2xl font-bold mt-2">
            {myVote.target ? allPlayers.find(p => p.id === myVote.target)?.nickname : 'Nobody (Abstain)'}
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alivePlayers.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedTarget(p.id!)}
                className={`w-full p-3 rounded-lg text-left flex justify-between items-center ${
                  selectedTarget === p.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <span>{p.nickname}</span>
                {voteCount[p.id!] > 0 && (
                  <span className="bg-red-600 px-2 py-1 rounded text-sm">
                    {voteCount[p.id!]} votes
                  </span>
                )}
              </button>
            ))}

            <button
              onClick={() => setSelectedTarget('abstain')}
              className={`w-full p-3 rounded-lg text-left ${
                selectedTarget === 'abstain' ? 'bg-yellow-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Abstain (Skip Vote)
            </button>
          </div>

          <button
            onClick={handleVote}
            disabled={!selectedTarget || hasVoted}
            className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-3 rounded-lg font-semibold"
          >
            {hasVoted ? 'Vote Submitted' : 'Confirm Vote'}
          </button>
        </>
      )}

      <div className="mt-4 text-sm text-gray-400">
        {Object.keys(meeting.votes || {}).length} / {alivePlayers.length} players voted
      </div>
    </div>
  );
}