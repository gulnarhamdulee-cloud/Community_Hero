import { useState, memo } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  MapPin, 
  Building2, 
  ShieldCheck, 
  ChevronRight, 
  Users, 
  BadgeCheck, 
  HeartHandshake, 
  MessageSquare,
  Sparkles,
  ExternalLink,
  BookOpen,
  ArrowRightLeft
} from 'lucide-react';
import IndiaMapSvg, { CITIES_COORDS } from './IndiaMapSvg';
import TimelineFlow from './TimelineFlow';
import AgentsCenter from './AgentsCenter';
import StatsSection from './StatsSection';

interface LandingPageProps {
  onEnterApp: (initialTab?: 'dashboard' | 'map' | 'wizard') => void;
  isAuthenticated: boolean;
  onLogin: () => void;
}

const SUCCESS_STORIES = [
  {
    name: "Arjun R. Shastri",
    role: "Resident Warden Association Lead",
    location: "Bengaluru South, Sector 4",
    avatarBg: "bg-blue-600",
    initials: "AS",
    quote: "Bengaluru's waterlogging issues in Ward 174 had been unresolved for three seasons. Within 48 hours of logging a photo here, the dual-language complaint was structured, routed to the local corporator, and community endorsements pressured an immediate resolution.",
    verifiedBadge: "CIVIC WARD AWARD '25"
  },
  {
    name: "Meera Deshmukh",
    role: "Local Citizen Activist",
    location: "Mumbai Suburban, Andheri East",
    avatarBg: "bg-emerald-600",
    initials: "MD",
    quote: "The duplicate detection engine is community-building. When I went to report an open manhole, Community Hero automatically notified me of an existing ticket nearby and let me upvote and endorse it instead. Highly efficient for ward management.",
    verifiedBadge: "MUNICIPAL CONTRIBUTOR"
  },
  {
    name: "Dr. Sandeep Kumar",
    role: "Associate Professor of Public Infrastructure",
    location: "Delhi NCR, Dwarka",
    avatarBg: "bg-amber-600",
    initials: "SK",
    quote: "This is the precise template for decentralized civic intelligence. Integrating visual computer vision analysis directly on the server level eliminates fake requests and streamlines civic accountability for genuine government offices.",
    verifiedBadge: "ACTIVE HERO STREAK"
  }
];

