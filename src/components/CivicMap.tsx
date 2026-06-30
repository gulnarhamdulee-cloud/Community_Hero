import { useEffect, useRef, useState, useMemo, memo } from 'react';
import L from 'leaflet';
import { Report, INDIAN_CITIES } from '../types';
import { 
  Layers, 
  Flame, 
  MapPin, 
  SlidersHorizontal, 
  Filter, 
  Calendar, 
  X, 
  Tag, 
  AlertTriangle 
} from 'lucide-react';

interface CivicMapProps {
  reports: Report[];
  selectedCity: string;
  onSelectReport: (report: Report) => void;
}

type ViewMode = 'cluster' | 'heatmap' | 'standard';
type TimeRange = 'all' | '24h' | '7d' | '30d';

function CivicMap({ reports, selectedCity, onSelectReport }: CivicMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  
  // UI Interactive States
  const [viewMode, setViewMode] = useState<ViewMode>('cluster');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter States
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(['Critical', 'Severe', 'Moderate', 'Low']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('all');

  const cityConfig = INDIAN_CITIES.find(c => c.name.toLowerCase() === selectedCity.toLowerCase()) || INDIAN_CITIES[1];

  // Extract unique categories dynamically from active profile's reports list
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    reports.forEach(r => {
      if (r.category) cats.add(r.category);
    });
    return ['All', ...Array.from(cats)];
  }, [reports]);

  // Compute filtered reports list based on GIS criteria
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // 1. Coordinates validation
      if (!r.location || typeof r.location.lat !== 'number' || typeof r.location.lng !== 'number') return false;

      // 2. Severity filter
      if (!selectedSeverities.includes(r.severity)) return false;

      // 3. Category filter
      if (selectedCategory !== 'All' && r.category !== selectedCategory) return false;

      // 4. Time range filter
      if (selectedTimeRange !== 'all') {
        const reportDate = new Date(r.createdAt).getTime();
        const now = new Date().getTime();
        const diffHours = (now - reportDate) / (1000 * 60 * 60);

        if (selectedTimeRange === '24h' && diffHours > 24) return false;
        if (selectedTimeRange === '7d' && diffHours > 24 * 7) return false;
        if (selectedTimeRange === '30d' && diffHours > 24 * 30) return false;
      }

      return true;
    });
  }, [reports, selectedSeverities, selectedCategory, selectedTimeRange]);

  // Helper: Severity color style definitions
  const getSeverityStyle = (severity: string) => {
    const s = (severity || '').toUpperCase();
    switch (s) {
      case 'CRITICAL':
        return { bg: 'bg-rose-600', ring: 'ring-rose-200', text: 'text-rose-700', borderHex: '#E11D48' };
      case 'SEVERE':
      case 'HIGH':
        return { bg: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-700', borderHex: '#F59E0B' };
      case 'MODERATE':
      case 'MEDIUM':
        return { bg: 'bg-yellow-400', ring: 'ring-yellow-100', text: 'text-yellow-750', borderHex: '#FACC15' };
      case 'LOW':
      default:
        return { bg: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-750', borderHex: '#10B981' };
    }
  };

  // Canvas Heatmap Paint Routine
  const drawHeatmap = () => {
    const canvas = canvasRef.current;
    const map = mapInstanceRef.current;
    if (!canvas || !map || viewMode !== 'heatmap') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Support High-DPI screen scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Compute pixel points on viewport projection
    const points = filteredReports.map(rep => {
      const containerPt = map.latLngToContainerPoint([rep.location.lat, rep.location.lng]);
      let weight = 1;
      const s = (rep.severity || '').toUpperCase();
      if (s === 'CRITICAL') weight = 4.5;
      else if (s === 'SEVERE' || s === 'HIGH') weight = 3.2;
      else if (s === 'MODERATE' || s === 'MEDIUM') weight = 2.0;
      return { x: containerPt.x, y: containerPt.y, weight, severity: rep.severity };
    });

    // Draw intensity circles
    points.forEach(pt => {
      // Create radial glow gradient representation
      const baseRadius = map.getZoom() >= 14 ? 35 : map.getZoom() >= 12 ? 26 : 18;
      const radius = baseRadius * (pt.weight * 0.45 + 0.6);
      
      const gradient = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);

      let color = 'rgba(16, 185, 129, '; // Green for Low
      const s = (pt.severity || '').toUpperCase();
      if (s === 'CRITICAL') color = 'rgba(225, 29, 72, '; // Red
      else if (s === 'SEVERE' || s === 'HIGH') color = 'rgba(245, 158, 11, '; // Orange
      else if (s === 'MODERATE' || s === 'MEDIUM') color = 'rgba(234, 179, 8, '; // Yellow

      gradient.addColorStop(0, `${color}0.50)`);
      gradient.addColorStop(0.35, `${color}0.25)`);
      gradient.addColorStop(0.7, `${color}0.08)`);
      gradient.addColorStop(1, `${color}0.0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // Map Initialization & Subscription Loop
  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize Leaflet Map Instance
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: cityConfig.center,
        zoom: 12,
        zoomControl: false, // Disabling default to customize layout spacing
        attributionControl: false
      });

      // Unified Leaflet Zoom controls positioned safely
      L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);

      // Warm voyager tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      // Projection events for real-time Heatmap refreshes
      mapInstanceRef.current.on('move', drawHeatmap);
      mapInstanceRef.current.on('zoom', drawHeatmap);
      mapInstanceRef.current.on('resize', drawHeatmap);
    }

    const map = mapInstanceRef.current;
    map.setView(cityConfig.center, 12);

    // Call dynamic canvas update in case of asynchronous map load
    setTimeout(drawHeatmap, 100);

    return () => {
      // Persistent container, cleanup handles separately
    };
  }, [selectedCity]);

  // Leaflet Marker Projection Management
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear standard layers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Trigger heatmap redrawing in parallel
    drawHeatmap();

    if (viewMode === 'heatmap') {
      // Standard markers are hidden when heatmap is primary context
      return;
    }

    // Process view specific reports clustering
    if (viewMode === 'cluster') {
      // Client-side Grid/Distance Clustering Loop (Threshold 70px)
      const CLUSTER_RADIUS_PX = 70;
      const clusters: { center: [number, number]; reports: Report[] }[] = [];

      filteredReports.forEach(report => {
        const pt = map.latLngToContainerPoint([report.location.lat, report.location.lng]);
        
        // Find if this report pixel center fits into close proximity cluster
        let added = false;
        for (let i = 0; i < clusters.length; i++) {
          const cPt = map.latLngToContainerPoint(clusters[i].center);
          const dist = Math.hypot(pt.x - cPt.x, pt.y - cPt.y);

          if (dist < CLUSTER_RADIUS_PX) {
            // Recalculate center mass coordinate dynamically
            const count = clusters[i].reports.length;
            const newLat = (clusters[i].center[0] * count + report.location.lat) / (count + 1);
            const newLng = (clusters[i].center[1] * count + report.location.lng) / (count + 1);
            clusters[i].center = [newLat, newLng];
            clusters[i].reports.push(report);
            added = true;
            break;
          }
        }

        if (!added) {
          clusters.push({ center: [report.location.lat, report.location.lng], reports: [report] });
        }
      });

      // Render determined clusters
      clusters.forEach(cluster => {
        if (cluster.reports.length === 1) {
          // Render as solo pin marker
          createSoloPin(cluster.reports[0]);
        } else {
          // Render as clustered circle marker
          createClusterMarker(cluster.center, cluster.reports);
        }
      });
    } else {
      // Standard Solo View: Draw every filtered pin separately
      filteredReports.forEach(createSoloPin);
    }

    // Dynamic Solo Pin creator helper
    function createSoloPin(report: Report) {
      const style = getSeverityStyle(report.severity);
      const isCritical = report.severity.toUpperCase() === 'CRITICAL';

      const icon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="relative flex items-center justify-center w-10 h-10 group">
            <span class="absolute inline-flex w-full h-full rounded-full ${style.bg} ${isCritical ? 'animate-ping' : ''} opacity-40 scale-110"></span>
            <div class="relative flex items-center justify-center w-6 h-6 rounded-full ${style.bg} text-white font-extrabold text-[9px] shadow-lg border-2 border-white transform transition-transform group-hover:scale-110">
              ${report.category.charAt(0).toUpperCase()}
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const marker = L.marker([report.location.lat, report.location.lng], { icon })
        .addTo(map)
        .bindPopup(getPopupHtml(report), { closeButton: false, minWidth: 220 });

      marker.on('popupopen', () => bindPopupActions(report));
      markersRef.current.push(marker);
    }

    // Dynamic Cluster Pin creator helper
    function createClusterMarker(coords: [number, number], reportsInCluster: Report[]) {
      // Determine highest severity dynamically inside the cluster
      let topSeverity = 'Low';
      if (reportsInCluster.some(r => r.severity.toUpperCase() === 'CRITICAL')) topSeverity = 'Critical';
      else if (reportsInCluster.some(r => r.severity.toUpperCase() === 'SEVERE' || r.severity.toUpperCase() === 'HIGH')) topSeverity = 'Severe';
      else if (reportsInCluster.some(r => r.severity.toUpperCase() === 'MODERATE' || r.severity.toUpperCase() === 'MEDIUM')) topSeverity = 'Moderate';

      const style = getSeverityStyle(topSeverity);
      const count = reportsInCluster.length;

      const icon = L.divIcon({
        className: 'custom-map-cluster',
        html: `
          <div class="relative flex items-center justify-center w-12 h-12 cursor-pointer">
            <span class="absolute inset-0 rounded-full ${style.bg} opacity-25 animate-pulse"></span>
            <span class="absolute inset-2 rounded-full ${style.bg} opacity-40"></span>
            <div class="absolute inset-3 rounded-full ${style.bg} border-2 border-white flex items-center justify-center shadow-lg">
              <span class="text-white font-black text-xs font-mono">+${count}</span>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });

      const marker = L.marker(coords, { icon }).addTo(map);

      // On click, zoom in dynamically to disperse the cluster
      marker.on('click', () => {
        const currentZoom = map.getZoom();
        map.setView(coords, Math.min(18, currentZoom + 2));
      });

      markersRef.current.push(marker);
    }

    // Bind custom action on popup elements safely
    function bindPopupActions(report: Report) {
      const btn = document.getElementById(`btn-popup-${report.id}`);
      if (btn) {
        btn.addEventListener('click', () => {
          onSelectReport(report);
          map.closePopup();
        });
      }
    }

    // HTML Markup generator for pins popup
    function getPopupHtml(report: Report) {
      const style = getSeverityStyle(report.severity);
      return `
        <div class="p-3 max-w-[250px] font-sans">
          <div class="flex items-center gap-1.5 justify-between mb-1.5">
            <span class="text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full ${
              report.severity.toUpperCase() === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
              (report.severity.toUpperCase() === 'SEVERE' || report.severity.toUpperCase() === 'HIGH') ? 'bg-amber-100 text-amber-800' :
              (report.severity.toUpperCase() === 'MODERATE' || report.severity.toUpperCase() === 'MEDIUM') ? 'bg-yellow-105 text-yellow-850' : 'bg-emerald-100 text-emerald-800'
            }">${report.severity} Priority</span>
            <span class="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono leading-tight uppercase">${report.status}</span>
          </div>
          <h4 class="font-bold text-sm text-slate-900 leading-snug font-display">${report.title}</h4>
          <p class="text-xs text-slate-600 my-1.5 line-clamp-2">${report.description}</p>
          <div class="text-[10px] text-slate-400 font-semibold mb-2.5 flex items-center gap-1">
            <span>📍 ${report.category} • ${report.upvotesCount} Agrees</span>
          </div>
          <button id="btn-popup-${report.id}" class="w-full text-center py-2 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-xs cursor-pointer">
            Review Incident Details
          </button>
        </div>
      `;
    }

  }, [filteredReports, viewMode]);

  // Redraw canvas whenever View Mode is toggled
  useEffect(() => {
    drawHeatmap();
  }, [viewMode]);

  const toggleSeverity = (sev: string) => {
    setSelectedSeverities(prev => 
      prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev]
    );
  };

  return (
    <div data-lenis-prevent className="relative w-full h-full min-h-[480px] md:min-h-[520px] rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 bg-slate-50 transition-all flex flex-col">
      
      {/* MAP FLOATING CONTROLS CONSOLE */}
      <div className="absolute top-4 left-4 z-[999] flex flex-col sm:flex-row gap-2 max-w-[92%]">
        
        {/* VIEW MODE SEGMENT SWITCHER */}
        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex items-center gap-0.5 w-fit">
          <button
            type="button"
            onClick={() => setViewMode('cluster')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'cluster' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Clusters</span>
          </button>
          
          <button
            type="button"
            onClick={() => setViewMode('heatmap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'heatmap' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Heatmap</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('standard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'standard' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Solo Pins</span>
          </button>
        </div>

        {/* COMPREHENSIVE FILTER SLIDE-PANEL TRIGGER */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border shadow-md flex items-center justify-center cursor-pointer transition-all ${
              showFilters || selectedCategory !== 'All' || selectedTimeRange !== 'all' || selectedSeverities.length < 4
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Expand Map Filters Grid"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* DROPDOWN FILTERING DECK COMPONENT */}
          {showFilters && (
            <div className="absolute top-12 left-0 w-80 bg-white rounded-2xl border border-slate-200 p-5 shadow-md space-y-4 font-sans animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5 text-amber-600" />
                  <span>Interactive Map Filters</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Severity Toggles */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Filter By Severity</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'Critical', color: 'bg-rose-600' },
                    { id: 'Severe', color: 'bg-amber-500' },
                    { id: 'Moderate', color: 'bg-yellow-400' },
                    { id: 'Low', color: 'bg-emerald-500' }
                  ].map(sev => {
                    const isChecked = selectedSeverities.includes(sev.id);
                    return (
                      <button
                        type="button"
                        key={sev.id}
                        onClick={() => toggleSeverity(sev.id)}
                        className={`py-1.5 px-2.5 text-[11px] font-bold rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-amber-50/70 border-amber-400 text-amber-800 shadow-2xs' 
                            : 'bg-slate-50/50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${sev.color}`}></span>
                        <span>{sev.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Category Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Grievance Category</span>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 py-2 pl-9 pr-4 rounded-xl text-xs font-semibold text-slate-700 outline-none transition-all cursor-pointer"
                  >
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat === 'All' ? 'All Incident Types' : cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time Range Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Report Lodged Within</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedTimeRange}
                    onChange={(e) => setSelectedTimeRange(e.target.value as TimeRange)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 py-2 pl-9 pr-4 rounded-xl text-xs font-semibold text-slate-700 outline-none transition-all cursor-pointer"
                  >
                    <option value="all">Any Timestamp (All Time)</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
              </div>

              {/* Quick Reset filters */}
              <button
                type="button"
                onClick={() => {
                  setSelectedSeverities(['Critical', 'Severe', 'Moderate', 'Low']);
                  setSelectedCategory('All');
                  setSelectedTimeRange('all');
                }}
                className="w-full text-center py-1.5 text-[10px] font-mono text-amber-600 hover:text-amber-700 hover:underline border-t border-slate-100 pt-3"
              >
                Reset map filters to Default
              </button>

            </div>
          )}
        </div>
      </div>

      {/* CORE LEAFLET MAP & CANVAS CONTAINER */}
      <div className="relative flex-1 w-full h-full min-h-[480px] md:min-h-[520px]">
        {/* Absolute aligned canvas overlay for Heatmap layer drawing */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full pointer-events-none z-[400] transition-opacity duration-300 ${
            viewMode === 'heatmap' ? 'opacity-100' : 'opacity-0'
          }`}
        />
        
        {/* Leaflet map base div layer */}
        <div ref={mapRef} className="w-full h-full" style={{ height: "100%", minHeight: "480px" }} />
      </div>
      
      {/* MAP HAZARDS COMPASS LEGEND PANEL */}
      <div className="absolute bottom-4 left-4 z-[999] bg-white px-3.5 py-3 rounded-xl border border-slate-200 shadow-sm max-w-xs font-sans">
        <div className="flex items-center gap-1.5 mb-2 border-b border-slate-100 pb-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <h5 className="text-[10px] uppercase tracking-wider font-extrabold text-navy">Priority Grid Legend</h5>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-600 font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span>
            <span>Critical (Red)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            <span>Severe (Orange)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>
            <span>Moderate (Yellow)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Low (Green)</span>
          </div>
        </div>
        <div className="text-[9px] text-slate-400 font-mono mt-2 pt-1 border-t border-slate-100">
          Showing {filteredReports.length} of {reports.length} global grievances
        </div>
      </div>
    </div>
  );
}

export default memo(CivicMap);
