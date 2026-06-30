import { useState, memo } from 'react';
import { motion } from 'motion/react';
import { 
  Eye, 
  Tag, 
  AlertOctagon, 
  Copy, 
  Send, 
  FileText, 
  TrendingUp, 
  Sparkles,
  Cpu,
  RefreshCw
} from 'lucide-react';

interface Agent {
  name: string;
  icon: any;
  role: string;
  desc: string;
  status: 'active' | 'evaluating' | 'idle';
  color: string;
  glowColor: string;
}

const AGENTS: Agent[] = [
  {
    name: "Vision Agent",
    icon: Eye,
    role: "Computer Vision parsing",
    desc: "Uses secure Gemini models to visually process images, checking for valid public infrastructure damages (potholes, garbage piles, leaking pipes) while filtering out irrelevant photos.",
    status: "active",
    color: "bg-amber-600",
    glowColor: "shadow-amber-500/20"
  },
  {
    name: "Classification Agent",
    icon: Tag,
    role: "Category determination",
    desc: "Categorizes grievances into administrative classes such as 'Roads & Potholes', 'Sanitation', 'Streetlights', or 'Water Leaks' to establish clear jurisdiction parameters.",
    status: "active",
    color: "bg-blue-600",
    glowColor: "shadow-blue-500/20"
  },
  {
    name: "Severity Agent",
    icon: AlertOctagon,
    role: "Impact assessment",
    desc: "Determines physical risk of the incident and maps severity priority from low, moderate, severe to critical to ensure emergency response for hazardous road anomalies.",
    status: "active",
    color: "bg-rose-600",
    glowColor: "shadow-rose-500/20"
  },
  {
    name: "Duplicate Agent",
    icon: Copy,
    role: "Redundancy suppression",
    desc: "Performs geographic clustering checks and semantic similarity evaluations to recognize duplicate logs of identical potholes, pooling citizen endorsements on a single report.",
    status: "evaluating",
    color: "bg-indigo-600",
    glowColor: "shadow-indigo-500/20"
  },
  {
    name: "Routing Agent",
    icon: Send,
    role: "Autonomous queuing",
    desc: "Coordinates municipal office maps to automatically identify administrative ward boundaries and dispatch specific alerts directly to regional PWD or BBMP engineers.",
    status: "active",
    color: "bg-violet-600",
    glowColor: "shadow-violet-500/20"
  },
  {
    name: "Drafting Agent",
    icon: FileText,
    role: "Multi-lingual compiler",
    desc: "Translates and drafts official public grievance reports in English and regional vernacular (Hindi, Kannada) complete with relevant municipal codes and tracking logs.",
    status: "active",
    color: "bg-emerald-600",
    glowColor: "shadow-emerald-500/20"
  },
  {
    name: "Risk Prediction Agent",
    icon: TrendingUp,
    role: "Spatial pattern analysis",
    desc: "Aggregates geographic density over time to identify cluster risks, warning municipal workers of recurring issues before seasonal monsoons trigger critical damage.",
    status: "idle",
    color: "bg-slate-600",
    glowColor: "shadow-slate-500/10"
  },
  {
    name: "Recommendation Agent",
    icon: Sparkles,
    role: "Prescriptive remediation",
    desc: "Provides citizens with custom recommended safety measures, alternative walking paths, and immediate civic actions to prevent accidents during active repairs.",
    status: "active",
    color: "bg-amber-500",
    glowColor: "shadow-amber-500/20"
  }
];

function AgentsCenter() {
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* Visual Command Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/30">
            <Cpu className="w-5 h-5 text-amber-500 animate-spin-slow" />
          </div>
          <div>
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block">AI Command Center</span>
            <h4 className="text-sm font-bold tracking-tight">Active Civic Agents Network</h4>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>7/8 Agents Live</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-4">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
            <span>0.4s Latency</span>
          </div>
        </div>
      </div>

      {/* Agents Grid with Animated Connections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
        
        {/* Dynamic Glow background based on hovered agent */}
        <div className="absolute inset-0 bg-slate-50/50 rounded-3xl -z-10 transition-colors duration-500" />

        {AGENTS.map((agent) => {
          const IconComponent = agent.icon;
          const isHovered = hoveredAgent === agent.name;

          return (
            <motion.div
              key={agent.name}
              onMouseEnter={() => setHoveredAgent(agent.name)}
              onMouseLeave={() => setHoveredAgent(null)}
              className={`bg-white border p-5 rounded-2xl transition-all duration-300 flex flex-col justify-between relative ${
                isHovered 
                  ? `border-slate-400 shadow-xl ${agent.glowColor} -translate-y-1` 
                  : 'border-slate-200/80 shadow-xs'
              }`}
            >
              {/* Connection laser line simulator */}
              {isHovered && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3.5 bg-gradient-to-b from-transparent to-slate-900" />
              )}

              <div className="space-y-4">
                {/* Agent Icon + Status */}
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl ${agent.color} text-white flex items-center justify-center shadow-lg`}>
                    <IconComponent className="w-5 h-5" />
                  </div>

                  {/* Tiny status badge */}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      agent.status === 'active' ? 'bg-emerald-500' :
                      agent.status === 'evaluating' ? 'bg-amber-500' : 'bg-slate-350'
                    }`} />
                    <span className="text-[8px] font-bold font-mono text-slate-400 uppercase tracking-widest">
                      {agent.status}
                    </span>
                  </div>
                </div>

                {/* Info titles */}
                <div className="space-y-1">
                  <h5 className="text-xs font-extrabold text-slate-900 tracking-tight uppercase">
                    {agent.name}
                  </h5>
                  <span className="text-[10px] font-bold text-slate-400 font-mono block">
                    {agent.role}
                  </span>
                </div>

                {/* Description */}
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  {agent.desc}
                </p>
              </div>

              {/* Laser dot animated line marker at the bottom of agent card */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-mono text-slate-400">AG_ID_0{AGENTS.indexOf(agent) + 1}</span>
                <span className={`text-[9px] font-bold ${
                  agent.status === 'active' ? 'text-emerald-600' :
                  agent.status === 'evaluating' ? 'text-amber-600' : 'text-slate-400'
                }`}>
                  {agent.status === 'active' ? 'Online' : agent.status === 'evaluating' ? 'Pending' : 'Standby'}
                </span>
              </div>

            </motion.div>
          );
        })}
      </div>

      {/* Connection pipeline banner */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider text-center md:text-left">
          ⚡ Multi-Agent Pipeline: Vision Integration → Classification Validation → Spatial Risk Index Routing
        </span>
        <span className="text-[10px] font-mono font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
          STRICT LOCALIZED COMPLIANCE
        </span>
      </div>

    </div>
  );
}

export default memo(AgentsCenter);
