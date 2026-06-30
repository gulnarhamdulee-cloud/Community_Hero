import { memo } from 'react';
import { motion } from 'motion/react';

interface CityPoint {
  name: string;
  x: number;
  y: number;
  activeIssues: number;
}

export const CITIES_COORDS: CityPoint[] = [
  { name: 'Delhi', x: 140, y: 150, activeIssues: 1240 },
  { name: 'Mumbai', x: 80, y: 310, activeIssues: 2150 },
  { name: 'Bengaluru', x: 125, y: 400, activeIssues: 1890 },
  { name: 'Kolkata', x: 260, y: 220, activeIssues: 940 },
  { name: 'Chennai', x: 150, y: 410, activeIssues: 1420 },
  { name: 'Hyderabad', x: 135, y: 320, activeIssues: 1120 },
  { name: 'Pune', x: 90, y: 325, activeIssues: 810 },
  { name: 'Ahmedabad', x: 70, y: 220, activeIssues: 650 }
];

function IndiaMapSvg({ 
  interactive = false, 
  onSelectCity, 
  selectedCity 
}: { 
  interactive?: boolean; 
  onSelectCity?: (name: string) => void; 
  selectedCity?: string;
}) {
  return (
    <div className="relative w-full aspect-[4/5] max-w-[460px] mx-auto flex items-center justify-center select-none bg-slate-900/5 rounded-3xl p-6 border border-slate-200/50 shadow-inner overflow-hidden">
      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
      
      {/* Dynamic Glow Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <svg 
        viewBox="0 0 320 480" 
        className="w-full h-full relative z-10 drop-shadow-[0_10px_20px_rgba(30,58,138,0.06)]"
      >
        {/* Abstract Outlined Polyline Map of India for Government / Tech-forward vibe */}
        <motion.path
          d="M130,40 L140,45 L150,55 L160,50 L165,65 L170,75 L165,95 L180,105 L175,115 L190,120 L210,130 L215,140 L230,145 L240,140 L245,150 L255,145 L260,155 L270,165 L265,180 L285,185 L295,195 L290,210 L275,200 L260,205 L255,220 L265,225 L260,235 L245,230 L235,245 L225,240 L215,250 L220,270 L215,280 L195,300 L185,325 L175,340 L165,370 L155,395 L150,420 L145,435 L140,445 L135,435 L125,415 L125,385 L115,370 L110,350 L105,335 L85,320 L75,305 L80,285 L85,270 L70,265 L60,250 L55,235 L50,215 L55,195 L65,190 L75,195 L80,185 L95,180 L110,175 L105,160 L115,150 L120,130 L115,115 L125,100 L120,80 L125,65 L130,40 Z"
          fill="none"
          stroke="url(#indiaGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0.2 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.2, ease: "easeOut" }}
        />

        {/* Outer subtle glow path */}
        <motion.path
          d="M130,40 L140,45 L150,55 L160,50 L165,65 L170,75 L165,95 L180,105 L175,115 L190,120 L210,130 L215,140 L230,145 L240,140 L245,150 L255,145 L260,155 L270,165 L265,180 L285,185 L295,195 L290,210 L275,200 L260,205 L255,220 L265,225 L260,235 L245,230 L235,245 L225,240 L215,250 L220,270 L215,280 L195,300 L185,325 L175,340 L165,370 L155,395 L150,420 L145,435 L140,445 L135,435 L125,415 L125,385 L115,370 L110,350 L105,335 L85,320 L75,305 L80,285 L85,270 L70,265 L60,250 L55,235 L50,215 L55,195 L65,190 L75,195 L80,185 L95,180 L110,175 L105,160 L115,150 L120,130 L115,115 L125,100 L120,80 L125,65 L130,40 Z"
          fill="none"
          stroke="#1E3A8A"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-5 blur-[4px]"
        />

        {/* Gradients definition */}
        <defs>
          <linearGradient id="indiaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF9933" />
            <stop offset="50%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#138808" />
          </linearGradient>
        </defs>

        {/* Map City Points */}
        {CITIES_COORDS.map((city, idx) => {
          const isSelected = selectedCity?.toLowerCase() === city.name.toLowerCase();
          return (
            <g 
              key={city.name}
              className={`group transition-all duration-300 ${interactive ? 'cursor-pointer' : ''}`}
              onClick={() => interactive && onSelectCity?.(city.name)}
            >
              {/* Ripple Ring */}
              <circle
                cx={city.x}
                cy={city.y}
                r="10"
                className={`fill-none ${isSelected ? 'stroke-amber-500' : 'stroke-blue-500/40'} stroke-[1.5]`}
              >
                <animate
                  attributeName="r"
                  values="4;16;4"
                  dur={`${2.5 + idx * 0.4}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="1;0;1"
                  dur={`${2.5 + idx * 0.4}s`}
                  repeatCount="indefinite"
                />
              </circle>

              {/* Pulsing Solid Dot */}
              <motion.circle
                cx={city.x}
                cy={city.y}
                r={isSelected ? "5" : "4"}
                className={`${isSelected ? 'fill-amber-500 shadow-md' : 'fill-blue-800'}`}
                whileHover={{ scale: 1.4 }}
              />

              {/* Label */}
              <text
                x={city.x + 8}
                y={city.y + 4}
                className={`text-[8.5px] font-sans font-bold select-none ${
                  isSelected ? 'fill-amber-600 font-extrabold' : 'fill-slate-600 group-hover:fill-slate-800'
                }`}
              >
                {city.name}
              </text>
            </g>
          );
        })}
      </svg>
      
      {/* Floating active counters banner on map */}
      <div className="absolute bottom-4 right-4 bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200 shadow-sm text-[10px] font-sans font-bold text-slate-800">
        <span className="text-[8px] tracking-widest text-emerald-600 uppercase block font-extrabold">Active Node Grid</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>8 Metropolitan Wards Online</span>
        </div>
      </div>
    </div>
  );
}

export default memo(IndiaMapSvg);
