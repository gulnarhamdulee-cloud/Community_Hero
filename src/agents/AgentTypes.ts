import { AgentContext } from './AgentContext';

export interface ComplaintDraft {
  subject: string;
  complaintDraftEnglish: string;
  complaintDraftHindi: string;
  rtiEscalationDraft?: string;
  citizenSummary?: string;
}

export interface CivicAdvisory {
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

export interface RiskPrediction {
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

export interface HeatmapData {
  geohashSector: string;
  hazardClusterDensity: 'Low' | 'Medium' | 'High';
  cityHotspotRank: number;
  nearbyRiskMarkers: string[];
  wardRiskIndex?: number;
  hotspotScore?: number;
  densityCluster?: 'Low' | 'Medium' | 'High';
}

export interface CivicAgent {
  name: string;
  execute(context: AgentContext): Promise<AgentContext>;
}
