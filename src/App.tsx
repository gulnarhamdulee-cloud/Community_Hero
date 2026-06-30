import { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './features/auth/useAuth';
import { useRankings } from './features/ranking/useRankings';
import { useNotifications } from './features/notifications/NotificationProvider';
import NotificationBell from './components/notifications/NotificationBell';
import NotificationToast from './components/notifications/NotificationToast';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Report, INDIAN_CITIES, UserRole } from './types';
import { SEED_REPORTS } from './mockReports';
import { addStatusHistoryEntry } from './utils/statusHistoryService';
import LandingPage from './components/landing/LandingPage';
import { LoginView } from './components/auth/LoginView';
import OfficerDashboard from './components/OfficerDashboard';
import IssueTimeline from './components/IssueTimeline';

// Lazy loaded modules
const CivicMap = lazy(() => import('./components/CivicMap'));
const CivicBot = lazy(() => import('./components/CivicBot'));
const ReportWizard = lazy(() => import('./components/ReportWizard'));
const MunicipalRankings = lazy(() => import('./components/MunicipalRankings'));

const TabLoadingPlaceholder = () => (
  <div 
    className="w-full h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 p-6 space-y-4 will-change-transform"
    style={{ transform: 'translateZ(0)' }}
  >
    <div className="w-10 h-10 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
    <p className="text-xs font-mono text-slate-400">Optimizing Viewport...</p>
  </div>
);

