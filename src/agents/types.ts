export type AgentStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

export interface VisionAgentOutput {
  imageAnalyzed: boolean;
  objectsDetected: string[];
  visualSceneDescription: string;
}

export interface ClassificationAgentOutput {
  category: string;
  subCategory: string;
  tags: string[];
  municipalDepartment?: string;
  complaintType?: string;
}

export interface SeverityAgentOutput {
  severityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'Low' | 'Moderate' | 'Severe' | 'Critical';
  justification: string;
  impactFactors: string[];
  priorityScore?: number;
  riskFactors?: string[];
  estimatedResponseTime?: string;
  publicSafetyImpact?: string;
}

export interface RoutingAgentOutput {
  department: string;
  wardInfo: string;
  escalationContact: string;
  municipalCorporation?: string;
  wardOffice?: string;
  responsibleDepartment?: string;
  escalationAuthority?: string;
  sla?: string;
}

export interface DraftingAgentOutput {
  subject: string;
  complaintDraftEnglish: string;
  complaintDraftHindi: string;
  rtiEscalationDraft?: string;
  citizenSummary?: string;
}

export interface RiskPredictionAgentOutput {
  infrastructureRiskScore: number; // 0-100
  publicHealthHazards: string[];
  legalLiabilityScore: number; // 0-100
  proactiveMitigationAdvice: string;
  futureRisk?: string;
  possibleConsequences?: string[];
  urgencyLevel?: string;
  recommendations?: string[];
  communityImpact?: string;
}

export interface AdvisoryAgentOutput {
  citizenRightsSummary: string;
  applicableActsAndBylaws: string[];
  safetyDoAndDonts: {
    dos: string[];
    donts: string[];
  };
  escalationProcedures?: string[];
  expectedTimelines?: string;
  recommendations?: string[];
}

export interface HeatmapAgentOutput {
  geohashSector: string;
  hazardClusterDensity: 'Low' | 'Medium' | 'High';
  cityHotspotRank: number;
  nearbyRiskMarkers: string[];
  wardRiskIndex?: number;
  hotspotScore?: number;
  densityCluster?: 'Low' | 'Medium' | 'High';
}

export interface CivicWorkflowState {
  id: string; // Firestore document ID
  userId: string;
  userName: string;
  userEmail: string;
  userDescription: string;
  city: string;
  address?: string;
  imageUrl?: string; // base64 or HTTPS URL
  createdAt: string;
  updatedAt: string;

  // Agent statuses
  agentStatuses: {
    VisionAgent: AgentStatus;
    ClassificationAgent: AgentStatus;
    SeverityAgent: AgentStatus;
    RoutingAgent: AgentStatus;
    DraftingAgent: AgentStatus;
    RiskPredictionAgent: AgentStatus;
    AdvisoryAgent: AgentStatus;
    HeatmapAgent: AgentStatus;
  };

  // Agent error messages (if failed)
  agentErrors: {
    VisionAgent?: string;
    ClassificationAgent?: string;
    SeverityAgent?: string;
    RoutingAgent?: string;
    DraftingAgent?: string;
    RiskPredictionAgent?: string;
    AdvisoryAgent?: string;
    HeatmapAgent?: string;
  };

  // Agent Outputs
  vision?: VisionAgentOutput;
  classification?: ClassificationAgentOutput;
  severity?: SeverityAgentOutput;
  routing?: RoutingAgentOutput;
  drafting?: DraftingAgentOutput;
  riskPrediction?: RiskPredictionAgentOutput;
  advisory?: AdvisoryAgentOutput;
  heatmap?: HeatmapAgentOutput;
  agentContext?: any;
  logs?: string[];
}

import { CivicAgent } from './AgentTypes';
export type { CivicAgent };

