import { CivicAgent } from './AgentTypes';
import { AgentContext } from './AgentContext';

export class SeverityAgent implements CivicAgent {
  name = 'Severity Agent';

  async execute(context: AgentContext): Promise<AgentContext> {
    const updatedContext = { ...context };

    updatedContext.executionLog = [
      ...(updatedContext.executionLog || []),
      `⚡ [Severity Agent] Evaluating municipal risk, priority scores, and safety severity quotients...`
    ];

    const description = updatedContext.description || '';
    const detectedIssue = updatedContext.detectedIssue || '';
    const summary = updatedContext.summary || '';
    const category = updatedContext.category || 'Roads & Traffic';
    const subCategory = updatedContext.subCategory || '';

    try {
      const statePayload = {
        userDescription: description,
        classification: {
          category: category,
          subCategory: subCategory
        },
        vision: {
          visualSceneDescription: summary || detectedIssue || '',
          objectsDetected: updatedContext.detectedObjects || []
        },
        city: updatedContext.location?.city || 'Unknown City',
        address: updatedContext.location?.address || 'Unknown Address'
      };

      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: 'SeverityAgent',
          state: statePayload
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status} ${response.statusText}`);
      }

      const parsedData = await response.json();

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Invalid or empty response object from agent execution endpoint');
      }

      const severity = parsedData.severity || parsedData.severityLevel || this.calculateFallbackSeverity(description, category);
      const priorityScore = typeof parsedData.priorityScore === 'number' ? parsedData.priorityScore : this.calculateFallbackPriority(severity);
      const riskFactors = Array.isArray(parsedData.riskFactors) ? parsedData.riskFactors : (parsedData.impactFactors || this.calculateFallbackRiskFactors(severity, category));
      const estimatedResponseTime = parsedData.estimatedResponseTime || this.calculateFallbackResponseTime(severity);
      const publicSafetyImpact = parsedData.publicSafetyImpact || parsedData.justification || 'General safety hazard requiring administrative priority review.';

      updatedContext.severity = severity.toUpperCase();
      updatedContext.priorityScore = priorityScore;
      updatedContext.riskFactors = riskFactors;
      updatedContext.estimatedResponseTime = estimatedResponseTime;
      updatedContext.publicSafetyImpact = publicSafetyImpact;

      updatedContext.metadata = {
        ...(updatedContext.metadata || {}),
        severityJustification: publicSafetyImpact,
        impactFactors: riskFactors,
        priorityWeight: priorityScore,
        estimatedResponseTime,
        severityCalculatedAt: new Date().toISOString()
      };

      updatedContext.executionLog.push(`✅ [Severity Agent] Severity quotient determined: "${updatedContext.severity}"`);
      updatedContext.executionLog.push(`✅ [Severity Agent] Priority Score: ${priorityScore}/100`);
      updatedContext.executionLog.push(`✅ [Severity Agent] Estimated Response Time: "${estimatedResponseTime}"`);
      updatedContext.executionLog.push(`✅ [Severity Agent] Public Safety Impact: "${publicSafetyImpact}"`);

      return updatedContext;

    } catch (error: any) {
      const errMsg = error.message || 'Unknown error during Severity Agent execution.';
      console.warn(`[Severity Agent] API Execution failed, using robust heuristic fallback:`, errMsg);

      updatedContext.executionLog.push(
        `⚠️ [Severity Agent] Severity API failed (${errMsg}). Activating local diagnostic fallback...`
      );

      const severity = this.calculateFallbackSeverity(description, category);
      const priorityScore = this.calculateFallbackPriority(severity);
      const riskFactors = this.calculateFallbackRiskFactors(severity, category);
      const estimatedResponseTime = this.calculateFallbackResponseTime(severity);
      const publicSafetyImpact = `Heuristic fallback evaluation. Public safety concerns identified regarding ${category.toLowerCase()} and related infrastructure decay. High risk of local disruption.`;

      updatedContext.severity = severity;
      updatedContext.priorityScore = priorityScore;
      updatedContext.riskFactors = riskFactors;
      updatedContext.estimatedResponseTime = estimatedResponseTime;
      updatedContext.publicSafetyImpact = publicSafetyImpact;

      updatedContext.metadata = {
        ...(updatedContext.metadata || {}),
        severityJustification: publicSafetyImpact,
        impactFactors: riskFactors,
        priorityWeight: priorityScore,
        estimatedResponseTime,
        severityCalculatedAt: new Date().toISOString()
      };

      updatedContext.executionLog.push(`✅ [Severity Agent] Heuristic fallback completed. [Severity: ${severity}] | [Priority Score: ${priorityScore}]`);

      return updatedContext;
    }
  }

  private calculateFallbackSeverity(description: string, category: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const searchStr = (description + ' ' + category).toLowerCase();

    if (searchStr.includes('open manhole') || searchStr.includes('live wire') || searchStr.includes('high voltage') || searchStr.includes('collapse') || searchStr.includes('bridge fail')) {
      return 'CRITICAL';
    }
    if (searchStr.includes('flood') || searchStr.includes('waterlogging') || searchStr.includes('pothole') || searchStr.includes('leak') || searchStr.includes('darkness')) {
      return 'HIGH';
    }
    if (searchStr.includes('garbage') || searchStr.includes('trash') || searchStr.includes('dump') || searchStr.includes('blockage')) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private calculateFallbackPriority(severity: string): number {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 95;
      case 'HIGH': return 75;
      case 'MEDIUM': return 50;
      case 'LOW': return 25;
      default: return 50;
    }
  }

  private calculateFallbackRiskFactors(severity: string, category: string): string[] {
    const factors: string[] = [];
    const cat = category.toLowerCase();

    if (severity.toUpperCase() === 'CRITICAL') {
      factors.push('Immediate life-threatening hazard');
      factors.push('Potential catastrophic infrastructure failure');
    } else if (severity.toUpperCase() === 'HIGH') {
      factors.push('Accident and collision risk for commuters');
      factors.push('Pedestrian injury or accessibility block');
    } else {
      factors.push('Aesthetic and environmental degradation');
      factors.push('Localized public inconvenience');
    }

    if (cat.includes('water') || cat.includes('sewer') || cat.includes('drain')) {
      factors.push('Bacterial contamination and public health risk');
    } else if (cat.includes('road') || cat.includes('traffic')) {
      factors.push('Vehicle damage or high-speed collision hazard');
    }

    return factors;
  }

  private calculateFallbackResponseTime(severity: string): string {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return '2 to 4 hours';
      case 'HIGH': return '12 to 24 hours';
      case 'MEDIUM': return '2 to 3 business days';
      case 'LOW': return '5 to 7 business days';
      default: return '2 to 3 business days';
    }
  }
}

