import { collection, addDoc, query, where, orderBy, onSnapshot, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { StatusHistory, Report } from '../types';

/**
 * Creates a new status history entry in Firestore.
 */
export async function addStatusHistoryEntry(entry: Omit<StatusHistory, 'id'>) {
  try {
    const docRef = await addDoc(collection(db, 'statusHistory'), {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error writing status history entry:", error);
    return null;
  }
}

/**
 * Subscribes to status history of a specific issue in real-time.
 */
export function subscribeStatusHistory(issueId: string, callback: (history: StatusHistory[]) => void) {
  const q = query(
    collection(db, 'statusHistory'),
    where('issueId', '==', issueId),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const history: StatusHistory[] = [];
    snapshot.forEach((doc) => {
      history.push({ id: doc.id, ...doc.data() } as StatusHistory);
    });
    callback(history);
  });
}

/**
 * Updates a report's status and automatically logs the status transition in the history collection.
 */
export async function updateReportStatusWithHistory(
  reportId: string,
  previousStatus: string,
  currentStatus: string,
  updatedBy: string,
  remarks: string,
  additionalReportFields: Partial<Report> = {}
) {
  try {
    // 1. Log transition
    await addStatusHistoryEntry({
      issueId: reportId,
      previousStatus,
      currentStatus,
      updatedBy,
      timestamp: new Date().toISOString(),
      remarks: remarks || `Transitioned status from ${previousStatus} to ${currentStatus}`
    });

    // 2. Update report document in Firestore
    const reportDocRef = doc(db, 'reports', reportId);
    await updateDoc(reportDocRef, {
      status: currentStatus,
      ...additionalReportFields
    });
  } catch (error) {
    console.error("Failed to update report status with history:", error);
    throw error;
  }
}

/**
 * Returns consistent Tailwind CSS classes and human-friendly labels for any issue status.
 */
export function getStatusStyle(status: string) {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'SUBMITTED':
    case 'REPORTED':
      return { bg: 'bg-blue-50 text-blue-700 border border-blue-200/50', dot: 'bg-blue-500', label: 'Submitted' };
    case 'AI_ANALYZING':
    case 'IN-REVIEW':
      return { bg: 'bg-purple-50 text-purple-700 border border-purple-200/50', dot: 'bg-purple-500', label: 'AI Analyzing' };
    case 'ASSIGNED':
      return { bg: 'bg-indigo-50 text-indigo-700 border border-indigo-200/50', dot: 'bg-indigo-500', label: 'Assigned' };
    case 'ACCEPTED':
      return { bg: 'bg-cyan-50 text-cyan-700 border border-cyan-200/50', dot: 'bg-cyan-500', label: 'Accepted' };
    case 'IN_PROGRESS':
    case 'IN-PROGRESS':
      return { bg: 'bg-amber-50 text-amber-700 border border-amber-200/50 animate-pulse', dot: 'bg-amber-500', label: 'In Progress' };
    case 'RESOLVED':
      return { bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50', dot: 'bg-emerald-500', label: 'Resolved' };
    case 'VERIFICATION_PENDING':
      return { bg: 'bg-amber-50 text-amber-800 border border-amber-300/40 animate-pulse', dot: 'bg-amber-500', label: 'Verification Pending' };
    case 'CLOSED':
    case 'VERIFIED':
      return { bg: 'bg-emerald-100 text-emerald-800 border border-emerald-300/50', dot: 'bg-emerald-600', label: 'Closed' };
    case 'REOPENED':
      return { bg: 'bg-rose-50 text-rose-700 border border-rose-200/50', dot: 'bg-rose-500', label: 'Reopened' };
    default:
      return { bg: 'bg-slate-50 text-slate-700 border border-slate-200/50', dot: 'bg-slate-500', label: status };
  }
}
