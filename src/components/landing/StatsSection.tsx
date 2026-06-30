import { memo } from 'react';
import { motion } from 'motion/react';
import { 
  Building, 
  Users, 
  MapPin, 
  Sparkles,
  AlertTriangle,
  Clock,
  Trash2,
  CheckCircle2
} from 'lucide-react';

interface StatItem {
  number: string;
  label: string;
  desc: string;
  icon: any;
  color: string;
}

const PROBLEM_STATS: StatItem[] = [
  {
    number: "3,562+",
    label: "Pothole Related Casualties",
    desc: "Average annual life losses in India caused primarily by un-flagged road craters and broken asphalt patches. Community Hero provides real-time warnings to save lives.",
    icon: AlertTriangle,
    color: "border-rose-200 bg-rose-50/50 text-rose-800"
  },
  {
    number: "62M Tons",
    label: "Annual Solid Waste",
    desc: "The volume of solid waste generated across Indian cities every single year, of which over 30% remains completely un-cleared or openly burned due to reporting bottlenecks.",
    icon: Trash2,
    color: "border-amber-200 bg-amber-50/50 text-amber-800"
  },
  {
    number: "22 Days",
    label: "Avg Resolution Lag",
    desc: "The typical duration a standard physical grievance letter remains pending in municipality file systems. Community Hero cuts this latency down to under 48 hours using automated digital routing.",
    icon: Clock,
    color: "border-blue-200 bg-blue-50/50 text-blue-800"
  }
];

function StatsSection() {
  return (
    <div className="space-y-12">
      
      {/* 1. Indian Civic Problem Statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PROBLEM_STATS.map((stat, idx) => {
          const IconComponent = stat.icon;

          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className={`border p-6 rounded-3xl flex flex-col justify-between space-y-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300 ${stat.color}`}
            >
              <div className="space-y-3">
                {/* Accent Icon */}
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-xs">
                  <IconComponent className="w-5 h-5" />
                </div>

                <div className="space-y-1">
                  <span className="text-2xl font-black font-display tracking-tight block">
                    {stat.number}
                  </span>
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    {stat.label}
                  </h4>
                </div>

                <p className="text-[11px] font-sans font-medium leading-relaxed opacity-90">
                  {stat.desc}
                </p>
              </div>

              {/* Indian Stack watermark */}
              <div className="text-[8px] font-mono opacity-30 font-bold uppercase tracking-widest text-right">
                SEC_METRIC_0{idx + 1}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 2. National Civic Impact Live Counters Dashboard */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Dynamic decorative pattern background */}
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 text-center lg:text-left">
          
          {/* Stat Block 1 */}
          <div className="pt-4 lg:pt-0 lg:pl-0 space-y-2">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block font-mono">Verified Grid Nodes</span>
            <div className="flex items-baseline justify-center lg:justify-start gap-1">
              <span className="text-3xl font-black font-display tracking-tight text-white">4,810</span>
              <span className="text-[10px] font-bold text-emerald-500 font-mono">+12%</span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans font-semibold">Active citizen reporting coordinates mapped.</p>
          </div>

          {/* Stat Block 2 */}
          <div className="pt-4 lg:pt-0 lg:pl-6 space-y-2">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block font-mono">Grievances Escaled</span>
            <div className="flex items-baseline justify-center lg:justify-start gap-1">
              <span className="text-3xl font-black font-display tracking-tight text-white">2,490</span>
              <span className="text-[10px] font-bold text-emerald-500 font-mono">+28%</span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans font-semibold">Grievance letters drafted and successfully filed.</p>
          </div>

          {/* Stat Block 3 */}
          <div className="pt-4 lg:pt-0 lg:pl-6 space-y-2">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block font-mono">Citizen Endorsements</span>
            <div className="flex items-baseline justify-center lg:justify-start gap-1">
              <span className="text-3xl font-black font-display tracking-tight text-white">18,240</span>
              <span className="text-[10px] font-bold text-amber-500 font-mono">Active</span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans font-semibold">Attestation upvotes logged across metropolitan wards.</p>
          </div>

          {/* Stat Block 4 */}
          <div className="pt-4 lg:pt-0 lg:pl-6 space-y-2">
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block font-mono">Resolution Rate</span>
            <div className="flex items-baseline justify-center lg:justify-start gap-1">
              <span className="text-3xl font-black font-display tracking-tight text-emerald-400">92.4%</span>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">verified</span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans font-semibold">Completed and citizen-verified issue states.</p>
          </div>

        </div>
      </div>

    </div>
  );
}

export default memo(StatsSection);
