import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Cpu, 
  Send, 
  FileText, 
  Clock, 
  Award, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface Step {
  id: number;
  title: string;
  shortDesc: string;
  detailTitle: string;
  detailDesc: string;
  icon: any;
  badge: string;
  badgeColor: string;
  actionHint: string;
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "Upload Image",
    shortDesc: "Capture a photo of the civic grievance on your mobile.",
    detailTitle: "Step 1: Rapid Evidence Capture",
    detailDesc: "Our citizen platform supports instant visual capture of potholes, waterlogging, or open garbage piles. The app automatically extracts high-precision geographic context directly from image metadata.",
    icon: Camera,
    badge: "VISION COMPLIANT",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    actionHint: "Simply upload a JPEG or PNG"
  },
  {
    id: 2,
    title: "AI Understands",
    shortDesc: "Gemini Vision deciphers context, category & severity.",
    detailTitle: "Step 2: Dual-Model Vision Analysis",
    detailDesc: "The server-side secure Gemini engine analyzes the photo in real-time, verifying whether the image represents actual civic infrastructure neglect, determining its category, and rating priority severity.",
    icon: Cpu,
    badge: "GEMINI POWERED",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    actionHint: "Zero-leak secure API key processing"
  },
  {
    id: 3,
    title: "Routes Dept",
    shortDesc: "Classified logs route directly to municipal offices.",
    detailTitle: "Step 3: Auto-Classification & Intelligent Routing",
    detailDesc: "The issue is catalogued and matched to the corresponding ward division or government municipal department (e.g., BESCOM, BBMP, PWD) according to latitude/longitude coordinates.",
    icon: Send,
    badge: "ZERO HUMAN DELAY",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    actionHint: "Automated routing queues"
  },
  {
    id: 4,
    title: "Drafts Complaint",
    shortDesc: "Professional letters drafted in Hindi & English.",
    detailTitle: "Step 4: Real-time Multi-lingual Drafting",
    detailDesc: "Community Hero automatically structures a professionally formatted public grievance draft. It provides perfectly formatted letters in both English and Hindi, complete with legal references.",
    icon: FileText,
    badge: "INDIA STACK READY",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    actionHint: "Copy-paste ready formats"
  },
  {
    id: 5,
    title: "Tracks Resolution",
    shortDesc: "Monitors status transitions from reported to resolved.",
    detailTitle: "Step 5: Full-Lifecycle Integrity Tracking",
    detailDesc: "Once posted on the ward map, neighbors upvote and endorse the incident. Tracking continues live as engineers update status logs from 'Reported' through 'In-Progress' to 'Resolved'.",
    icon: Clock,
    badge: "FULL TRANSPARENCY",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    actionHint: "Citizen verification checks"
  },
  {
    id: 6,
    title: "Rewards Citizens",
    shortDesc: "Acquire Karma points and climb regional ranks.",
    detailTitle: "Step 6: Citizen Empowerment & Karma rewards",
    detailDesc: "As issues receive verified updates, contributors earn karma score points. Climb your municipal ward leaderboards and unlock real titles of civic distinction like 'Civic Guardian' or 'Ward Leader'.",
    icon: Award,
    badge: "GOVERNMENT ALIGNED",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    actionHint: "National recognition"
  }
];

function TimelineFlow() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const currentStepData = STEPS.find(s => s.id === activeStep) || STEPS[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* Left side: Animated Step Cards Timeline */}
      <div className="lg:col-span-5 space-y-3 relative">
        <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-slate-200/80 -z-10 hidden sm:block" />

        {STEPS.map((step) => {
          const isSelected = activeStep === step.id;
          const IconComponent = step.icon;

          return (
            <motion.div
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                isSelected 
                  ? 'bg-white border-slate-300 shadow-lg scale-[1.02] ring-2 ring-slate-100' 
                  : 'bg-white/40 border-transparent hover:border-slate-200'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              {/* Step indicator Circle */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                isSelected 
                  ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                  : 'bg-slate-100 border-slate-200/70 text-slate-500'
              }`}>
                <IconComponent className="w-5 h-5" />
              </div>

              {/* Text content */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold font-mono text-slate-400">0{step.id}</span>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">{step.title}</h4>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {step.shortDesc}
                </p>
              </div>

            </motion.div>
          );
        })}
      </div>

      {/* Right side: Detailed Visual Interactive Command Center for selected Step */}
      <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[380px]">
        {/* Abstract background logo watermark */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-slate-50 rounded-full flex items-center justify-center text-slate-100 pointer-events-none -z-10">
          <ShieldCheck className="w-32 h-32 opacity-20" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Step level badge */}
            <div className={`px-3 py-1 text-[9px] font-black tracking-widest border rounded-full w-fit ${currentStepData.badgeColor}`}>
              {currentStepData.badge}
            </div>

            {/* Step specific header */}
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 font-display tracking-tight">
                {currentStepData.detailTitle}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {currentStepData.detailDesc}
              </p>
            </div>

            {/* Info Hint Banner */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/50 text-[10px] text-slate-500 font-mono flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>{currentStepData.actionHint}</span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Action Button Link */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  activeStep === step.id ? 'bg-slate-900 w-6' : 'bg-slate-200 hover:bg-slate-300'
                }`}
                title={`Skip to step ${step.id}`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              setActiveStep(prev => prev === 6 ? 1 : prev + 1);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-slate-900 cursor-pointer hover:underline"
          >
            <span>{activeStep === 6 ? "Restart Overview" : "Next Step"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

    </div>
  );
}

export default memo(TimelineFlow);