// Icons
import {
  Sparkles,
  LayoutDashboard,
  FileSpreadsheet,
  Map,
  MessageSquareCode,
  Trophy,
  Plus,
  Search,
  ArrowUp,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Building2,
  Users,
  Copy,
  X,
  FileText,
  BadgeAlert,
  ChevronRight,
  TrendingUp,
  Inbox,
  Languages,
  BadgeHelp
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'report' | 'map' | 'chat' | 'ranking' | 'officer_desk'>('dashboard');
  const [viewScope, setViewScope] = useState<'all' | 'mine'>('all');
  const [reports, setReports] = useState<Report[]>(SEED_REPORTS);
  const [loading, setLoading] = useState(true);

  // Filter and Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [visibleReportsCount, setVisibleReportsCount] = useState(6);

  useEffect(() => {
    setVisibleReportsCount(6);
  }, [debouncedSearchQuery, selectedCityFilter, selectedCategoryFilter, selectedStatusFilter]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Active review popup modal
  const [selectedReportForReview, setSelectedReportForReview] = useState<Report | null>(null);
  const [activeReviewLangTab, setActiveReviewLangTab] = useState<'en' | 'hi'>('en');

  const { user, logout } = useAuth();
  const { citizenRankings, municipalRankings } = useRankings();
  const { addNotification } = useNotifications();

  // Milestone points / Badge levels milestone tracker
  useEffect(() => {
    if (!user) return;
    const checkedPoints = [10, 50, 100, 300, 800, 1205];
    checkedPoints.forEach(pt => {
      const key = `milestone_${pt}_${user.uid}`;
      if (user.points >= pt && !localStorage.getItem(key)) {
        let badge = "Active Hero";
        if (pt === 1205) badge = "MGD WARRIOR";
        else if (pt === 800) badge = "SWACHH CO-LEAD";
        else if (pt === 300) badge = "Ward Leader";
        else if (pt === 100) badge = "Civic Guardian";
        else if (pt === 50) badge = "Active Hero";
        else if (pt === 10) badge = "Guest Explorer";
        
        const msg = pt >= 100 
          ? `Incredible! Your active municipal participation has unlocked the rank of ${badge} with a karma score of ${user.points} points!`
          : `Congratulations! Your citizen karma points increased to ${user.points} points! Unlocked the milestone achievement.`;
          
        addNotification(user.uid, "Leaderboard Achievement!", msg, "achievement");
        localStorage.setItem(key, "notified");
      }
    });
  }, [user?.points, user?.uid]);

  const lastUserUid = useRef<string | null>(null);

  // Route guard and default role-based redirect
  useEffect(() => {
    if (!user) {
      lastUserUid.current = null;
      return;
    }
    const isOfficer = user.role === UserRole.MUNICIPAL_OFFICER;
    if (isOfficer) {
      // If user UID changes or we just logged in as officer, immediately switch to officer desk
      if (user.uid !== lastUserUid.current) {
        lastUserUid.current = user.uid;
        setActiveTab('officer_desk');
      } else if (activeTab === 'report') {
        setActiveTab('officer_desk');
      } else if (activeTab === 'dashboard' && !localStorage.getItem(`initial_redirect_${user.uid}`)) {
        setActiveTab('officer_desk');
        localStorage.setItem(`initial_redirect_${user.uid}`, 'done');
      }
    } else {
      lastUserUid.current = user.uid;
      // Citizen guard
      if (activeTab === 'officer_desk') {
        setActiveTab('dashboard');
      }
    }
  }, [user, activeTab]);

  const [isViewingLanding, setIsViewingLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  // Sync firestore reports in real-time
  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      try {
        if (querySnapshot.empty) {
          // If Firestore is empty, seed with initial mock data
          setReports(SEED_REPORTS);
        } else {
          const loaded: Report[] = [];
          querySnapshot.forEach((doc) => {
            loaded.push({ id: doc.id, ...doc.data() } as Report);
          });
          // Merge seeds so maps feel densely complete across regions!
          const merged = [...loaded, ...SEED_REPORTS.filter(seed => !loaded.some(l => l.title === seed.title))];
          setReports(merged);
        }
      } catch (err) {
        console.warn("Error processing real-time snapshot:", err);
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.warn("Firestore listener failed or offline, falling back to seed data:", err);
      setReports(SEED_REPORTS);
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'reports');
      } catch (e) {
        // Suppress thrown error from callback to prevent UI crash
      }
    });

    return () => unsubscribe();
  }, []);

  // Map user profile variables to current layout state fields with memoization
  const mockUser = useMemo(() => {
    return {
      uid: user?.uid || "",
      email: user?.email || "guest@communityhero.in",
      displayName: user?.name || "Guest Citizen",
      karma: user?.points || 0,
      rank: user?.isGuest ? "Guest Citizen" : ((user?.badges && user?.badges[0]) || "#4 Ward Warrior")
    };
  }, [user]);

  // Handle support/upvote action
  const handleUpvote = useCallback(async (reportId: string) => {
    // Prevent double voting
    const reportIndex = reports.findIndex(r => r.id === reportId);
    if (reportIndex === -1) return;
    
    const target = reports[reportIndex];
    if (target.upvotesUsers.includes(mockUser.uid)) {
      alert("You have already attested for this grievance. Your collective support remains compiled.");
      return;
    }

    const updatedUsers = [...target.upvotesUsers, mockUser.uid];
    const updatedCount = target.upvotesCount + 1;

    // Reactively update memory
    const updatedReports = [...reports];
    updatedReports[reportIndex] = {
      ...target,
      upvotesCount: updatedCount,
      upvotesUsers: updatedUsers
    };
    setReports(updatedReports);

    // If active modal is open, update it too
    if (selectedReportForReview?.id === reportId) {
      setSelectedReportForReview(prev => prev ? {
        ...prev,
        upvotesCount: updatedCount,
        upvotesUsers: updatedUsers
      } : null);
    }

    // Trigger notification to the report creator
    if (target.userId && target.userId !== mockUser.uid) {
      if (updatedCount >= 3) {
        addNotification(
          target.userId,
          "Issue Verified",
          `Official Verification: '${target.title}' accumulated 3+ citizen endorsements of support. Escalation issued!`,
          'achievement'
        );
      } else {
        addNotification(
          target.userId,
          "Community Attestation",
          `Another citizen of ${target.location.city} supported and attested your grievance: '${target.title}'.`,
          'info'
        );
      }
    }

    // Try Firestore update
    try {
      const docRef = doc(db, 'reports', reportId);
      await updateDoc(docRef, {
        upvotesCount: updatedCount,
        upvotesUsers: updatedUsers
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `reports/${reportId}`);
    }
  }, [reports, mockUser, selectedReportForReview, addNotification]);

  // Handle successful newly generated report
  const handleAddNewReport = useCallback(async (newReport: Report) => {
    // Add locally immediately first
    setReports(prev => [newReport, ...prev]);
    setActiveTab('dashboard'); // Route back to community dashboard
    setSelectedReportForReview(newReport); // Pop details directly to review!

    // Trigger instant submission in-app notification
    addNotification(
      mockUser.uid,
      "Issue Submitted",
      `Your grievance complaint '${newReport.title}' has been successfully logged on the Ward Dashboard.`,
      'success'
    );

    // Notify assigned officer if matched
    if (newReport.assignedToOfficerId) {
      addNotification(
        newReport.assignedToOfficerId,
        "🚨 Auto-Assigned Grievance",
        `You have been automatically assigned to a new ${newReport.category} complaint: '${newReport.title}' in ${newReport.location.city}, ${newReport.location.address}. Target SLA: ${newReport.estimatedResolutionTime || '48-72 Hours'}`,
        'alert'
      );
    }

    // Save to Firestore and log status history
    try {
      await addDoc(collection(db, 'reports'), newReport);
      
      // Log initial submission status history
      await addStatusHistoryEntry({
        issueId: newReport.id,
        previousStatus: "NONE",
        currentStatus: "SUBMITTED",
        updatedBy: `${newReport.userName} (Citizen)`,
        timestamp: new Date().toISOString(),
        remarks: "Grievance submitted by citizen via the Ward Dashboard."
      });

      if (newReport.assignedToOfficerId) {
        // Log auto-assignment transition
        await addStatusHistoryEntry({
          issueId: newReport.id,
          previousStatus: "SUBMITTED",
          currentStatus: "ASSIGNED",
          updatedBy: "System (Auto-Assignment Engine)",
          timestamp: new Date().toISOString(),
          remarks: `Automatically assigned to department '${newReport.suggestedDepartment}' and officer '${newReport.assignedToOfficerName}'.`
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `reports/${newReport.id}`);
    }
  }, [mockUser.uid, addNotification]);

  // Handle status resolution and transition updates (Resolution updated)
  const handleUpdateStatus = useCallback(async (
    reportId: string, 
    newStatus: Report['status'],
    customRemarks?: string
  ) => {
    const reportIndex = reports.findIndex(r => r.id === reportId);
    if (reportIndex === -1) return;

    const target = reports[reportIndex];
    const previousStatus = target.status;
    const updatedReports = [...reports];
    const now = new Date().toISOString();
    
    updatedReports[reportIndex] = {
      ...target,
      status: newStatus,
      resolvedAt: (newStatus === 'Resolved' || newStatus === 'RESOLVED' || newStatus === 'Verified' || newStatus === 'CLOSED') ? now : target.resolvedAt
    };

    setReports(updatedReports);

    // Sync open details popup state
    if (selectedReportForReview?.id === reportId) {
      setSelectedReportForReview(prev => prev ? {
        ...prev,
        status: newStatus,
        resolvedAt: (newStatus === 'Resolved' || newStatus === 'RESOLVED' || newStatus === 'Verified' || newStatus === 'CLOSED') ? now : prev.resolvedAt
      } : null);
    }

    // Try Firestore update and log status history
    try {
      const docRef = doc(db, 'reports', reportId);
      await updateDoc(docRef, {
        status: newStatus,
        resolvedAt: (newStatus === 'Resolved' || newStatus === 'RESOLVED' || newStatus === 'Verified' || newStatus === 'CLOSED') ? now : target.resolvedAt
      });

      // Map a default descriptive remark based on transition
      let remarks = customRemarks || `Issue status changed from ${previousStatus} to ${newStatus}.`;
      if (newStatus === 'IN_PROGRESS') {
        remarks = "Officer acknowledged the issue and commenced ward/field deployment.";
      } else if (newStatus === 'RESOLVED') {
        remarks = "Officer marked the complaint as Resolved. Pending citizen verification.";
      } else if (newStatus === 'VERIFICATION_PENDING') {
        remarks = "Field remediation completed. Awaiting citizen verification and feedback.";
      } else if (newStatus === 'CLOSED') {
        remarks = "Citizen successfully verified the civic correction and closed the issue.";
      } else if (newStatus === 'REOPENED') {
        remarks = "Citizen rejected the resolution. Issue reopened for further inspection.";
      }

      const roleStr = user?.role === UserRole.MUNICIPAL_OFFICER ? 'Officer' : 'Citizen';
      const updatedByStr = `${mockUser.displayName || mockUser.email} (${roleStr})`;

      // Persist status history entry in Firestore
      await addStatusHistoryEntry({
        issueId: reportId,
        previousStatus,
        currentStatus: newStatus,
        updatedBy: updatedByStr,
        timestamp: now,
        remarks
      });

      // Dispatch resolution updated alert to creator
      if (target.userId) {
        addNotification(
          target.userId,
          "Resolution Updated",
          `Ward Escalation Team progressed your public report '${target.title}' to secondary state: '${newStatus}'.`,
          (newStatus === 'Resolved' || newStatus === 'RESOLVED' || newStatus === 'CLOSED') ? 'success' : 'info'
        );
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `reports/${reportId}`);
    }
  }, [reports, selectedReportForReview, addNotification, mockUser]);

  // Compute stats metrics dynamically using useMemo
  const { totalReportsCount, resolvedCount, criticalCount, totalAttestations } = useMemo(() => {
    return {
      totalReportsCount: reports.length,
      resolvedCount: reports.filter(r => r.status === 'Resolved').length,
      criticalCount: reports.filter(r => {
        const s = (r.severity || '').toUpperCase();
        return s === 'CRITICAL' || s === 'SEVERE' || s === 'HIGH';
      }).length,
      totalAttestations: reports.reduce((acc, curr) => acc + curr.upvotesCount, 0)
    };
  }, [reports]);

  // Filtered reports subset memoized
  const filteredReports = useMemo(() => {
    const lowerSearch = debouncedSearchQuery.toLowerCase();
    const lowerCityFilter = selectedCityFilter.toLowerCase();
    const isOfficer = user?.role === UserRole.MUNICIPAL_OFFICER;
    return reports.filter(report => {
      const matchesSearch = report.title.toLowerCase().includes(lowerSearch) ||
                            report.description.toLowerCase().includes(lowerSearch) ||
                            report.category.toLowerCase().includes(lowerSearch);
      
      const matchesCity = selectedCityFilter === 'All' || report.location.city.toLowerCase() === lowerCityFilter;
      const matchesCategory = selectedCategoryFilter === 'All' || report.category === selectedCategoryFilter;
      const matchesStatus = selectedStatusFilter === 'All' || report.status === selectedStatusFilter;
      
      // Citizen scope check: 'mine' vs 'all'
      const matchesScope = isOfficer || viewScope === 'all' || !user || report.userId === user.uid;

      return matchesSearch && matchesCity && matchesCategory && matchesStatus && matchesScope;
    });
  }, [reports, debouncedSearchQuery, selectedCityFilter, selectedCategoryFilter, selectedStatusFilter, viewScope, user]);

  // Sliced reports list to limit rendering
  const visibleReports = useMemo(() => {
    return filteredReports.slice(0, visibleReportsCount);
  }, [filteredReports, visibleReportsCount]);

  // If we are viewing the landing page, render it!
  if (isViewingLanding) {
    return (
      <LandingPage
        isAuthenticated={!!user}
        onLogin={() => {
          setShowLogin(true);
          setIsViewingLanding(false);
        }}
        onEnterApp={(tab) => {
          if (tab === 'wizard') {
            setActiveTab('report');
          } else if (tab === 'map') {
            setActiveTab('map');
          } else {
            setActiveTab('dashboard');
          }
          if (user) {
            setIsViewingLanding(false);
          } else {
            setShowLogin(true);
            setIsViewingLanding(false);
          }
        }}
      />
    );
  }

  // If user is not logged in and showLogin is true, render LoginView
  if (!user) {
    return (
      <div className="relative min-h-screen bg-[#F8FAFC]">
        {/* Simple return to landing header */}
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => {
              setIsViewingLanding(true);
              setShowLogin(false);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl cursor-pointer shadow-sm"
          >
            ← Back to Landing
          </button>
        </div>
        <LoginView />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-bg flex flex-col font-sans select-none antialiased">
      <NotificationToast />
      
      {/* TRICOLORE ACCENT HEADER FLAG STRIP */}
      <div className="h-1.5 w-full flex">
        <div className="bg-saffron w-1/3 h-full"></div>
        <div className="bg-white w-1/3 h-full"></div>
        <div className="bg-green-t w-1/3 h-full"></div>
      </div>

      {/* TOP BRAND NAV BAR */}
      <header className="sticky top-0 z-[1000] bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          
          {/* Logo & Platform Name */}
          <div 
            onClick={() => setIsViewingLanding(true)}
            className="flex items-center gap-3 cursor-pointer group"
            title="Return to Public Portal"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-navy to-slate-800 text-white shadow-md transition-transform group-hover:scale-[1.05]">
              <span className="font-display font-extrabold text-lg text-saffron">C</span>
              <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-green-t"></span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display font-extrabold text-sm md:text-base text-slate-900 tracking-tight group-hover:text-[#1E3A8A] transition-colors">Community Hero</h1>
                <span className="bg-saffron/10 text-saffron text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-widest uppercase">AI CIVIC</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Empowering Indian Municipal Accountability</p>
            </div>
          </div>

          {/* Desktop Tab Selector */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
            {/* Officer Desk Tab - Officer Only! */}
            {user && user.role === UserRole.MUNICIPAL_OFFICER && (
              <button
                onClick={() => { setActiveTab('officer_desk'); setSelectedReportForReview(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'officer_desk' ? 'bg-amber-600/10 text-amber-700 shadow-xs border border-amber-200/40' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Officer Desk</span>
              </button>
            )}

            <button
              onClick={() => { setActiveTab('dashboard'); setSelectedReportForReview(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Grievance Board</span>
            </button>

            {/* Report Issue Tab - Citizen Only! */}
            {(!user || user.role === UserRole.CITIZEN) && (
              <button
                onClick={() => { setActiveTab('report'); setSelectedReportForReview(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'report' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <Plus className="w-3.5 h-3.5 text-saffron" />
                <span>Report Issue</span>
              </button>
            )}

            <button
              onClick={() => { setActiveTab('map'); setSelectedReportForReview(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'map' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Hazard Hotspots Map</span>
            </button>

            <button
              onClick={() => { setActiveTab('chat'); setSelectedReportForReview(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'chat' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <MessageSquareCode className="w-3.5 h-3.5 text-green-t" />
              <span>Nagrik Shastra Advisor</span>
            </button>

            <button
              onClick={() => { setActiveTab('ranking'); setSelectedReportForReview(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'ranking' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Municipal rankings</span>
            </button>
          </nav>

          {/* User Profile Badge */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="block text-[10px] font-bold text-navy">{mockUser.displayName}</span>
              {user && user.role === UserRole.MUNICIPAL_OFFICER ? (
                <span className="block text-[8px] font-extrabold text-amber-600 font-mono uppercase tracking-wide">👮 Municipal Officer</span>
              ) : (
                <span className="block text-[8px] font-extrabold text-saffron font-mono uppercase tracking-wide">🏆 Karma {mockUser.karma}pts</span>
              )}
            </div>
            
            {/* Round Avatar Container */}
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-tr from-saffron to-green-t p-0.5 relative group flex items-center justify-center shrink-0">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.name} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-[10px]"
                />
              ) : (
                <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center font-display font-extrabold text-xs text-navy">
                  {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ZH'}
                </div>
              )}
            </div>

            {/* Notification Bell Feed Trigger */}
            <NotificationBell />

            {/* Logout button */}
            <button
              onClick={() => logout()}
              title="Log Out Citizen Profile"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

        </div>
      </header>

      {/* MOBILE FLOATING COMPACT ACTION BAR */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-[999] bg-white border border-slate-200 rounded-2xl shadow-md p-2 flex items-center justify-around">
        {/* Officer Desk Tab - Officer Only! */}
        {user && user.role === UserRole.MUNICIPAL_OFFICER && (
          <button
            onClick={() => { setActiveTab('officer_desk'); setSelectedReportForReview(null); }}
            className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'officer_desk' ? 'text-amber-600 scale-105 font-bold font-bold' : 'text-slate-400 text-[10px]'}`}
          >
            <Building2 className="w-5 h-5" />
            <span className="text-[9px] mt-0.5">Command</span>
          </button>
        )}

        <button
          onClick={() => { setActiveTab('dashboard'); setSelectedReportForReview(null); }}
          className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'dashboard' ? 'text-navy scale-105 font-bold' : 'text-slate-400 text-[10px]'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] mt-0.5">Grievance</span>
        </button>

        {/* Report Issue Tab - Citizen Only! */}
        {(!user || user.role === UserRole.CITIZEN) && (
          <button
            onClick={() => { setActiveTab('report'); setSelectedReportForReview(null); }}
            className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'report' ? 'text-navy scale-110 font-bold' : 'text-slate-400 text-[10px]'}`}
          >
            <div className="w-8 h-8 rounded-full bg-saffron text-white flex items-center justify-center shadow-md">
              <Plus className="w-4 h-4" />
            </div>
          </button>
        )}

        <button
          onClick={() => { setActiveTab('map'); setSelectedReportForReview(null); }}
          className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'map' ? 'text-navy scale-105 font-bold' : 'text-slate-400 text-[10px]'}`}
        >
          <Map className="w-5 h-5" />
          <span className="text-[9px] mt-0.5">Map</span>
        </button>

        <button
          onClick={() => { setActiveTab('chat'); setSelectedReportForReview(null); }}
          className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'chat' ? 'text-navy scale-105 font-bold' : 'text-slate-400 text-[10px]'}`}
        >
          <MessageSquareCode className="w-5 h-5" />
          <span className="text-[9px] mt-0.5">Advisor</span>
        </button>
      </div>

      {/* PRIMARY CONTROLLER PAGE BLOCK */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6 pb-24 md:pb-12">
        
        {/* OFFICER DESK TAB SEGMENT */}
        {activeTab === 'officer_desk' && (
          <OfficerDashboard
            reports={reports}
            onUpdateStatus={handleUpdateStatus}
            onSelectReport={(report) => {
              setSelectedReportForReview(report);
              setActiveReviewLangTab('en');
            }}
          />
        )}

        {/* DASHBOARD TAB SEGMENT */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Real-time National impact Scoreboard Header */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="font-display font-extrabold text-xl text-slate-900 tracking-tight">Active Civic Grievances Monitor</h2>
                <p className="text-xs text-slate-500 font-medium">Bilingual complaint escalations generating 24/7 Swachh Bharat safety actions</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('report')}
                  className="bg-navy bg-gradient-to-r hover:from-navy hover:to-navy-hover text-white px-5 py-3 rounded-xl text-xs font-bold shadow-md shadow-navy/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Report Civic Mutation</span>
                </button>
              </div>
            </div>

            {/* HIGH IMPACT KPI METRICS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <BadgeAlert className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Craters</span>
                  <span className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">{totalReportsCount} Issues</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wards Resolved</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">{resolvedCount} Cases</span>
                    <span className="text-[10px] font-bold text-emerald-600 font-medium bg-emerald-50 px-1 py-0.5 rounded">
                      {Math.round((resolvedCount / (totalReportsCount || 1)) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sovereignty Warning</span>
                  <span className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">{criticalCount} Critical</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Citizen Support</span>
                  <span className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">+{totalAttestations} Attested</span>
                </div>
              </div>

            </div>

            {/* CENTRAL INTERACTIVE SPLIT: FILTERS + LIST */}
            <div className="grid lg:grid-cols-12 gap-6">
              
              {/* Left filter side rail */}
              <div className="lg:col-span-3 space-y-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <h3 className="font-display font-extrabold text-xs text-slate-450 uppercase tracking-wider border-b border-slate-100 pb-2">Filter Parameters</h3>
                  
                  {/* View Scope (Citizen Only) */}
                  {user && user.role === UserRole.CITIZEN && (
                    <div className="space-y-1.5 pb-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">View Scope</label>
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
                        <button
                          type="button"
                          onClick={() => setViewScope('all')}
                          className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            viewScope === 'all' 
                              ? 'bg-emerald-750 bg-emerald-750 hover:bg-emerald-800 text-white shadow-xs' 
                              : 'text-slate-600 hover:text-emerald-700 hover:bg-white'
                          }`}
                        >
                          All Wards
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewScope('mine')}
                          className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            viewScope === 'mine' 
                              ? 'bg-emerald-750 bg-emerald-750 hover:bg-emerald-800 text-white shadow-xs' 
                              : 'text-slate-600 hover:text-emerald-700 hover:bg-white'
                          }`}
                        >
                          My Reports
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* City dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Metropolitan City</label>
                    <select
                      value={selectedCityFilter}
                      onChange={(e) => setSelectedCityFilter(e.target.value)}
                      className="w-full border border-slate-150 px-3 py-2 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-navy focus:outline-none"
                    >
                      <option value="All">All Indian Cities</option>
                      {INDIAN_CITIES.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Civil Department Group</label>
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="w-full border border-slate-150 px-3 py-2 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-navy focus:outline-none"
                    >
                      <option value="All">All Categories</option>
                      <option value="Roads & Traffic">Roads & Traffic</option>
                      <option value="Solid Waste Management">Solid Waste Management</option>
                      <option value="Water & Sanitation">Water & Sanitation</option>
                      <option value="Electricity & Illumination">Electricity & Illumination</option>
                    </select>
                  </div>

                  {/* Status dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolution Status</label>
                    <select
                      value={selectedStatusFilter}
                      onChange={(e) => setSelectedStatusFilter(e.target.value)}
                      className="w-full border border-slate-150 px-3 py-2 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-navy focus:outline-none"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Reported">Reported</option>
                      <option value="In-Review">In-Review</option>
                      <option value="In-Progress">In-Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>

                  {/* Clear filter button */}
                  {(selectedCityFilter !== 'All' || selectedCategoryFilter !== 'All' || selectedStatusFilter !== 'All') && (
                    <button
                      onClick={() => {
                        setSelectedCityFilter('All');
                        setSelectedCategoryFilter('All');
                        setSelectedStatusFilter('All');
                      }}
                      className="w-full py-2 text-center text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>

                {/* Info Card Box */}
                <div className="bg-gradient-to-br from-emerald-550 to-emerald-700 bg-emerald-600 text-white rounded-2xl p-5 shadow-xs relative overflow-hidden">
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Languages className="w-4 h-4 text-saffron" />
                      <h4 className="text-xs font-extrabold uppercase tracking-wide text-white">Dual Translation Duty</h4>
                    </div>
                    <p className="text-[11px] leading-relaxed text-emerald-100">
                      Municipal commissioners in Northern circles rely on official Hindi drafting, whereas Southern/corporation desks process English files. Community Hero provides dual formatting dynamically for seamless bureaucratic access!
                    </p>
                  </div>
                </div>
              </div>

              {/* Right content list block */}
              <div className="lg:col-span-9 space-y-4">
                
                {/* Search Text field */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by street name, keyword, municipal department, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 rounded-2xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-navy transition-all"
                  />
                </div>

                {/* Issue card grid */}
                {filteredReports.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/60 max-w-lg mx-auto space-y-4">
                    <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
                    <div>
                      <h4 className="font-display font-extrabold text-sm text-slate-800">No matching reports found</h4>
                      <p className="text-xs text-slate-400 mt-1">Try relaxing your search parameters or select a different metropolitan city region filter.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      {visibleReports.map(report => {
                        const hasUserUpvoted = report.upvotesUsers.includes(mockUser.uid);
                        
                        return (
                          <div
                            key={report.id}
                            className="bg-white rounded-2xl border border-slate-200/60 hover:border-navy/15 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:-translate-y-0.5 hardware-accelerated"
                          >
                            <div className="p-5 space-y-3.5">
                              {/* Card Top Badges */}
                              <div className="flex items-center justify-between">
                                <span className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${
                                  report.severity.toUpperCase() === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                                  (report.severity.toUpperCase() === 'SEVERE' || report.severity.toUpperCase() === 'HIGH') ? 'bg-amber-100 text-amber-800' :
                                  (report.severity.toUpperCase() === 'MODERATE' || report.severity.toUpperCase() === 'MEDIUM') ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                                }`}>{report.severity} Priority</span>
                                
                                <span className={`text-[9px] font-semibold tracking-wide px-2 py-0.5 rounded-md ${
                                  report.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' :
                                  report.status === 'In-Progress' ? 'bg-sky-100 text-sky-800' :
                                  report.status === 'In-Review' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                                }`}>{report.status}</span>
                              </div>
                              
                              {/* Card Title and Address */}
                              <div className="space-y-1">
                                <h4 className="font-display font-bold text-sm text-slate-900 group-hover:text-navy transition-colors line-clamp-1">{report.title}</h4>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold leading-tight font-mono">
                                  <MapPin className="w-3.5 h-3.5 text-navy shrink-0" />
                                  <span className="line-clamp-1">{report.location.address}</span>
                                </div>
                              </div>

                              {/* Description and visual asset */}
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{report.description}</p>
                              
                              {report.imageUrl && (
                                <div className="h-28 w-full rounded-xl overflow-hidden relative">
                                  <img src={report.imageUrl} alt={report.title} className="w-full h-full object-cover" />
                                  <span className="absolute bottom-2 left-2 bg-black/75 text-[8px] text-white px-2 py-0.5 rounded uppercase font-bold tracking-wider">AI Verified View</span>
                                </div>
                              )}

                              {/* Department Info */}
                              <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-slate-50 rounded-lg p-2.5 border border-slate-100 line-clamp-1">
                                <Building2 className="w-3.5 h-3.5 text-navy shrink-0" />
                                <span>{report.suggestedDepartment}</span>
                              </div>
                            </div>

                            {/* Card bottom actions */}
                            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-3">
                              <span className="text-[9px] text-slate-400 font-semibold font-mono">
                                Filed: {new Date(report.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                              
                              <div className="flex items-center gap-2">
                                {/* Attest support button */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpvote(report.id); }}
                                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                                    hasUserUpvoted 
                                      ? 'bg-navy/10 text-navy' 
                                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                                  }`}
                                >
                                  <ArrowUp className={`w-3.5 h-3.5 ${hasUserUpvoted ? 'text-navy fill-navy' : 'text-slate-400'}`} />
                                  <span>Agreed ({report.upvotesCount})</span>
                                </button>

                                {/* View / Review complaint details button */}
                                <button
                                  onClick={() => { setSelectedReportForReview(report); setActiveReviewLangTab('en'); }}
                                  className="px-2.5 py-1.5 bg-navy text-white hover:bg-navy-hover transition-colors rounded-lg text-[10px] font-extrabold cursor-pointer"
                                >
                                  Review
                                </button>
                              </div>
                            </div>
                     
                          </div>
                        );
                      })}
                    </div>

                    {filteredReports.length > visibleReportsCount && (
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={() => setVisibleReportsCount(prev => prev + 6)}
                          className="px-6 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          Show More Grievances ({filteredReports.length - visibleReportsCount} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        {/* REPORT ISSUE TAB SEGMENT */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            <Suspense fallback={<TabLoadingPlaceholder />}>
              <ReportWizard
                onSuccess={handleAddNewReport}
                userId={mockUser.uid}
                userEmail={mockUser.email}
                userName={mockUser.displayName}
              />
            </Suspense>
          </div>
        )}

        {/* MAP EXPLORER SEGMENT */}
        {activeTab === 'map' && (
          <div className="space-y-6 h-[550px] relative">
            <div className="absolute top-4 right-4 z-[999] bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <span className="text-xs font-bold text-slate-650">Select City Hub:</span>
              <select
                value={selectedCityFilter === 'All' ? 'Bengaluru' : selectedCityFilter}
                onChange={(e) => setSelectedCityFilter(e.target.value)}
                className="border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold focus:outline-none"
              >
                {INDIAN_CITIES.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <Suspense fallback={<TabLoadingPlaceholder />}>
              <CivicMap
                reports={reports}
                selectedCity={selectedCityFilter === 'All' ? 'Bengaluru' : selectedCityFilter}
                onSelectReport={(rep) => {
                  setSelectedReportForReview(rep);
                  setActiveReviewLangTab('en');
                }}
              />
            </Suspense>
          </div>
        )}

        {/* CHATBOT ADVISOR SEGMENT */}
        {activeTab === 'chat' && (
          <div className="space-y-6 animate-fade-in">
            <Suspense fallback={<TabLoadingPlaceholder />}>
              <CivicBot />
            </Suspense>
          </div>
        )}

        {/* CORPORATE/MUNICIPAL RANKINGS AND GLORY TAB */}
        {activeTab === 'ranking' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            
            {/* Header statement bar */}
            <div className="bg-navy rounded-3xl p-6 text-white shadow-xs">
              <h2 className="font-display font-extrabold text-lg text-white">National Civic Transparency Scoreboard</h2>
              <p className="text-xs text-slate-350 leading-relaxed mt-0.5">Recognizing the top performing Municipal Corporations and active citizen vigilantes working together for a cleaner India.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Leaders board card 1: Municipalities */}
              <Suspense fallback={<TabLoadingPlaceholder />}>
                <MunicipalRankings municipalRankings={municipalRankings} />
              </Suspense>

              {/* Leaders board card 2: Active Citizens (Citizen Heroes) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="p-2 bg-green-t/10 text-green-t rounded-xl inline-flex">
                    <Users className="w-5 h-5 animate-pulse" />
                  </span>
                  <h3 className="font-display font-bold text-sm text-slate-800">National Citizen Heroes of India</h3>
                </div>

                <div className="space-y-3">
                  {citizenRankings.map((cit) => (
                    <div 
                      key={cit.uid} 
                      className={`p-3.5 rounded-xl border flex items-center justify-between ${
                        cit.uid === user.uid 
                          ? 'bg-navy/5 border-navy/20' 
                          : 'bg-slate-50/50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {cit.photoURL ? (
                          <img 
                            src={cit.photoURL} 
                            alt={cit.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover border border-slate-200" 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center">
                            {cit.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className={`text-xs font-sans ${cit.uid === user.uid ? 'font-extrabold text-navy' : 'font-bold text-slate-800'}`}>
                            {cit.name} {cit.uid === user.uid && "(You)"}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-semibold font-mono">
                            {cit.city} • {cit.reportsSubmitted} Filed • {cit.issuesResolved} Resolved
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-saffron font-mono">🏆 {cit.score.toLocaleString()}pts</span>
                        <span className={`block text-[9px] font-extrabold uppercase mt-0.5 tracking-wider ${
                          cit.uid === user.uid ? 'text-navy' : 'text-emerald-600'
                        }`}>{cit.badge}</span>
                      </div>
                    </div>
                  ))}
                  {citizenRankings.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400 font-mono">
                      Summoning Swachh Leaders...
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* FULL GRANDE VIEW DIALOG MODAL PANEL (For reviewing any filed issue) */}
      {selectedReportForReview && (
        <div data-lenis-prevent className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/50 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Heading Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  selectedReportForReview.severity.toUpperCase() === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                  (selectedReportForReview.severity.toUpperCase() === 'SEVERE' || selectedReportForReview.severity.toUpperCase() === 'HIGH') ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}>{selectedReportForReview.severity} Severity</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded font-mono font-bold leading-tight uppercase">{selectedReportForReview.status}</span>
              </div>
              <button
                onClick={() => setSelectedReportForReview(null)}
                className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 font-bold hover:text-rose-600 text-slate-500 rounded-xl transition-colors text-xs cursor-pointer flex items-center gap-0.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>

            {/* Scrollable Document Body */}
            <div data-lenis-prevent className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
              
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-base md:text-lg text-slate-900 leading-snug">{selectedReportForReview.title}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-400 font-semibold font-mono">
                  <span className="flex items-center gap-0.5 text-navy">📍City: <b className="font-sans font-extrabold text-slate-700">{selectedReportForReview.location.city}</b></span>
                  <span>Category: <b className="font-sans font-bold text-slate-700">{selectedReportForReview.category}</b></span>
                  <span>Registered: <b className="font-sans font-medium text-slate-700">{new Date(selectedReportForReview.createdAt).toLocaleDateString()}</b></span>
                </div>
              </div>

              {/* Verified Image box */}
              {selectedReportForReview.imageUrl && (
                <div className="w-full rounded-2xl h-56 md:h-64 overflow-hidden shadow-xs border border-slate-100 relative">
                  <img src={selectedReportForReview.imageUrl} alt={selectedReportForReview.title} className="w-full h-full object-cover" />
                  <span className="absolute bottom-3 left-3 bg-black/80 text-[9px] text-white font-bold tracking-wider px-3 py-1 rounded-lg uppercase">AI INFRASTRUCTURE DIAGNOSTIC SCAN VIEW</span>
                </div>
              )}

              {/* Description summary */}
              <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed font-medium">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Citizen Observation description</span>
                <p className="bg-slate-50 p-4 rounded-xl border border-slate-100">{selectedReportForReview.description}</p>
              </div>

              {/* Rationale justification text */}
              {selectedReportForReview.severityJustification && (
                <div className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
                  <span className="block text-[10px] font-bold text-rose-500 uppercase tracking-widest">AI Safety Assessment Justification</span>
                  <p className="bg-rose-50/40 p-4 rounded-xl border border-rose-100/50 font-medium italic text-rose-800">
                    "{selectedReportForReview.severityJustification}"
                  </p>
                </div>
              )}

              {/* suggested department responsible */}
              <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-navy shrink-0" />
                  <div>
                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Responsible Municipal Authority</span>
                    <span className="text-xs font-bold text-slate-800">{selectedReportForReview.suggestedDepartment}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Escalated Resolution Time</span>
                  <span className="text-xs font-extrabold text-emerald-700 font-mono">Within {selectedReportForReview.severity.toUpperCase() === 'CRITICAL' ? '24 Hours' : '48-72 Hours'}</span>
                </div>
              </div>

              {/* BILINGUAL COMPLAINT SHEETS FOR COMMISSIONERS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-105 pb-2">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-navy" />
                    <span>Official Grievance Complaint Copy</span>
                  </span>
                  
                  {/* Lang Switch */}
                  <div className="bg-slate-100 p-0.5 rounded-lg flex text-[10px] font-bold">
                    <button
                      onClick={() => setActiveReviewLangTab('en')}
                      className={`px-3 py-1 rounded transition-all cursor-pointer ${activeReviewLangTab === 'en' ? 'bg-white text-navy shadow-xs' : 'text-slate-400'}`}
                    >
                      English Draft
                    </button>
                    <button
                      onClick={() => setActiveReviewLangTab('hi')}
                      className={`px-3 py-1 rounded transition-all cursor-pointer ${activeReviewLangTab === 'hi' ? 'bg-white text-navy shadow-xs' : 'text-slate-400'}`}
                    >
                      हिंदी ड्राफ्ट
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    rows={8}
                    value={activeReviewLangTab === 'en' ? selectedReportForReview.complaintDraftEnglish : selectedReportForReview.complaintDraftHindi}
                    className="w-full border border-slate-200/80 px-5 py-4 rounded-2xl text-xs leading-relaxed bg-slate-50/50 text-slate-700 focus:outline-none whitespace-pre-line font-medium"
                  />
                  <button
                    onClick={() => {
                      const text = activeReviewLangTab === 'en' ? selectedReportForReview.complaintDraftEnglish : selectedReportForReview.complaintDraftHindi;
                      navigator.clipboard.writeText(text);
                      alert("Grievance draft successfully copied. You can use it on public municipal grievance portals (like Namma Bengaluru BBMP on map, BMC PG Portal system, or RTI applications)!");
                    }}
                    className="absolute top-4 right-4 bg-white/95 border border-slate-200 hover:bg-slate-50 text-navy font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Letter</span>
                  </button>
                </div>

                {/* Local advice */}
                {selectedReportForReview.civicAdvice && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-2.5">
                    <BadgeHelp className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-emerald-800">Civic Duty Safety Advice</h5>
                      <p className="text-[11px] text-emerald-600 font-medium leading-relaxed mt-0.5">{selectedReportForReview.civicAdvice}</p>
                    </div>
                  </div>
                )}

                {/* Detailed Predictive Risk Analysis */}
                {selectedReportForReview.workflowState?.riskPrediction && (selectedReportForReview.workflowState.riskPrediction.futureRisk || (selectedReportForReview.workflowState.riskPrediction.possibleConsequences && selectedReportForReview.workflowState.riskPrediction.possibleConsequences.length > 0)) && (
                  <div className="bg-rose-50/20 rounded-2xl border border-rose-100/60 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-rose-100/40 pb-2">
                      <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-rose-600 animate-pulse" />
                        <span>Failure Cascade & Public Safety Risk Analysis</span>
                      </span>
                      {selectedReportForReview.workflowState.riskPrediction.urgencyLevel && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                          selectedReportForReview.workflowState.riskPrediction.urgencyLevel.toLowerCase() === 'critical' ? 'bg-red-100 text-red-800 border-red-200' :
                          selectedReportForReview.workflowState.riskPrediction.urgencyLevel.toLowerCase() === 'high' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                          selectedReportForReview.workflowState.riskPrediction.urgencyLevel.toLowerCase() === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          Urgency: {selectedReportForReview.workflowState.riskPrediction.urgencyLevel}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Column: Predictions & Consequences */}
                      <div className="space-y-3">
                        {selectedReportForReview.workflowState.riskPrediction.futureRisk && (
                          <div className="space-y-1">
                            <h6 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide font-mono">Future Risk Progression</h6>
                            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                              {selectedReportForReview.workflowState.riskPrediction.futureRisk}
                            </p>
                          </div>
                        )}

                        {selectedReportForReview.workflowState.riskPrediction.possibleConsequences && selectedReportForReview.workflowState.riskPrediction.possibleConsequences.length > 0 && (
                          <div className="space-y-1">
                            <h6 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide font-mono">Possible Consequences</h6>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {selectedReportForReview.workflowState.riskPrediction.possibleConsequences.map((consequence: string, idx: number) => (
                                <span key={idx} className="bg-rose-50 text-rose-700 font-bold px-2 py-1 rounded-lg text-[10px] border border-rose-100 flex items-center gap-1">
                                  <span>⚠️</span>
                                  <span>{consequence}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Community Impact & Recommendations */}
                      <div className="space-y-3">
                        {selectedReportForReview.workflowState.riskPrediction.communityImpact && (
                          <div className="space-y-1">
                            <h6 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide font-mono">Community Impact</h6>
                            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                              {selectedReportForReview.workflowState.riskPrediction.communityImpact}
                            </p>
                          </div>
                        )}

                        {selectedReportForReview.workflowState.riskPrediction.recommendations && selectedReportForReview.workflowState.riskPrediction.recommendations.length > 0 && (
                          <div className="space-y-1">
                            <h6 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide font-mono">Safety Recommendations</h6>
                            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600 font-medium leading-relaxed">
                              {selectedReportForReview.workflowState.riskPrediction.recommendations.map((rec: string, idx: number) => (
                                <li key={idx}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Citizen Summary Panel */}
                {selectedReportForReview.citizenSummary && (
                  <div className="bg-amber-50/30 p-5 rounded-2xl border border-amber-100/60 space-y-2 relative">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Citizen Empowerment & Rights Summary</span>
                    </span>
                    <p className="text-xs text-amber-900 leading-relaxed font-medium whitespace-pre-line">
                      {selectedReportForReview.citizenSummary}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedReportForReview.citizenSummary || '');
                        alert("Citizen empowerment summary successfully copied!");
                      }}
                      className="absolute top-4 right-4 bg-white border border-amber-200/60 hover:bg-amber-50 text-amber-800 px-3 py-1.5 rounded-xl font-bold text-[10px] shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-500" />
                      <span>Copy Summary</span>
                    </button>
                  </div>
                )}

                {/* RTI Escalation Draft Panel */}
                {selectedReportForReview.rtiEscalationDraft && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Right to Information (RTI) Escalation Draft</span>
                    </span>
                    <div className="relative">
                      <textarea
                        readOnly
                        rows={8}
                        value={selectedReportForReview.rtiEscalationDraft}
                        className="w-full border border-slate-200 px-5 py-4 rounded-2xl text-xs leading-relaxed font-mono bg-slate-50/50 text-slate-700 focus:outline-none whitespace-pre-line"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedReportForReview.rtiEscalationDraft || '');
                          alert("RTI application draft successfully copied!");
                        }}
                        className="absolute top-4 right-4 bg-white/95 border border-slate-200 hover:bg-slate-50 text-indigo-700 px-3 py-1.5 rounded-xl font-bold text-[10px] shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Copy RTI Draft</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ESCALATION STATUS ADHOC SIMULATOR */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Escalation Resolution State</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${
                        selectedReportForReview.status === 'Verified' ? 'bg-emerald-600' :
                        selectedReportForReview.status === 'Resolved' ? 'bg-emerald-400 animate-pulse' :
                        selectedReportForReview.status === 'In-Progress' ? 'bg-amber-500 animate-pulse' :
                        selectedReportForReview.status === 'Reopened' ? 'bg-rose-500 animate-pulse' :
                        'bg-slate-400'
                      }`} />
                      <span className={`text-[10px] font-mono font-black uppercase ${
                        selectedReportForReview.status === 'Verified' ? 'text-emerald-800' :
                        selectedReportForReview.status === 'Resolved' ? 'text-emerald-700' :
                        selectedReportForReview.status === 'In-Progress' ? 'text-amber-700' :
                        selectedReportForReview.status === 'Reopened' ? 'text-rose-700' :
                        'text-slate-650'
                      }`}>
                        {selectedReportForReview.status}
                      </span>
                    </div>
                  </div>
                  
                  {/* Controls based on Role */}
                  {user && user.role === UserRole.MUNICIPAL_OFFICER ? (
                    // 👮 MUNICIPAL OFFICER ACTIONS
                    <div className="flex gap-1.5 flex-wrap">
                      {(selectedReportForReview.status !== 'In-Progress' && 
                        selectedReportForReview.status !== 'IN_PROGRESS' && 
                        selectedReportForReview.status !== 'Resolved' && 
                        selectedReportForReview.status !== 'RESOLVED' && 
                        selectedReportForReview.status !== 'Verified' && 
                        selectedReportForReview.status !== 'CLOSED') && (
                        <button
                          onClick={async () => {
                            await handleUpdateStatus(selectedReportForReview.id, 'IN_PROGRESS');
                            addNotification(user.uid, "Case Acknowledged", `You have acknowledged the grievance report: '${selectedReportForReview.title}'`, 'info');
                          }}
                          className="bg-navy hover:bg-slate-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                        >
                          Acknowledge (Work-In-Progress)
                        </button>
                      )}
                      {(selectedReportForReview.status !== 'Resolved' && 
                        selectedReportForReview.status !== 'RESOLVED' && 
                        selectedReportForReview.status !== 'Verified' && 
                        selectedReportForReview.status !== 'CLOSED') && (
                        <button
                          onClick={async () => {
                            await handleUpdateStatus(selectedReportForReview.id, 'RESOLVED');
                            addNotification(user.uid, "Case Resolved", `You marked grievance: '${selectedReportForReview.title}' as Resolved`, 'success');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  ) : (
                    // 🧑 CITIZEN ACTIONS
                    <div className="flex flex-col sm:items-end gap-1.5">
                      {(selectedReportForReview.status === 'Resolved' || 
                        selectedReportForReview.status === 'RESOLVED' || 
                        selectedReportForReview.status === 'VERIFICATION_PENDING') ? (
                        <div className="space-y-1 text-left sm:text-right">
                          <div className="flex gap-1.5 justify-start sm:justify-end">
                            <button
                              onClick={async () => {
                                await handleUpdateStatus(selectedReportForReview.id, 'CLOSED');
                                addNotification(selectedReportForReview.userId, "Resolution Verified!", `You have verified that '${selectedReportForReview.title}' has been successfully resolved. Thank you!`, 'success');
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-1"
                            >
                              <span>Verify Resolution</span>
                            </button>
                            <button
                              onClick={async () => {
                                await handleUpdateStatus(selectedReportForReview.id, 'REOPENED');
                                addNotification(selectedReportForReview.userId, "Case Reopened", `You rejected the resolution and reopened: '${selectedReportForReview.title}'`, 'info');
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                            >
                              Reopen Issue
                            </button>
                          </div>
                          <span className="block text-[8px] text-slate-450 font-medium">As a citizen, you can verify this work or reopen if the hazard persists.</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-medium italic">
                          {(selectedReportForReview.status === 'Verified' || selectedReportForReview.status === 'CLOSED') ? "Thank you for verifying this municipal correction." :
                           (selectedReportForReview.status === 'In-Progress' || selectedReportForReview.status === 'IN_PROGRESS') ? "Ward engineers are actively servicing this site." :
                           "Awaiting initial ward officer inspection."}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* VISUAL ISSUE LIFECYCLE TIMELINE */}
                <IssueTimeline issueId={selectedReportForReview.id} />
              </div>

            </div>

            {/* Modal Bottom action footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Support: {selectedReportForReview.upvotesCount} Citizens Attested
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpvote(selectedReportForReview.id)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 border ${
                    selectedReportForReview.upvotesUsers.includes(mockUser.uid)
                      ? 'bg-navy/10 border-navy/20 text-navy'
                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>I agree (Support Grievance)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FOOTER COOPERATIVE FRAME */}
      <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-saffron text-white flex items-center justify-center font-display font-bold text-xs">C</div>
              <h4 className="font-display font-extrabold text-sm text-white">Community Hero</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Sovereign AI Citizen Empowering Portal built for Indian metropolitan city zones. Providing 100% transparent public grievance, GIS spatial tracking, and bilingual AI complaint translation.
            </p>
          </div>
          <div>
            <h5 className="text-xs font-extrabold uppercase tracking-widest text-slate-200 mb-3">Participating Cities</h5>
            <ul className="text-xs space-y-1.5 text-slate-500 font-mono font-medium">
              <li>✨ BBMP Ward Circle Bengaluru</li>
              <li>✨ BMC Administration Zone Mumbai</li>
              <li>✨ MCD Street Light Grid Delhi</li>
              <li>✨ PMC Road Rehabilitation Pune</li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-extrabold uppercase tracking-widest text-slate-200 mb-3">Hackathon Compliance</h5>
            <p className="text-xs text-slate-505 leading-relaxed font-medium">
              Powered by Server-Side **Gemini-2.5-Flash** for strict secure vision analysis and zero-leak API key operations inside Google Cloud Run.
            </p>
            <div className="flex items-center gap-2 mt-4 text-[11px] text-saffron uppercase font-bold tracking-wider font-mono">
              <span className="w-2 h-2 rounded-full bg-green-t animate-ping"></span>
              <span>Online Core Node Verified</span>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 border-t border-slate-800/80 mt-8 pt-6 flex flex-wrap justify-between text-[11px] text-slate-600 font-mono font-medium">
          <span>© 2026 Community Hero India. All rights reserved.</span>
          <span>Designed with Saffron, Navy Blue, and Green-T elements.</span>
        </div>
      </footer>

    </div>
  );
}
