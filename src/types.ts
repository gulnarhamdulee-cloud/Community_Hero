export interface CivicLocation {
  lat: number;
  lng: number;
  city: string;
  address: string;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  subCategory: string;
  severity: 'Low' | 'Moderate' | 'Severe' | 'Critical';
  severityJustification: string;
  suggestedDepartment: string;
  status: 'Reported' | 'In-Review' | 'In-Progress' | 'Resolved' | 'Verified' | 'Reopened' | 'SUBMITTED' | 'AI_ANALYZING' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'RESOLVED' | 'VERIFICATION_PENDING' | 'CLOSED' | 'REOPENED';
  location: CivicLocation;
  imageUrl?: string;
  complaintDraftEnglish: string;
  complaintDraftHindi: string;
  rtiEscalationDraft?: string;
  citizenSummary?: string;
  civicAdvice: string;
  upvotesCount: number;
  upvotesUsers: string[];
  createdAt: string;
  userId: string;
  userEmail: string;
  userName: string;
  resolvedAt: string | null;
  assignedToOfficerId?: string;
  assignedToOfficerName?: string;
  estimatedResolutionTime?: string;
  completionImageUrl?: string;
  officerRemarks?: string;
  reassignedHistory?: string[];
  workflowId?: string;
  workflowState?: any;
  agentContext?: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  createdAt?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  createdAt: string;
}

export interface IndianCity {
  name: string;
  state: string;
  center: [number, number];
  municipalBody: string;
}

export const INDIAN_CITIES: IndianCity[] = [
  { name: "Mumbai", state: "Maharashtra", center: [19.0760, 72.8777], municipalBody: "Brihanmumbai Municipal Corporation (BMC)" },
  { name: "Bengaluru", state: "Karnataka", center: [12.9716, 77.5946], municipalBody: "Bruhat Bengaluru Mahanagara Palike (BBMP)" },
  { name: "Delhi", state: "Delhi NCR", center: [28.6139, 77.2090], municipalBody: "Municipal Corporation of Delhi (MCD)" },
  { name: "Pune", state: "Maharashtra", center: [18.5204, 73.8567], municipalBody: "Pune Municipal Corporation (PMC)" },
  { name: "Hyderabad", state: "Telangana", center: [17.3850, 78.4867], municipalBody: "Greater Hyderabad Municipal Corporation (GHMC)" },
  { name: "Chennai", state: "Tamil Nadu", center: [13.0827, 80.2707], municipalBody: "Greater Chennai Corporation (GCC)" },
  { name: "Kolkata", state: "West Bengal", center: [22.5726, 88.3639], municipalBody: "Kolkata Municipal Corporation (KMC)" },
  { name: "Ahmedabad", state: "Gujarat", center: [23.0225, 72.5714], municipalBody: "Ahmedabad Municipal Corporation (AMC)" }
];

export enum UserRole {
  CITIZEN,
  MUNICIPAL_OFFICER
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: UserRole;
  city: string;
  ward?: string;
  points: number;
  badges: string[];
  reportsSubmitted: number;
  reportsVerified: number;
  createdAt: string;
  lastLogin: string;
  isGuest?: boolean;
}

export interface OfficerProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  city: string;
  ward: string;
  designation: string;
  active: boolean;
  createdAt: string;
}

export interface StatusHistory {
  id?: string;
  issueId: string;
  previousStatus: string;
  currentStatus: string;
  updatedBy: string;
  timestamp: string;
  remarks: string;
}

