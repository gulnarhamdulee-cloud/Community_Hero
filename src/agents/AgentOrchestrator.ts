import { CivicWorkflowState, AgentStatus } from './types';
import { CivicAgent } from './AgentTypes';
import { AgentContext } from './AgentContext';
import { VisionAgent } from './VisionAgent';
import { ClassificationAgent } from './ClassificationAgent';
import { SeverityAgent } from './SeverityAgent';
import { RoutingAgent } from './RoutingAgent';
import { DraftingAgent } from './DraftingAgent';
import { RiskPredictionAgent } from './RiskPredictionAgent';
import { AdvisoryAgent } from './AdvisoryAgent';
import { HeatmapAgent } from './HeatmapAgent';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export class AgentOrchestrator {
  private agents: CivicAgent[] = [];

  constructor() {
    // Register the 8 core civic agents sequentially
    this.agents = [
      new VisionAgent(),
      new ClassificationAgent(),
      new SeverityAgent(),
      new RoutingAgent(),
      new DraftingAgent(),
      new RiskPredictionAgent(),
      new AdvisoryAgent(),
      new HeatmapAgent()
    ];
  }

  /**
   * Registers a new agent into the pipeline.
   * This makes the orchestrator architecture completely extensible for future agents.
   */
  public registerAgent(agent: CivicAgent): void {
    this.agents.push(agent);
  }

  /**
   * General purpose multi-agent sequential executor.
   * Runs all registered agents sequentially and handles non-critical failures gracefully.
   * Logs agent names, start times, completion times, durations, and statuses inside context.executionLog.
   */
  public async execute(initialContext: AgentContext): Promise<AgentContext> {
    let context = { ...initialContext };
    context.executionLog = context.executionLog || [];

    context.executionLog.push(
      `⚙️ [ORCHESTRATOR] Beginning sequential execution of ${this.agents.length} agents...`
    );

    for (const agent of this.agents) {
      const startTime = new Date();
      context.executionLog.push(
        `🚀 [ORCHESTRATOR] Agent "${agent.name}" - Started at ${startTime.toISOString()}`
      );

      try {
        context = await agent.execute(context);
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        context.executionLog.push(
          `✅ [ORCHESTRATOR] Agent "${agent.name}" - Completed at ${endTime.toISOString()} | Duration: ${duration}ms | Status: Success`
        );
      } catch (err: any) {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        const errMsg = err.message || 'Unknown error.';
        const critical = this.isCritical(agent.name);

        context.executionLog.push(
          `${critical ? '🚨' : '⚠️'} [ORCHESTRATOR] Agent "${agent.name}" - Failed at ${endTime.toISOString()} | Duration: ${duration}ms | Status: Failed | Error: ${errMsg}`
        );

        if (critical) {
          context.executionLog.push(
            `🛑 [ORCHESTRATOR] Halting execution pipeline due to failure in critical agent "${agent.name}".`
          );
          throw err;
        } else {
          context.executionLog.push(
            `ℹ️ [ORCHESTRATOR] Continuing execution because "${agent.name}" is a non-critical agent.`
          );
        }
      }
    }

    context.executionLog.push(
      `🏁 [ORCHESTRATOR] Sequential execution pipeline completed successfully.`
    );

    return context;
  }

  /**
   * Helper to determine if an agent is critical to the core report compilation.
   */
  private isCritical(agentName: string): boolean {
    const nonCritical = [
      'Risk Prediction Agent',
      'Civic Advisory Agent',
      'Heatmap Intelligence Agent'
    ];
    return !nonCritical.includes(agentName);
  }

  /**
   * Main orchestrator execution method.
   * Runs all registered agents sequentially and passes the updated context to the next agent.
   */
  async executeWorkflow(
    initialState: Omit<CivicWorkflowState, 'agentStatuses' | 'agentErrors'> | CivicWorkflowState,
    onStateUpdate: (state: CivicWorkflowState) => void,
    isResuming = false
  ): Promise<CivicWorkflowState> {
    const workflowState: CivicWorkflowState = isResuming
      ? { ...(initialState as CivicWorkflowState) }
      : {
          ...initialState,
          agentStatuses: {
            VisionAgent: 'Pending',
            ClassificationAgent: 'Pending',
            SeverityAgent: 'Pending',
            RoutingAgent: 'Pending',
            DraftingAgent: 'Pending',
            RiskPredictionAgent: 'Pending',
            AdvisoryAgent: 'Pending',
            HeatmapAgent: 'Pending',
          },
          agentErrors: {},
        };

    let context: AgentContext = isResuming
      ? this.reconstructContext(workflowState)
      : {
          image: workflowState.imageUrl,
          description: workflowState.userDescription,
          location: {
            city: workflowState.city,
            address: workflowState.address || '',
            lat: 0,
            lng: 0
          },
          executionLog: [
            `⚙️ [ORCHESTRATOR] Initializing Multi-Agent Civic Pipeline...`,
            `⚙️ [ORCHESTRATOR] Registered pipeline containing ${this.agents.length} agents sequentially.`
          ],
          metadata: {
            workflowId: workflowState.id
          }
        };

    // If resuming, restore the previous logs list
    if (isResuming && workflowState.logs) {
      context.executionLog = [...workflowState.logs];
      context.executionLog.push(`⚙️ [RECOVERY] Resuming execution pipeline from saved state...`);
    }

    // Save initial state
    workflowState.logs = context.executionLog;
    await this.persistState(workflowState);
    onStateUpdate({ ...workflowState });

    // Execute registered agents sequentially
    for (const agent of this.agents) {
      // Find matching key for the agent UI tracking
      const agentId = this.getAgentId(agent.name);
      if (!agentId) continue;

      // Skip already completed agents if resuming
      if (isResuming && workflowState.agentStatuses[agentId] === 'Completed') {
        context.executionLog.push(`ℹ️ [RECOVERY] Agent "${agent.name}" already completed. Restoring state...`);
        workflowState.logs = context.executionLog;
        await this.persistState(workflowState);
        onStateUpdate({ ...workflowState });
        continue;
      }

      workflowState.agentStatuses[agentId] = 'Running';
      workflowState.updatedAt = new Date().toISOString();
      workflowState.logs = context.executionLog;
      await this.persistState(workflowState);
      onStateUpdate({ ...workflowState });

      // Persist Running state to agentExecutions
      await this.persistAgentExecution(
        workflowState.id,
        agent.name,
        'Running',
        0,
        `Agent ${agent.name} is running...`
      );

      const startTime = new Date();
      try {
        // Execute current agent, passing context and retrieving the updated context
        context = await agent.execute(context);
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        context.executionLog.push(
          `✅ [ORCHESTRATOR] Agent "${agent.name}" - Completed at ${endTime.toISOString()} | Duration: ${duration}ms | Status: Success`
        );

        // Map updated context back to the workflowState for UI rendering
        workflowState.agentStatuses[agentId] = 'Completed';
        this.mapContextToWorkflowState(context, workflowState, agentId);

        workflowState.updatedAt = new Date().toISOString();
        workflowState.logs = context.executionLog;
        await this.persistState(workflowState);
        onStateUpdate({ ...workflowState });

        // Persist completed state to agentExecutions
        await this.persistAgentExecution(
          workflowState.id,
          agent.name,
          'Completed',
          duration,
          this.getAgentSummary(agentId, context)
        );

      } catch (err: any) {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        const errMsg = err.message || 'Unknown execution error.';
        console.error(`[Orchestrator] Agent ${agent.name} failed:`, err);

        const critical = this.isCritical(agent.name);
        context.executionLog.push(
          `${critical ? '🚨' : '⚠️'} [ORCHESTRATOR] Agent "${agent.name}" - Failed at ${endTime.toISOString()} | Duration: ${duration}ms | Status: Failed | Error: ${errMsg}`
        );

        workflowState.agentStatuses[agentId] = 'Failed';
        workflowState.agentErrors[agentId] = errMsg;

        workflowState.updatedAt = new Date().toISOString();
        workflowState.logs = context.executionLog;
        await this.persistState(workflowState);
        onStateUpdate({ ...workflowState });

        // Persist Failed state to agentExecutions
        await this.persistAgentExecution(
          workflowState.id,
          agent.name,
          'Failed',
          duration,
          errMsg
        );

        // Halt sequential pipeline only if an essential agent fails
        if (critical) {
          throw err;
        } else {
          context.executionLog.push(
            `ℹ️ [ORCHESTRATOR] Continuing workflow because "${agent.name}" is a non-critical agent.`
          );
        }
      }
    }

    // Pipeline completed! Store final AgentContext in the workflowState
    workflowState.agentContext = context;
    workflowState.updatedAt = new Date().toISOString();
    workflowState.logs = context.executionLog;
    await this.persistState(workflowState);
    onStateUpdate({ ...workflowState });

    return workflowState;
  }

  /**
   * Helper to map a clean AgentContext property back to the UI-compatible CivicWorkflowState properties
   */
  private mapContextToWorkflowState(context: AgentContext, state: CivicWorkflowState, agentId: string): void {
    if (agentId === 'VisionAgent' && context.detectedIssue) {
      state.vision = {
        imageAnalyzed: !!context.image,
        objectsDetected: context.detectedObjects || context.metadata?.detectedObjects || [],
        visualSceneDescription: context.summary || context.detectedIssue
      };
    } else if (agentId === 'ClassificationAgent' && context.category) {
      state.classification = {
        category: context.category,
        subCategory: context.subCategory || context.metadata?.subCategory || 'General Civic Issue',
        tags: context.metadata?.taxonomyTags || [],
        municipalDepartment: context.municipalDepartment || context.metadata?.municipalDepartment,
        complaintType: context.complaintType || context.metadata?.complaintType
      };
    } else if (agentId === 'SeverityAgent' && context.severity) {
      state.severity = {
        severityLevel: context.severity as any,
        justification: context.publicSafetyImpact || context.metadata?.severityJustification || '',
        impactFactors: context.riskFactors || context.metadata?.impactFactors || [],
        priorityScore: context.priorityScore || context.metadata?.priorityWeight,
        riskFactors: context.riskFactors,
        estimatedResponseTime: context.estimatedResponseTime,
        publicSafetyImpact: context.publicSafetyImpact
      };
    } else if (agentId === 'RoutingAgent' && context.department) {
      state.routing = {
        department: context.department,
        wardInfo: context.wardOffice || context.metadata?.wardInfo || '',
        escalationContact: context.metadata?.routingContact || '',
        municipalCorporation: context.municipalCorporation,
        wardOffice: context.wardOffice,
        responsibleDepartment: context.responsibleDepartment || context.department,
        escalationAuthority: context.escalationAuthority,
        sla: context.sla
      };
    } else if (agentId === 'DraftingAgent' && context.complaintDraft) {
      state.drafting = {
        subject: context.complaintDraft.subject,
        complaintDraftEnglish: context.complaintDraft.complaintDraftEnglish,
        complaintDraftHindi: context.complaintDraft.complaintDraftHindi,
        rtiEscalationDraft: context.complaintDraft.rtiEscalationDraft,
        citizenSummary: context.complaintDraft.citizenSummary
      };
    } else if (agentId === 'RiskPredictionAgent' && context.riskPrediction) {
      state.riskPrediction = {
        infrastructureRiskScore: context.riskPrediction.infrastructureRiskScore,
        publicHealthHazards: context.riskPrediction.publicHealthHazards,
        legalLiabilityScore: context.riskPrediction.legalLiabilityScore,
        proactiveMitigationAdvice: context.riskPrediction.proactiveMitigationAdvice,
        futureRisk: context.riskPrediction.futureRisk,
        possibleConsequences: context.riskPrediction.possibleConsequences,
        urgencyLevel: context.riskPrediction.urgencyLevel,
        recommendations: context.riskPrediction.recommendations,
        communityImpact: context.riskPrediction.communityImpact
      };
    } else if (agentId === 'AdvisoryAgent' && context.advisory) {
      state.advisory = {
        citizenRightsSummary: context.advisory.citizenRightsSummary,
        applicableActsAndBylaws: context.advisory.applicableActsAndBylaws,
        safetyDoAndDonts: context.advisory.safetyDoAndDonts,
        escalationProcedures: context.advisory.escalationProcedures,
        expectedTimelines: context.advisory.expectedTimelines,
        recommendations: context.advisory.recommendations
      };
    } else if (agentId === 'HeatmapAgent' && context.heatmapData) {
      state.heatmap = {
        geohashSector: context.heatmapData.geohashSector,
        hazardClusterDensity: context.heatmapData.hazardClusterDensity,
        cityHotspotRank: context.heatmapData.cityHotspotRank,
        nearbyRiskMarkers: context.heatmapData.nearbyRiskMarkers,
        wardRiskIndex: context.heatmapData.wardRiskIndex,
        hotspotScore: context.heatmapData.hotspotScore,
        densityCluster: context.heatmapData.densityCluster
      };
    }
  }

  /**
   * Resolves the agent key id string for the workflow state tracking
   */
  private getAgentId(agentName: string): keyof CivicWorkflowState['agentStatuses'] | null {
    switch (agentName) {
      case 'Vision Agent': return 'VisionAgent';
      case 'Classification Agent': return 'ClassificationAgent';
      case 'Severity Agent': return 'SeverityAgent';
      case 'Routing Agent': return 'RoutingAgent';
      case 'Drafting Agent': return 'DraftingAgent';
      case 'Risk Prediction Agent': return 'RiskPredictionAgent';
      case 'Civic Advisory Agent': return 'AdvisoryAgent';
      case 'Heatmap Intelligence Agent': return 'HeatmapAgent';
      default: return null;
    }
  }

  private getAgentSummary(agentId: string, context: AgentContext): string {
    switch (agentId) {
      case 'VisionAgent':
        return `Scene Description: ${context.detectedIssue || 'No visual description available'}. Objects: ${(context.detectedObjects || []).join(', ')}`;
      case 'ClassificationAgent':
        return `Category: ${context.category || 'N/A'}, Sub-category: ${context.subCategory || 'N/A'}`;
      case 'SeverityAgent':
        return `Severity: ${context.severity || 'N/A'}. Justification: ${context.publicSafetyImpact || 'N/A'}. Priority Score: ${context.priorityScore || 50}/100`;
      case 'RoutingAgent':
        return `Department: ${context.department || 'N/A'}, SLA: ${context.sla || 'N/A'}, Ward Office: ${context.wardOffice || 'N/A'}`;
      case 'DraftingAgent':
        return `Subject: ${context.complaintDraft?.subject || 'N/A'}. English Draft length: ${context.complaintDraft?.complaintDraftEnglish?.length || 0} chars.`;
      case 'RiskPredictionAgent':
        return `Infrastructure Risk: ${context.riskPrediction?.infrastructureRiskScore || 0}/100, Legal Liability: ${context.riskPrediction?.legalLiabilityScore || 0}/100`;
      case 'AdvisoryAgent':
        return `Acts & Bylaws: ${(context.advisory?.applicableActsAndBylaws || []).join(', ')}`;
      case 'HeatmapAgent':
        return `Geohash Sector: ${context.heatmapData?.geohashSector || 'N/A'}, Hotspot Rank: #${context.heatmapData?.cityHotspotRank || 0}`;
      default:
        return 'Execution completed successfully.';
    }
  }

  private async persistAgentExecution(
    reportId: string,
    agentName: string,
    status: 'Pending' | 'Running' | 'Completed' | 'Failed',
    executionTime: number,
    outputSummary: string
  ): Promise<void> {
    const sanitizedAgentName = agentName.replace(/\s+/g, '');
    const executionId = `${reportId}_${sanitizedAgentName}`;
    try {
      const docRef = doc(db, 'agentExecutions', executionId);
      await setDoc(docRef, {
        reportId,
        timestamp: new Date().toISOString(),
        agentName,
        status,
        executionTime,
        outputSummary
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `agentExecutions/${executionId}`);
    }
  }

  private reconstructContext(state: CivicWorkflowState): AgentContext {
    const context: AgentContext = {
      image: state.imageUrl,
      description: state.userDescription,
      location: {
        city: state.city,
        address: state.address || '',
        lat: 0,
        lng: 0
      },
      executionLog: [
        `🔄 [RECOVERY] Reconstructed active execution context...`,
      ],
      metadata: {
        workflowId: state.id
      }
    };

    if (state.vision) {
      context.detectedIssue = state.vision.visualSceneDescription;
      context.detectedObjects = state.vision.objectsDetected;
    }

    if (state.classification) {
      context.category = state.classification.category;
      context.subCategory = state.classification.subCategory;
      context.municipalDepartment = state.classification.municipalDepartment;
      context.complaintType = state.classification.complaintType;
    }

    if (state.severity) {
      context.severity = state.severity.severityLevel;
      context.publicSafetyImpact = state.severity.justification;
      context.priorityScore = state.severity.priorityScore;
      context.riskFactors = state.severity.riskFactors;
      context.estimatedResponseTime = state.severity.estimatedResponseTime;
    }

    if (state.routing) {
      context.department = state.routing.department;
      context.sla = state.routing.sla;
      context.wardOffice = state.routing.wardOffice;
      context.municipalCorporation = state.routing.municipalCorporation;
      context.escalationAuthority = state.routing.escalationAuthority;
    }

    if (state.drafting) {
      context.complaintDraft = {
        subject: state.drafting.subject,
        complaintDraftEnglish: state.drafting.complaintDraftEnglish,
        complaintDraftHindi: state.drafting.complaintDraftHindi,
        rtiEscalationDraft: state.drafting.rtiEscalationDraft || '',
        citizenSummary: state.drafting.citizenSummary || ''
      };
    }

    if (state.riskPrediction) {
      context.riskPrediction = {
        infrastructureRiskScore: state.riskPrediction.infrastructureRiskScore,
        publicHealthHazards: state.riskPrediction.publicHealthHazards,
        legalLiabilityScore: state.riskPrediction.legalLiabilityScore,
        proactiveMitigationAdvice: state.riskPrediction.proactiveMitigationAdvice,
        futureRisk: state.riskPrediction.futureRisk,
        possibleConsequences: state.riskPrediction.possibleConsequences,
        urgencyLevel: state.riskPrediction.urgencyLevel,
        recommendations: state.riskPrediction.recommendations,
        communityImpact: state.riskPrediction.communityImpact
      };
    }

    if (state.advisory) {
      context.advisory = {
        citizenRightsSummary: state.advisory.citizenRightsSummary,
        applicableActsAndBylaws: state.advisory.applicableActsAndBylaws,
        safetyDoAndDonts: state.advisory.safetyDoAndDonts,
        escalationProcedures: state.advisory.escalationProcedures,
        expectedTimelines: state.advisory.expectedTimelines,
        recommendations: state.advisory.recommendations
      };
    }

    if (state.heatmap) {
      context.heatmapData = {
        geohashSector: state.heatmap.geohashSector,
        hazardClusterDensity: state.heatmap.hazardClusterDensity,
        cityHotspotRank: state.heatmap.cityHotspotRank,
        nearbyRiskMarkers: state.heatmap.nearbyRiskMarkers,
        wardRiskIndex: state.heatmap.wardRiskIndex,
        hotspotScore: state.heatmap.hotspotScore,
        densityCluster: state.heatmap.densityCluster
      };
    }

    return context;
  }

  private async persistState(state: CivicWorkflowState): Promise<void> {
    try {
      const docRef = doc(db, 'agentWorkflows', state.id);
      await setDoc(docRef, state);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `agentWorkflows/${state.id}`);
    }
  }
}
