import { CivicLocation } from '../types';
import { ComplaintDraft, CivicAdvisory, RiskPrediction, HeatmapData } from './AgentTypes';

export interface AgentContext {
  // Input fields
  image?: string; // base64 representation of uploaded image
  description: string; // User description of the civic issue
  location: CivicLocation; // Detected or input location info

  // Processed agent states
  detectedIssue?: string; // Analysis of the issue by the Vision agent (e.g. Pothole, Garbage Dump, etc.)
  confidence?: number; // Vision confidence score
  detectedObjects?: string[]; // Detected physical items/objects
  summary?: string; // Summary description of the issue
  category?: string; // Classifed general category (e.g., Roads, Sanitation)
  subCategory?: string; // Classified specific subcategory
  municipalDepartment?: string; // Responsible municipal department
  complaintType?: string; // Identified complaint type
  severity?: string; // Determined severity (e.g., LOW, MEDIUM, HIGH, CRITICAL)
  priorityScore?: number; // Numeric priority score
  riskFactors?: string[]; // Array of risk factors
  estimatedResponseTime?: string; // Estimated response time
  publicSafetyImpact?: string; // Public safety impact description
  department?: string; // Routed municipality department
  municipalCorporation?: string; // Municipal Corporation (e.g., BMC, BBMP, MCD)
  wardOffice?: string; // Determined ward office or zone
  responsibleDepartment?: string; // Specific administrative department
  escalationAuthority?: string; // Escalation officer/authority
  sla?: string; // SLA string (e.g. "24 hours", "3 days")

  // Output drafts and projections
  complaintDraft?: ComplaintDraft;
  advisory?: CivicAdvisory;
  riskPrediction?: RiskPrediction;
  heatmapData?: HeatmapData;

  // Running log of agent actions
  executionLog: string[];

  // Extensibility bucket for future agents
  metadata?: Record<string, any>;
}
