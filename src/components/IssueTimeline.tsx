import { useEffect, useState } from 'react';
import { subscribeStatusHistory, getStatusStyle } from '../utils/statusHistoryService';
import { StatusHistory } from '../types';
import { 
  Send, 
  Sparkles, 
  UserCheck, 
  CheckCircle2, 
  Wrench, 
  Check, 
  Eye, 
  Lock, 
  RefreshCw,
  HelpCircle,
  Clock,
  Calendar
} from 'lucide-react';

interface IssueTimelineProps {
  issueId: string;
}

export default function IssueTimeline({ issueId }: IssueTimelineProps) {
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Subscribe to status history of this specific issue in real-time
    const unsubscribe = subscribeStatusHistory(issueId, (data) => {
      setHistory(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [issueId]);

  const getStepIcon = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'SUBMITTED':
      case 'REPORTED':
        return <Send className="w-4 h-4 text-blue-600" />;
      case 'AI_ANALYZING':
      case 'IN-REVIEW':
        return <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />;
      case 'ASSIGNED':
        return <UserCheck className="w-4 h-4 text-indigo-600" />;
      case 'ACCEPTED':
        return <CheckCircle2 className="w-4 h-4 text-cyan-600" />;
      case 'IN_PROGRESS':
      case 'IN-PROGRESS':
        return <Wrench className="w-4 h-4 text-amber-600 animate-spin-slow" />;
      case 'RESOLVED':
        return <Check className="w-4 h-4 text-emerald-600" />;
      case 'VERIFICATION_PENDING':
        return <Eye className="w-4 h-4 text-yellow-600" />;
      case 'CLOSED':
      case 'VERIFIED':
        return <Lock className="w-4 h-4 text-emerald-600" />;
      case 'REOPENED':
        return <RefreshCw className="w-4 h-4 text-rose-600 animate-spin" style={{ animationDuration: '3s' }} />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-2">
        <Clock className="w-5 h-5 text-slate-400 animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Loading issue tracking timeline...</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
        <HelpCircle className="w-8 h-8 text-slate-350 mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-bold">No lifecycle history logged yet.</p>
        <p className="text-[10px] text-slate-400 mt-1">Status changes will appear here as they occur.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-navy" />
          <span>Real-time Issue Audit Trail</span>
        </h4>
        <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono font-bold">
          {history.length} Event{history.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
        {history.map((event, index) => {
          const style = getStatusStyle(event.currentStatus);
          const isLatest = index === history.length - 1;

          return (
            <div key={event.id || index} className="relative group transition-all duration-300">
              {/* Outer circle dot */}
              <div className={`absolute -left-[23px] top-1 w-6 h-6 rounded-full flex items-center justify-center bg-white border-2 transition-colors duration-300 z-10 ${
                isLatest ? 'border-navy shadow-md ring-4 ring-navy/5' : 'border-slate-200 group-hover:border-slate-300'
              }`}>
                {getStepIcon(event.currentStatus)}
              </div>

              {/* Step info card */}
              <div className={`p-3.5 rounded-xl border transition-all duration-300 ${
                isLatest 
                  ? 'bg-slate-50/80 border-slate-200/85 shadow-xs' 
                  : 'bg-white border-slate-100 hover:border-slate-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded font-mono ${style.bg}`}>
                      {style.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                      by {event.updatedBy}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-350" />
                    <span>{formatTimestamp(event.timestamp)}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-650 leading-relaxed font-medium">
                  {event.remarks}
                </p>

                {event.previousStatus && event.previousStatus !== 'NONE' && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center gap-1 text-[9px] text-slate-400 font-mono font-medium">
                    <span>Transition:</span>
                    <span className="line-through">{event.previousStatus}</span>
                    <span>→</span>
                    <span className="font-bold text-slate-500">{event.currentStatus}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