function LandingPage({ onEnterApp, isAuthenticated, onLogin }: LandingPageProps) {
  const [selectedCity, setSelectedCity] = useState<string>('Bengaluru');
  const cityData = CITIES_COORDS.find(c => c.name.toLowerCase() === selectedCity.toLowerCase()) || CITIES_COORDS[2];

  return (
    <div className="bg-[#F8FAFC] min-h-screen font-sans antialiased text-slate-800">
      
      {/* 1. STICKY TOP NAVIGATION BAR */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200/60 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Logo Brand Icon */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF9933]" />
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#138808]" />
              <span className="text-xs font-black uppercase tracking-widest text-[#1E3A8A] font-sans ml-1">Community Hero</span>
            </div>
            <span className="text-[8px] font-mono tracking-widest text-slate-400 font-bold uppercase mt-0.5">National Civic Intel Platform</span>
          </div>
        </div>

        {/* Quick Menu */}
        <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How It Works</a>
          <a href="#ai-agents" className="hover:text-slate-900 transition-colors">AI Agents Command</a>
          <a href="#metrics" className="hover:text-slate-900 transition-colors">National Impact</a>
          <a href="#supported-cities" className="hover:text-slate-900 transition-colors">Supported Wards</a>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <button
              onClick={() => onEnterApp('dashboard')}
              className="bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>Citizen Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <button
                onClick={onLogin}
                className="text-slate-600 hover:text-slate-900 font-bold text-xs px-3.5 py-2 cursor-pointer transition-colors"
              >
                Citizen Login
              </button>
              <button
                onClick={onLogin}
                className="bg-[#1E3A8A] text-white hover:bg-[#152e70] font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all shadow-sm active:scale-95"
              >
                Register Ward
              </button>
            </>
          )}
        </div>
      </nav>

      {/* 2. TRICOLOUR FLAG STRIP INDICATOR */}
      <div className="h-1.5 w-full flex">
        <span className="bg-[#FF9933] flex-1" />
        <span className="bg-white flex-1" />
        <span className="bg-[#138808] flex-1" />
      </div>

      {/* 3. HERO SECTION */}
      <header className="relative py-12 md:py-20 lg:py-24 px-4 md:px-8 max-w-7xl mx-auto overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Texts */}
          <div className="lg:col-span-7 space-y-8 text-left">
            
            {/* Top Security Banner */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1E3A8A]/5 border border-[#1E3A8A]/10 rounded-full text-[10px] text-[#1E3A8A] font-extrabold tracking-wider uppercase font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>India Stack Compliant & Verified Infrastructure</span>
            </div>

            {/* Core Titles */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black font-display text-slate-900 tracking-tight leading-[1.1] max-w-2xl">
                India Deserves <br />
                <span className="text-[#1E3A8A] relative">
                  Better Streets.
                  <span className="absolute left-0 right-0 bottom-1 h-2 bg-[#FF9933]/15 -z-10" />
                </span> Let's Fix <br />Them Together.
              </h1>
              
              <p className="text-sm md:text-base text-slate-600 leading-relaxed font-medium max-w-xl">
                Report civic issues in seconds. Let AI identify, route, draft, and escalate complaints while citizens collaboratively improve their cities.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => onEnterApp('wizard')}
                className="bg-[#1E3A8A] text-white font-extrabold text-sm px-6 py-3.5 rounded-2xl cursor-pointer hover:bg-[#152e70] transition-all flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-95"
              >
                <span>Report an Issue</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onEnterApp('map')}
                className="bg-white text-slate-800 border border-slate-200/80 font-bold text-sm px-6 py-3.5 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                <span>Explore Civic Map</span>
                <MapPin className="w-4 h-4 text-[#138808]" />
              </button>
            </div>

            {/* Trust Badges */}
            <div className="pt-6 border-t border-slate-200/60 max-w-md">
              <div className="flex items-center gap-6">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 font-mono uppercase">VERIFIED STATUS</span>
                  <span className="text-xs font-extrabold text-slate-700">8 Indian Cities Online</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 font-mono uppercase">MUNICIPAL PIPELINES</span>
                  <span className="text-xs font-extrabold text-slate-700">Direct Dept Routing</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Hero Visuals: Vector India Map with animated issue nodes */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <IndiaMapSvg interactive={false} />
          </div>

        </div>
      </header>

      {/* 4. CIVIC PROBLEM STATISTICS */}
      <section id="metrics" className="py-16 md:py-24 bg-white border-y border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <span className="text-[10px] font-black text-[#FF9933] uppercase tracking-widest font-mono block">CIVIC INTELLIGENCE SCALE</span>
            <h2 className="text-2xl sm:text-3xl font-black font-display text-slate-900 tracking-tight">
              Understanding the Municipal Bottlenecks across Indian Cities
            </h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed max-w-xl">
              Traditional municipal reporting portals often struggle with volume, fake submissions, and delayed response cycles. Here is why India deserves a automated, robust civic framework.
            </p>
          </div>

          {/* Statistics grid component */}
          <StatsSection />

        </div>
      </section>

      {/* 5. HOW COMMUNITY HERO WORKS */}
      <section id="how-it-works" className="py-16 md:py-24 px-4 md:px-8 max-w-7xl mx-auto space-y-12">
        
        <div className="max-w-3xl space-y-3 text-left">
          <span className="text-[10px] font-black text-[#138808] uppercase tracking-widest font-mono block">AUTOMATED PIPELINE</span>
          <h2 className="text-2xl sm:text-3xl font-black font-display text-slate-900 tracking-tight">
            How Community Hero Works
          </h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed max-w-xl">
            A frictionless, transparent, six-stage transition translating visual citizen evidence into resolved municipal actions.
          </p>
        </div>

        {/* Interactive Timeline Flow Component */}
        <TimelineFlow />

      </section>

      {/* 6. MEET THE CIVIC INTELLIGENCE AGENTS */}
      <section id="ai-agents" className="py-16 md:py-24 bg-slate-900 text-white border-t border-slate-850">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12">
          
          <div className="max-w-3xl space-y-3 text-left">
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest font-mono block">MEET THE EXPERT AGENTS</span>
            <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">
              Meet the Civic Intelligence Agents
            </h2>
            <p className="text-xs md:text-sm text-slate-400 font-semibold leading-relaxed max-w-xl">
              A high-precision modular network of decentralized AI agents built atop server-side secure Gemini models, managing each stage of your report automatically.
            </p>
          </div>

          {/* Agents Dashboard Command center component */}
          <AgentsCenter />

        </div>
      </section>

      {/* 7. SUPPORTED CITIES MAP EXPLORER */}
      <section id="supported-cities" className="py-16 md:py-24 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left panel: Cities index selector */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <span className="text-[10px] font-black text-[#1E3A8A] uppercase tracking-widest font-mono block">SUPPORTED METROPOLITANS</span>
              <h2 className="text-2xl sm:text-3xl font-black font-display text-slate-900 tracking-tight">
                Live across India's Metros
              </h2>
              <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed">
                Click a city point on the map or select from the index below to view simulated active grievance tickets and regional resolution rates.
              </p>
            </div>

            {/* City Cards Grid */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              {CITIES_COORDS.map((city) => {
                const isSelected = selectedCity.toLowerCase() === city.name.toLowerCase();
                return (
                  <div
                    key={city.name}
                    onClick={() => setSelectedCity(city.name)}
                    className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                      isSelected 
                        ? 'bg-white border-[#1E3A8A] shadow-md ring-2 ring-blue-50' 
                        : 'bg-white/50 hover:bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-500' : 'bg-blue-600'}`} />
                      <h4 className="text-xs font-bold text-slate-800 tracking-tight">{city.name}</h4>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono font-medium">
                      <span>Active Nodes:</span>
                      <span className="font-extrabold text-slate-700">{city.activeIssues}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected City details block */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs text-slate-600 font-medium">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/40">
                <span className="font-bold text-slate-700">Wards status: {selectedCity} Metropolitan</span>
                <span className="bg-[#138808]/10 text-[#138808] px-2 py-0.5 rounded text-[10px] font-bold font-mono">STABLE GRID</span>
              </div>
              <p className="pt-2 leading-relaxed text-slate-500">
                Direct municipal escalations for {selectedCity} are routed to the central metropolitan coordination cell. Local citizens enjoy priority processing under the regional ward bylaws.
              </p>
            </div>
          </div>

          {/* Right panel: Map visualizer */}
          <div className="lg:col-span-6 flex justify-center">
            <IndiaMapSvg 
              interactive={true} 
              onSelectCity={setSelectedCity} 
              selectedCity={selectedCity} 
            />
          </div>

        </div>
      </section>

      {/* 8. SUCCESS STORIES */}
      <section className="py-16 md:py-24 bg-white border-t border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <span className="text-[10px] font-black text-[#FF9933] uppercase tracking-widest font-mono block">WARD TESTIMONIALS</span>
            <h2 className="text-2xl sm:text-3xl font-black font-display text-slate-900 tracking-tight">
              Impact Stories from the Ward Level
            </h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed">
              Read how local citizens and community associations have successfully leveraged automated AI intelligence to accelerate repairs in their lanes.
            </p>
          </div>

          {/* Testimonials layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SUCCESS_STORIES.map((story) => (
              <div 
                key={story.name}
                className="bg-[#F8FAFC] border border-slate-200/70 p-6 rounded-3xl flex flex-col justify-between space-y-6 shadow-xs relative"
              >
                <div className="space-y-4">
                  <span className="text-amber-600 block text-[9px] font-black tracking-widest font-mono uppercase">
                    {story.verifiedBadge}
                  </span>
                  <p className="text-xs md:text-sm text-slate-600 leading-relaxed italic font-medium">
                    "{story.quote}"
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-200/40">
                  <div className={`w-9 h-9 rounded-full ${story.avatarBg} text-white flex items-center justify-center text-xs font-black`}>
                    {story.initials}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">{story.name}</h5>
                    <span className="text-[10px] font-medium text-slate-500 block">{story.role}</span>
                    <span className="text-[9px] text-slate-400 font-mono font-medium block">{story.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 9. FINAL CALL TO ACTION */}
      <footer className="bg-slate-900 text-white border-t border-slate-850 py-16 md:py-24 relative overflow-hidden">
        
        {/* Flag strip background element */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <span className="bg-[#FF9933] flex-1" />
          <span className="bg-white flex-1" />
          <span className="bg-[#138808] flex-1" />
        </div>

        <div className="max-w-4xl mx-auto px-4 text-center space-y-8 relative z-10">
          
          <div className="space-y-3">
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest font-mono block">JOIN INDIA'S CIVIC REVOLUTION</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-display text-white tracking-tight leading-tight">
              Become a Community Hero.
            </h2>
            <p className="text-xs md:text-sm text-slate-400 font-semibold leading-relaxed max-w-lg mx-auto">
              Your neighborhood deserves clean asphalt, functional streetlights, and waste-free corners. Register your ward and start reporting today.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-4 flex-wrap">
            <button
              onClick={() => onEnterApp('wizard')}
              className="bg-[#FF9933] hover:bg-[#e68022] text-slate-950 font-black text-xs px-6 py-3.5 rounded-2xl cursor-pointer transition-all flex items-center gap-1.5 shadow-lg active:scale-95"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEnterApp('dashboard')}
              className="bg-transparent text-white border border-slate-700 hover:bg-slate-850 font-bold text-xs px-6 py-3.5 rounded-2xl cursor-pointer transition-all active:scale-95"
            >
              Explore Public Map
            </button>
          </div>

          <p className="text-[9.5px] font-mono text-slate-500">
            © 2026 Community Hero Initiative. Built in alignment with Swachh Bharat & India Stack guidelines.
          </p>

        </div>
      </footer>

    </div>
  );
}

export default memo(LandingPage);
