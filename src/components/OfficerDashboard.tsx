import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Report, UserRole } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { addStatusHistoryEntry } from '../utils/statusHistoryService';
import { useAuth } from '../features/auth/useAuth';
import { useNotifications } from '../features/notifications/NotificationProvider';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Eye, 
  FileEdit, 
  RefreshCw, 
  CheckSquare, 
  Inbox, 
  ArrowRight,
  TrendingUp,
  Award,
  Shield,
  Trash2,
  Camera,
  Share2,
  Send,
  Check,
  FileText,
  Activity,
  Bell,
  UserCheck,
  History,
  X,
  Upload,
  UserPlus
} from 'lucide-react';

interface OfficerDashboardProps {
  reports: Report[];
  onUpdateStatus: (reportId: string, newStatus: 'Reported' | 'In-Review' | 'In-Progress' | 'Resolved' | 'Verified' | 'Reopened') => Promise<void>;
  onSelectReport: (report: Report) => void;
}

export default function OfficerDashboard({ reports, onUpdateStatus, onSelectReport }: OfficerDashboardProps) {
  const { user } = useAuth();
  const { addNotification, notifications } = useNotifications();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'assigned' | 'critical' | 'analytics' | 'notifications'>('overview');
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Reported' | 'In-Progress' | 'Resolved' | 'Verified' | 'Reopened'>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Roads & Traffic' | 'Solid Waste Management' | 'Water & Sanitation' | 'Electricity & Illumination'>('All');

  // Officer Assignment Actions States
  const [inspectingReport, setInspectingReport] = useState<Report | null>(null);
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [reassignmentRemarks, setReassignmentRemarks] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('Roads & Traffic');
  const [completionImage, setCompletionImage] = useState<string | null>(null);
  const [completionImageName, setCompletionImageName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verify that current user is an officer
  if (!user || user.role !== UserRole.MUNICIPAL_OFFICER) {
    return (
      <div className="p-8 text-center max-w-md mx-auto space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
        <p className="text-sm text-slate-500">Only authorized municipal officers can view the Officer Desk.</p>
      </div>
    );
  }

  const officerCity = user.city || 'Mumbai';
  const officerWard = user.ward || 'Ward 14';
  const officerDept = user.department || 'Roads & Traffic';

  // Compute stats for Officer's City
  const stats = useMemo(() => {
    const cityReports = reports.filter(r => r.location.city.toLowerCase() === officerCity.toLowerCase());
    const myDeptReports = cityReports.filter(r => r.category.toLowerCase().includes(officerDept.toLowerCase().split(' ')[0]));
    const myAssigned = cityReports.filter(r => r.assignedToOfficerId === user.uid);
    
    // Calculate average resolution time in hours
    const resolvedReports = cityReports.filter(r => (r.status === 'Resolved' || r.status === 'Verified') && r.resolvedAt);
    let avgResolutionTimeText = 'Pending Data';
    if (resolvedReports.length > 0) {
      const totalHours = resolvedReports.reduce((acc, r) => {
        const created = new Date(r.createdAt).getTime();
        const resolved = new Date(r.resolvedAt!).getTime();
        return acc + Math.max(0, (resolved - created) / (1000 * 60 * 60));
      }, 0);
      const avgHours = totalHours / resolvedReports.length;
      if (avgHours < 24) {
        avgResolutionTimeText = `${Math.round(avgHours)} Hours`;
      } else {
        avgResolutionTimeText = `${(avgHours / 24).toFixed(1)} Days`;
      }
    }

    // Resolved today calculation
    const todayStr = new Date().toDateString();
    const resolvedTodayCount = cityReports.filter(r => {
      if ((r.status === 'Resolved' || r.status === 'Verified') && r.resolvedAt) {
        return new Date(r.resolvedAt).toDateString() === todayStr;
      }
      return false;
    }).length;

    return {
      total: cityReports.length,
      reported: cityReports.filter(r => r.status === 'Reported').length,
      inProgress: cityReports.filter(r => r.status === 'In-Progress').length,
      resolved: cityReports.filter(r => r.status === 'Resolved' || r.status === 'Verified').length,
      reopened: cityReports.filter(r => r.status === 'Reopened').length,
      verified: cityReports.filter(r => r.status === 'Verified').length,
      critical: cityReports.filter(r => r.severity === 'Critical' || r.severity === 'Severe').length,
      myAssigned: myAssigned.length,
      myDeptPending: myDeptReports.filter(r => r.status !== 'Resolved' && r.status !== 'Verified').length,
      resolvedToday: resolvedTodayCount,
      avgResolutionTime: avgResolutionTimeText
    };
  }, [reports, officerCity, officerDept, user.uid]);

  // Filtered reports subset memoized based on section
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      // Must match the officer's registered city
      const matchesCity = report.location.city.toLowerCase() === officerCity.toLowerCase();
      if (!matchesCity) return false;

      // Handle specific tab routes
      if (activeSubTab === 'assigned') {
        // Show reports explicitly assigned to me OR matching my dept & ward but not assigned yet
        const isAssignedToMe = report.assignedToOfficerId === user.uid;
        const matchesMyDeptAndWard = 
          !report.assignedToOfficerId && 
          report.category.toLowerCase().includes(officerDept.toLowerCase().split(' ')[0]) &&
          (report.location.address.toLowerCase().includes(officerWard.toLowerCase().split(' ')[0]) || officerWard === 'General Zone');
        
        if (!isAssignedToMe && !matchesMyDeptAndWard) return false;
      } else if (activeSubTab === 'critical') {
        // Show only critical/severe issues in the city
        const isCritical = report.severity === 'Critical' || report.severity === 'Severe';
        if (!isCritical) return false;
      }

      // Filter by status dropdown
      const matchesStatus = statusFilter === 'All' || report.status === statusFilter;
      if (!matchesStatus) return false;

      // Filter by category dropdown
      const matchesCategory = categoryFilter === 'All' || report.category === categoryFilter;
      if (!matchesCategory) return false;

      // Filter by search query
      const matchesSearch = searchQuery.trim() === '' ||
        report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.location.address.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [reports, officerCity, activeSubTab, statusFilter, categoryFilter, searchQuery, user.uid, officerDept, officerWard]);

  // Analytics tab visual data computation
  const chartsData = useMemo(() => {
    // 1. Status count
    const statusCounts = [
      { name: 'Reported', value: reports.filter(r => r.location.city === officerCity && r.status === 'Reported').length, color: '#f97316' },
      { name: 'In-Review', value: reports.filter(r => r.location.city === officerCity && r.status === 'In-Review').length, color: '#a855f7' },
      { name: 'In-Progress', value: reports.filter(r => r.location.city === officerCity && r.status === 'In-Progress').length, color: '#0ea5e9' },
      { name: 'Resolved', value: reports.filter(r => r.location.city === officerCity && r.status === 'Resolved').length, color: '#10b981' },
      { name: 'Verified', value: reports.filter(r => r.location.city === officerCity && r.status === 'Verified').length, color: '#047857' },
      { name: 'Reopened', value: reports.filter(r => r.location.city === officerCity && r.status === 'Reopened').length, color: '#ef4444' }
    ].filter(item => item.value > 0);

    // 2. Department counts
    const deptData = ['Roads & Traffic', 'Solid Waste Management', 'Water & Sanitation', 'Electricity & Illumination'].map(cat => {
      const catReports = reports.filter(r => r.location.city === officerCity && r.category === cat);
      return {
        name: cat.split(' & ')[0],
        Total: catReports.length,
        Resolved: catReports.filter(r => r.status === 'Resolved' || r.status === 'Verified').length,
        Active: catReports.filter(r => r.status !== 'Resolved' && r.status !== 'Verified').length
      };
    });

    return { statusCounts, deptData };
  }, [reports, officerCity]);

  // Real-time notifications for this officer
  const officerNotifications = useMemo(() => {
    return notifications.filter(n => n.userId === user.uid);
  }, [notifications, user.uid]);

  // Drag & Drop Handlers for Resolution Image
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Please upload a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCompletionImage(reader.result as string);
      setCompletionImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  // 👮 Core Action: Accept Complaint
  const handleAcceptComplaint = async (report: Report) => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'reports', report.id);
      const previousStatus = report.status || "SUBMITTED";
      const updatePayload: any = {
        status: 'ACCEPTED',
        assignedToOfficerId: user.uid,
        assignedToOfficerName: user.name,
        officerRemarks: 'Grievance accepted. Commencing remedial ward deployment.'
      };

      await updateDoc(docRef, updatePayload);
      
      // Log status history transition
      await addStatusHistoryEntry({
        issueId: report.id,
        previousStatus,
        currentStatus: 'ACCEPTED',
        updatedBy: `${user.name} (Officer)`,
        timestamp: new Date().toISOString(),
        remarks: `Officer accepted the complaint. Commencing remedial ward deployment.`
      });
      
      // Dispatch in-app notifications
      await addNotification(
        user.uid,
        "Grievance Accepted",
        `You have successfully assigned '${report.title}' to yourself.`,
        'success'
      );

      if (report.userId) {
        await addNotification(
          report.userId,
          "Officer Assigned",
          `Officer ${user.name} has accepted your grievance '${report.title}' and scheduled field correction.`,
          'info'
        );
      }

      setInspectingReport(prev => prev ? { ...prev, ...updatePayload } : null);
    } catch (err) {
      console.error("Failed to accept grievance:", err);
      alert("System sync error: Could not complete assignment.");
    } finally {
      setIsSaving(false);
    }
  };

  // 👮 Core Action: Mark In Progress
  const handleMarkInProgress = async (report: Report) => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'reports', report.id);
      const previousStatus = report.status || "ACCEPTED";
      const updatePayload: any = {
        status: 'IN_PROGRESS',
        officerRemarks: resolutionRemarks || 'Field crew deployed to site.'
      };

      await updateDoc(docRef, updatePayload);
      
      // Log status history transition
      await addStatusHistoryEntry({
        issueId: report.id,
        previousStatus,
        currentStatus: 'IN_PROGRESS',
        updatedBy: `${user.name} (Officer)`,
        timestamp: new Date().toISOString(),
        remarks: resolutionRemarks || 'Field crew deployed to site for correction.'
      });
      
      await addNotification(
        user.uid,
        "Status Progressed",
        `Grievance '${report.title}' marked In-Progress.`,
        'info'
      );

      if (report.userId) {
        await addNotification(
          report.userId,
          "Work In-Progress",
          `Ward engineers are actively servicing your reported issue: '${report.title}'`,
          'info'
        );
      }

      setResolutionRemarks('');
      setInspectingReport(prev => prev ? { ...prev, ...updatePayload } : null);
    } catch (err) {
      console.error("Failed to update to In-Progress:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // 👮 Core Action: Mark Resolved (with remarks and image)
  const handleMarkResolved = async (report: Report) => {
    if (!resolutionRemarks.trim()) {
      alert("Please provide completion/remediation remarks before resolving.");
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const docRef = doc(db, 'reports', report.id);
      const previousStatus = report.status || "IN_PROGRESS";
      
      // Fallback resolved image if they didn't upload one
      const finalImage = completionImage || 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&q=80&w=800';

      const updatePayload: any = {
        status: 'RESOLVED',
        resolvedAt: now,
        officerRemarks: resolutionRemarks,
        completionImageUrl: finalImage
      };

      await updateDoc(docRef, updatePayload);

      // Log status history transition
      await addStatusHistoryEntry({
        issueId: report.id,
        previousStatus,
        currentStatus: 'RESOLVED',
        updatedBy: `${user.name} (Officer)`,
        timestamp: now,
        remarks: `Grievance resolved. Completion remarks: "${resolutionRemarks}"`
      });

      await addNotification(
        user.uid,
        "Grievance Resolved",
        `You have successfully resolved public grievance '${report.title}'.`,
        'success'
      );

      if (report.userId) {
        await addNotification(
          report.userId,
          "Grievance Resolved! 🎉",
          `Officer ${user.name} resolved: '${report.title}'. Remarks: "${resolutionRemarks}"`,
          'success'
        );
      }

      setResolutionRemarks('');
      setCompletionImage(null);
      setCompletionImageName('');
      setInspectingReport(null); // Close inspect overlay
    } catch (err) {
      console.error("Failed to resolve grievance:", err);
      alert("System sync error: Could not save resolution.");
    } finally {
      setIsSaving(false);
    }
  };

  // 👮 Core Action: Reassign Complaint (transfer department/ward)
  const handleReassignComplaint = async (report: Report) => {
    if (!reassignmentRemarks.trim()) {
      alert("Please specify a justification for transferring/reassigning this file.");
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, 'reports', report.id);
      const previousStatus = report.status || "SUBMITTED";
      const reassignLog = `Reassigned from ${report.suggestedDepartment} to ${targetDepartment} by ${user.name} on ${new Date().toLocaleDateString()}: "${reassignmentRemarks}"`;
      
      const newHistory = [...(report.reassignedHistory || []), reassignLog];

      const updatePayload: any = {
        suggestedDepartment: targetDepartment,
        status: 'SUBMITTED', // reset status so the new department can process
        assignedToOfficerId: '', // clear current assignee
        assignedToOfficerName: '',
        reassignedHistory: newHistory,
        officerRemarks: `Transferred file: ${reassignmentRemarks}`
      };

      await updateDoc(docRef, updatePayload);

      // Log status history transition
      await addStatusHistoryEntry({
        issueId: report.id,
        previousStatus,
        currentStatus: 'SUBMITTED',
        updatedBy: `${user.name} (Officer)`,
        timestamp: new Date().toISOString(),
        remarks: `Reassigned from department '${report.suggestedDepartment}' to '${targetDepartment}'. Justification: "${reassignmentRemarks}"`
      });

      await addNotification(
        user.uid,
        "File Transferred",
        `Grievance '${report.title}' successfully reassigned to ${targetDepartment}.`,
        'info'
      );

      if (report.userId) {
        await addNotification(
          report.userId,
          "Department Reassigned",
          `Your reported issue was reassigned to '${targetDepartment}' for specialized handling.`,
          'info'
        );
      }

      setReassignmentRemarks('');
      setInspectingReport(null); // Close inspect overlay
    } catch (err) {
      console.error("Failed to reassign grievance:", err);
      alert("System sync error: Reassignment failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* 👮 OFFICER PROFILE HEADER BANNER */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
            <Building2 className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-extrabold text-xl text-slate-900 tracking-tight">Municipal Command Panel</h2>
              <span className="bg-amber-600/10 text-amber-700 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border border-amber-200/20">Authorized Desk</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Registered Officer: <span className="font-bold text-slate-700">{user.name}</span> • {user.designation || 'Circle Inspector'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-medium text-slate-400">
              <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-mono">
                <MapPin className="w-3 h-3 text-amber-600" /> {officerCity} ({officerWard})
              </span>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-mono">
                <Briefcase className="w-3 h-3 text-emerald-600" /> {officerDept}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-amber-800 bg-amber-50/50 p-3 rounded-2xl border border-amber-200/30">
          <Clock className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '4s' }} />
          <div>
            <span className="block font-bold">MUTATION RESOLUTION DESK</span>
            <span>AUTO-SYNC ACTIVE SECURE-256</span>
          </div>
        </div>
      </div>

      {/* 👮 SUB-ROUTING NAVIGATION TABS (ROLE-BASED SECTIONS) */}
      <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-200/60 max-w-2xl">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'overview'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/10'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveSubTab('assigned')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
            activeSubTab === 'assigned'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/10'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>My Queue</span>
          {stats.myAssigned > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-mono w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {stats.myAssigned}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('critical')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
            activeSubTab === 'critical'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/10'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Critical Issues</span>
          {stats.critical > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-mono w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {stats.critical}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'analytics'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/10'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Analytics</span>
        </button>
        <button
          onClick={() => setActiveSubTab('notifications')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
            activeSubTab === 'notifications'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/10'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notifications</span>
          {officerNotifications.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[9px] font-mono w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {officerNotifications.length}
            </span>
          )}
        </button>
      </div>

      {/* 📈 ANALYTICS SECTION */}
      <AnimatePresence mode="wait">
        {activeSubTab === 'analytics' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Analytics Specific Stats Card Group */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Assigned</span>
                  <span className="text-xl font-extrabold text-slate-900 font-mono">{stats.myAssigned} Cases</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resolved Today</span>
                  <span className="text-xl font-extrabold text-emerald-600 font-mono">{stats.resolvedToday} Fixed</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Issues</span>
                  <span className="text-xl font-extrabold text-orange-600 font-mono">{stats.total - stats.resolved} Open</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg. SLA Speed</span>
                  <span className="text-xl font-extrabold text-sky-600 font-mono">{stats.avgResolutionTime}</span>
                </div>
              </div>
            </div>

            {/* Recharts Graphs */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Chart 1: Status Distribution */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="font-display font-extrabold text-sm text-slate-900">City Grievance Status Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartsData.statusCounts}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartsData.statusCounts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Grievances`, 'Count']} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Department Load */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="font-display font-extrabold text-sm text-slate-900">Department Caseload & Resolution Rates</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartsData.deptData}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Active" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔔 NOTIFICATIONS SECTION */}
      <AnimatePresence mode="wait">
        {activeSubTab === 'notifications' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <Bell className="w-4 h-4" />
              </span>
              <h3 className="font-display font-bold text-sm text-slate-800">Officer Administrative Alerts</h3>
            </div>

            {officerNotifications.length === 0 ? (
              <div className="py-12 text-center max-w-sm mx-auto space-y-2">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700">No active notices</h4>
                <p className="text-[11px] text-slate-400">All citizens updated. You are fully synchronized with the Swachh Bharat circle.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {officerNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-start gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <span className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                      notif.type === 'alert' ? 'bg-rose-50 text-rose-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {notif.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                       notif.type === 'alert' ? <AlertTriangle className="w-4 h-4" /> :
                       <Clock className="w-4 h-4" />}
                    </span>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-900">{notif.title}</h4>
                        <span className="text-[9px] font-mono font-medium text-slate-400">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📊 OVERVIEW, MY ASSIGNED, & CRITICAL ISSUES VIEWS */}
      {activeSubTab !== 'analytics' && activeSubTab !== 'notifications' && (
        <div className="space-y-6">
          
          {/* 📊 METRICS SUMMARY SECTION */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 border border-slate-100">
                <Inbox className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">City Total</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">{stats.total} Issues</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100">
                <AlertTriangle className="w-4.5 h-4.5 animate-pulse" />
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">New Reported</span>
                <span className="text-base font-extrabold text-slate-900 font-mono text-orange-600">{stats.reported} Cases</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                <Clock className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">In Progress</span>
                <span className="text-base font-extrabold text-slate-900 font-mono text-sky-600">{stats.inProgress} Active</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <RefreshCw className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Reopened</span>
                <span className="text-base font-extrabold text-slate-900 font-mono text-rose-600">{stats.reopened} Flagged</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-3 col-span-2 lg:col-span-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Resolved/Verified</span>
                <span className="text-base font-extrabold text-slate-900 font-mono text-emerald-600">{stats.resolved} Done</span>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            {/* Sidebar filter controls */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="font-display font-extrabold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Desk Queue Filters</h3>
                
                {/* Resolution Status Group */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status Filter</label>
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="w-full border border-slate-150 px-3 py-2 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-600 focus:outline-none"
                  >
                    <option value="All">All Resolution States</option>
                    <option value="Reported">Reported</option>
                    <option value="In-Progress">In-Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Verified">Verified</option>
                    <option value="Reopened">Reopened</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Civil Department</label>
                  <select
                    value={categoryFilter}
                    onChange={(e: any) => setCategoryFilter(e.target.value)}
                    className="w-full border border-slate-150 px-3 py-2 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-600 focus:outline-none"
                  >
                    <option value="All">All Departments</option>
                    <option value="Roads & Traffic">Roads & Traffic</option>
                    <option value="Solid Waste Management">Solid Waste Management</option>
                    <option value="Water & Sanitation">Water & Sanitation</option>
                    <option value="Electricity & Illumination">Electricity & Illumination</option>
                  </select>
                </div>
              </div>

              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200/20 text-[11px] text-slate-500 leading-relaxed space-y-2">
                <span className="font-extrabold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> Administrative Duty
                </span>
                <p>
                  Perform site inspections, acknowledge pending grievances to lock SLA timings, and attach completion reports containing live field remarks.
                </p>
              </div>
            </div>

            {/* Core Grievance Queue list */}
            <div className="lg:col-span-9 space-y-4">
              
              {/* Search text field */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search city queue by complaint keywords, street location, or ward name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 rounded-2xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-600 transition-all"
                />
              </div>

              {/* List queue */}
              {filteredReports.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/60 max-w-lg mx-auto space-y-4">
                  <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
                  <div>
                    <h4 className="font-display font-extrabold text-sm text-slate-800">No matching issues in city queue</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Everything clean! Try expanding your filters or search query parameters.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {filteredReports.map(report => {
                    const isMyDept = report.category.toLowerCase().includes(officerDept.toLowerCase().split(' ')[0]);
                    const isMyWard = report.location.address.toLowerCase().includes(officerWard.toLowerCase().split(' ')[0]);
                    const isAssignedToMe = report.assignedToOfficerId === user.uid;

                    return (
                      <div
                        key={report.id}
                        className={`bg-white rounded-2xl border shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:-translate-y-0.5 ${
                          isAssignedToMe ? 'border-amber-500/40' : 'border-slate-200/60'
                        }`}
                      >
                        <div className="p-5 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${
                              report.severity.toUpperCase() === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                              (report.severity.toUpperCase() === 'SEVERE' || report.severity.toUpperCase() === 'HIGH') ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>{report.severity} Priority</span>

                            <span className={`text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-md uppercase ${
                              report.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' :
                              report.status === 'Verified' ? 'bg-emerald-150 text-emerald-900 bg-emerald-50 border border-emerald-400/20' :
                              report.status === 'In-Progress' ? 'bg-sky-100 text-sky-800 animate-pulse' :
                              report.status === 'Reopened' ? 'bg-rose-100 text-rose-800' :
                              'bg-slate-100 text-slate-600'
                            }`}>{report.status}</span>
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-display font-bold text-sm text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-1">
                              {report.title}
                            </h4>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold font-mono leading-tight">
                              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="line-clamp-1">{report.location.address}</span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {report.description}
                          </p>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="bg-slate-100 text-slate-600 text-[9px] px-2 py-0.5 rounded font-bold font-mono">
                              {report.category}
                            </span>
                            {isAssignedToMe && (
                              <span className="bg-amber-500 text-white text-[9px] px-2 py-0.5 rounded font-bold">
                                Assigned to Me
                              </span>
                            )}
                            {report.assignedToOfficerId && !isAssignedToMe && (
                              <span className="bg-slate-100 text-slate-500 text-[9px] px-2 py-0.5 rounded font-bold">
                                Assigned: {report.assignedToOfficerName}
                              </span>
                            )}
                            {isMyDept && !report.assignedToOfficerId && (
                              <span className="bg-emerald-50 text-emerald-800 text-[9px] px-2 py-0.5 rounded font-bold border border-emerald-200/20">
                                My Department Queue
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Officer Quick Actions Row */}
                        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100/80 flex items-center justify-between gap-2">
                          <button
                            onClick={() => setInspectingReport(report)}
                            className="text-[10px] font-bold text-amber-700 hover:text-amber-900 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                            <span>Action Center</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {/* Accept / Assign Option */}
                            {!report.assignedToOfficerId && (
                              <button
                                onClick={() => handleAcceptComplaint(report)}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[9px] px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <UserPlus className="w-3 h-3" />
                                <span>Accept Case</span>
                              </button>
                            )}

                            {/* In Progress option */}
                            {isAssignedToMe && report.status !== 'In-Progress' && report.status !== 'Resolved' && report.status !== 'Verified' && (
                              <button
                                onClick={() => handleMarkInProgress(report)}
                                className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-[9px] px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Clock className="w-3 h-3" />
                                <span>In-Progress</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 👮 DETAILED OFFICER OVERLAY ACTION CENTER MODAL */}
      <AnimatePresence>
        {inspectingReport && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-[2000] overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100"
            >
              {/* Header block */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <Shield className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-slate-900">Officer Investigation Desk</h3>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {inspectingReport.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setInspectingReport(null);
                    setCompletionImage(null);
                    setCompletionImageName('');
                    setResolutionRemarks('');
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Details Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase">{inspectingReport.severity} Priority</span>
                    <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase">{inspectingReport.status}</span>
                  </div>
                  <h4 className="font-display font-bold text-lg text-slate-900">{inspectingReport.title}</h4>
                  <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                    <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{inspectingReport.location.address}</span>
                  </div>
                  <p className="text-xs text-slate-650 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">{inspectingReport.description}</p>
                </div>

                {/* Assignment Status Summary */}
                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Case Officer</span>
                    <span className="text-xs font-bold text-slate-700">
                      {inspectingReport.assignedToOfficerId ? inspectingReport.assignedToOfficerName : 'Unassigned/Open City Queue'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {!inspectingReport.assignedToOfficerId && (
                      <button
                        disabled={isSaving}
                        onClick={() => handleAcceptComplaint(inspectingReport)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Accept & Assign to Me</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Workflow Logs / Reassignment History */}
                {inspectingReport.reassignedHistory && inspectingReport.reassignedHistory.length > 0 && (
                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <History className="w-3.5 h-3.5" /> File Routing History
                    </span>
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2 max-h-32 overflow-y-auto">
                      {inspectingReport.reassignedHistory.map((log, idx) => (
                        <div key={idx} className="text-[10px] text-slate-500 flex gap-2">
                          <span className="text-amber-600">✦</span>
                          <span className="font-medium leading-normal">{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolution Form (Only if Assigned to the Officer) */}
                {inspectingReport.assignedToOfficerId === user.uid && (
                  <div className="space-y-6 pt-2 border-t border-slate-100">
                    <div className="space-y-2">
                      <h5 className="font-display font-extrabold text-sm text-slate-800">Resolution & SLA Remediation</h5>
                      <p className="text-[10px] text-slate-400">Complete this section to mark the grievance resolved and upload verified physical repairs.</p>
                    </div>

                    {/* Completion Image Upload Area */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Verified Completion Image (SLA Evidence)</label>
                      
                      {completionImage ? (
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-44 group">
                          <img src={completionImage} alt="Completion Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => {
                                setCompletionImage(null);
                                setCompletionImageName('');
                              }}
                              className="p-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors shadow-lg cursor-pointer"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                          <span className="absolute bottom-2 left-2 bg-emerald-600/90 text-white text-[8px] font-bold px-2 py-0.5 rounded font-mono">
                            {completionImageName || 'COMPLETED_EVIDENCE.JPG'}
                          </span>
                        </div>
                      ) : (
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                            isDragging
                              ? 'border-amber-600 bg-amber-50/20 scale-[0.99]'
                              : 'border-slate-200 hover:border-amber-600/55 hover:bg-slate-50/50'
                          }`}
                        >
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                          />
                          <Upload className="w-8 h-8 text-slate-400 animate-bounce" style={{ animationDuration: '3s' }} />
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">Drag & drop remediation photo</span>
                            <span className="text-[10px] text-slate-400">or click to browse local files</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Resolution Remarks */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Remediation Remarks & Actions Taken</label>
                      <textarea
                        value={resolutionRemarks}
                        onChange={(e) => setResolutionRemarks(e.target.value)}
                        placeholder="Detail the materials used, ward crew assigned, and resolution steps completed. e.g. Patched 3 potholes with rapid cold bituminous mixture..."
                        rows={3}
                        className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-600 focus:outline-none focus:border-amber-600"
                      />
                    </div>

                    {/* Commit Action buttons */}
                    <div className="flex gap-2.5 pt-2">
                      {inspectingReport.status !== 'In-Progress' && (
                        <button
                          disabled={isSaving}
                          onClick={() => handleMarkInProgress(inspectingReport)}
                          className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSaving ? 'Processing...' : 'Transition to In-Progress'}
                        </button>
                      )}
                      <button
                        disabled={isSaving}
                        onClick={() => handleMarkResolved(inspectingReport)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-emerald-600/10 cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Mark Grievance Resolved'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Reassignment / File Transfer Control (Only if assigned to you or in your Dept queue) */}
                {(inspectingReport.assignedToOfficerId === user.uid || 
                 (!inspectingReport.assignedToOfficerId && inspectingReport.category.toLowerCase().includes(officerDept.toLowerCase().split(' ')[0]))) && (
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <div className="space-y-1.5">
                      <h5 className="font-display font-extrabold text-sm text-slate-800 flex items-center gap-1">
                        <Share2 className="w-4 h-4 text-amber-600" /> Administrative Reassignment
                      </h5>
                      <p className="text-[10px] text-slate-400">If this grievance belongs to another circle, transfer the file to the appropriate specialized department.</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Target Department</label>
                        <select
                          value={targetDepartment}
                          onChange={(e) => setTargetDepartment(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-600"
                        >
                          <option value="Roads & Traffic">Roads & Traffic</option>
                          <option value="Solid Waste Management">Solid Waste Management</option>
                          <option value="Water & Sanitation">Water & Sanitation</option>
                          <option value="Electricity & Illumination">Electricity & Illumination</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Reassignment Remarks</label>
                        <input
                          type="text"
                          value={reassignmentRemarks}
                          onChange={(e) => setReassignmentRemarks(e.target.value)}
                          placeholder="Provide reasoning for transfer e.g. Pothole caused by water main leak..."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-600"
                        />
                      </div>
                    </div>

                    <button
                      disabled={isSaving}
                      onClick={() => handleReassignComplaint(inspectingReport)}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Reassign Grievance Folder</span>
                    </button>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
