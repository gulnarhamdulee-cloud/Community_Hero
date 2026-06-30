import React from 'react';
import { Trophy } from 'lucide-react';
import { MunicipalRanking } from '../features/ranking/useRankings';

interface MunicipalRankingsProps {
  municipalRankings: MunicipalRanking[];
}

const MunicipalRankings: React.FC<MunicipalRankingsProps> = ({ municipalRankings }) => {
  return (
    <div 
      className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs will-change-transform"
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="p-2 bg-[#D97706]/10 text-[#D97706] rounded-xl inline-flex">
          <Trophy className="w-5 h-5" />
        </span>
        <h3 className="font-display font-bold text-sm text-slate-800">Top Performing Municipal Corporations</h3>
      </div>

      <div className="space-y-3">
        {municipalRankings.map((mun, idx) => (
          <div 
            key={mun.city} 
            className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold font-mono text-lg w-5 ${
                idx === 0 ? 'text-[#D97706]' : idx === 1 ? 'text-slate-400' : 'text-amber-700'
              }`}>#{idx + 1}</span>
              <div>
                <h4 className="text-xs font-bold text-slate-800">{mun.municipalBody}</h4>
                <span className="text-[10px] text-slate-400 font-medium">{mun.city} - {mun.state}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-600 font-mono">{mun.resolutionPercentage}% Resolved</span>
              <span className="block text-[9px] text-slate-500 font-medium mt-0.5">Avg {mun.averageResponseTime} hours response</span>
            </div>
          </div>
        ))}
        {municipalRankings.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400 font-mono">
            Establishing Municipal Connections...
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(MunicipalRankings);
