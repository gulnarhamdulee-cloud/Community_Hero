import React from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { LoginView } from './LoginView';
import { UserRole } from '../../types';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, role, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center max-w-sm text-center">
          {/* Indian Tricolor Pulse Spinner */}
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-pulse"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-amber-600 border-r-transparent border-b-emerald-600 border-l-transparent animate-spin"></div>
            <div className="absolute inset-3 rounded-full bg-slate-50 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-800 animate-ping"></div>
            </div>
          </div>
          <h2 className="font-display font-medium text-lg text-slate-900 tracking-tight">Community Hero of India</h2>
          <p className="text-xs text-slate-500 mt-2 font-mono tracking-widest uppercase">Syncing National Grievance Portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  // Check if role is allowed
  if (allowedRoles && role !== undefined && role !== null && !allowedRoles.includes(role)) {
    const requiredRoleName = allowedRoles.map(r => r === UserRole.MUNICIPAL_OFFICER ? "Municipal Officer" : "Citizen").join(" or ");
    const currentRoleName = role === UserRole.MUNICIPAL_OFFICER ? "Municipal Officer" : "Citizen";
    
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-amber-900/10 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center border border-amber-200">
            <AlertTriangle className="w-8 h-8 text-amber-600 animate-bounce" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              This terminal is restricted to <span className="font-semibold text-slate-700">{requiredRoleName}</span> portals only. 
              You are currently logged in as a <span className="font-semibold text-emerald-700">{currentRoleName}</span>.
            </p>
          </div>
          
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry / Refresh</span>
            </button>
            <button
              onClick={() => logout()}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out to Switch Accounts</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
