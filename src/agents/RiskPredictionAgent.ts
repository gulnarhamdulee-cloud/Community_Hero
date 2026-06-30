import { CivicAgent } from './AgentTypes';
import { AgentContext } from './AgentContext';

export class RiskPredictionAgent implements CivicAgent {
  name = 'Risk Prediction Agent';

  async execute(context: AgentContext): Promise<AgentContext> {
    const updatedContext = { ...context };

    updatedContext.executionLog = [
      ...(updatedContext.executionLog || []),
      `🔮 [Risk Prediction Agent] Commencing predictive risk, liability, and failure cascading model...`
    ];

    const category = updatedContext.category || 'General';
    const severityRaw = updatedContext.severity || 'Moderate';
    const isCritical = severityRaw.toUpperCase() === 'CRITICAL';
    const isHighOrSevere = severityRaw.toUpperCase() === 'HIGH' || severityRaw.toUpperCase() === 'SEVERE';
    const city = updatedContext.location?.city || 'Bengaluru';
    const desc = updatedContext.description;

    // Define smart offline fallback values
    let decayScore = 45;
    let liabilityScore = 30;
    let hazards = ['General safety hazard'];
    let advice = 'Establish visible cautionary tape around the defect area until repaired.';
    let futureRisk = "Gradual deterioration of surrounding infrastructure leading to higher eventual repair costs and safety hazards.";
    let possibleConsequences = ["Minor injuries", "Local path obstruction", "Structural damage over time"];
    let urgencyLevel = isCritical ? 'Critical' : isHighOrSevere ? 'High' : 'Medium';
    let recommendations = ["Avoid close proximity to defect", "Monitor progression of damage", "Report to municipal authorities"];
    let communityImpact = "Restricts ease of access to public pathways and lowers local municipal service satisfaction.";

    if (category.includes('Roads') || category.includes('Street')) {
      decayScore = isCritical ? 88 : isHighOrSevere ? 72 : 50;
      liabilityScore = isCritical ? 95 : isHighOrSevere ? 78 : 45;
      hazards = [
        'High-velocity motorist suspension damage',
        'Wet-weather skidding & vehicle collisions',
        'Pedestrian ankle sprains or severe trip-and-falls'
      ];
      advice = 'Place temporary reflective cones immediately. Reduce vehicular speeds to under 20km/h when traversing.';
      futureRisk = "Progressive sub-base erosion and surrounding pavement degradation due to continuous vehicle impact loading.";
      possibleConsequences = ["Vehicle damage", "Accidents", "Ambulance delays", "Pedestrian trips"];
      recommendations = ["Erect reflective safety cones around defect perimeter", "Report to local ward executive engineer", "Alert local neighborhood groups to take care"];
      communityImpact = "Disrupts local traffic flow, increases commuting time, and poses a severe threat to two-wheelers and pedestrians at night.";
    } else if (category.includes('Sanitation') || category.includes('Waste')) {
      decayScore = isCritical ? 85 : isHighOrSevere ? 68 : 40;
      liabilityScore = isCritical ? 80 : isHighOrSevere ? 65 : 35;
      hazards = [
        'Bacterial and viral vector outbreaks (dengue/cholera)',
        'Stray animal gathers and public aggression hazards',
        'Micro-plastic contamination of municipal drainage channels'
      ];
      advice = 'Sprinkle bleaching/bleach-disinfectant powder around the area to suppress immediate vector multiplication and pathogen spread.';
      futureRisk = "Accumulated toxic bio-waste decomposition leading to rapid microbial/insect propagation and localized groundwater contamination.";
      possibleConsequences = ["Stray animal gathering", "Severe stench and air pollution", "Spread of disease (dengue, cholera)", "Blockage of drainage systems"];
      recommendations = ["Avoid touch contact with heap", "Sprinkle bleaching/bleach-disinfectant powder", "Keep domestic pets away from site"];
      communityImpact = "Creates unhygienic local living conditions, increases risk of vector-borne illnesses, and degrades the aesthetic value of the residential zone.";
    } else if (category.includes('Streetlights') || category.includes('Lighting')) {
      decayScore = 60;
      liabilityScore = isCritical ? 90 : isHighOrSevere ? 80 : 50;
      hazards = [
        'Enhanced local anti-social and opportunistic crime rates',
        'Reduced night-time vehicle stopping visibility',
        'Pedestrian pathway disorientation risks'
      ];
      advice = 'Advise female and elderly residents to avoid solo walks along this segment after 18:30. Utilize portable pocket torches.';
      futureRisk = "Sustained dark zone leading to unchecked civic vulnerability, reduced safety, and increased traffic hazard.";
      possibleConsequences = ["Increased opportunistic crime", "Reduced night-time vehicle stopping visibility", "Pedestrian pathway disorientation"];
      recommendations = ["Carry personal flashlights at night", "Avoid solo dark pathway traverses", "Request urgent power line/fixture inspections"];
      communityImpact = "Significantly lowers nocturnal public security, restricts nighttime utility of path for elderly residents, and increases pedestrian safety risks.";
    } else if (category.includes('Water') || category.includes('Sewerage') || category.includes('Drainage')) {
      decayScore = isCritical ? 92 : isHighOrSevere ? 75 : 55;
      liabilityScore = isCritical ? 85 : isHighOrSevere ? 70 : 40;
      hazards = [
        'Underground subsoil erosion leading to potential sinkhole collapses',
        'Stagnant water malaria vector breeding clusters',
        'Potable drinking water mains cross-contamination'
      ];
      advice = 'Shut down localized booster pressure valves to reduce pressure heads. Avoid drinking unboiled tap water in immediate grid vicinity.';
      futureRisk = "Underground subsoil erosion leading to potential sinkhole collapses or toxic cross-contamination of domestic plumbing lines.";
      possibleConsequences = ["Potable water contamination", "Localized subsoil collapse/sinkholes", "Severe stench and sewage overflow"];
      recommendations = ["Boil all domestic drinking water in the vicinity", "Report leak to municipal sewerage division", "Avoid stepping on sodden ground around leak"];
      communityImpact = "Risks widespread waterborne epidemic, degrades sanitation standards, and threatens the physical foundation of adjacent structures.";
    }

    try {
      const statePayload = {
        userDescription: desc,
        city: city,
        address: updatedContext.location?.address || 'Unknown Locality',
        classification: {
          category,
          subCategory: updatedContext.subCategory || 'General'
        },
        severity: {
          severityLevel: severityRaw
        },
        vision: {
          visualSceneDescription: updatedContext.summary || updatedContext.detectedIssue || 'Civic infrastructure defect'
        }
      };

      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: 'RiskPredictionAgent',
          state: statePayload
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status} ${response.statusText}`);
      }

      const parsedData = await response.json();

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Invalid or empty response from risk prediction execution endpoint');
      }

      updatedContext.riskPrediction = {
        infrastructureRiskScore: typeof parsedData.infrastructureRiskScore === 'number' ? parsedData.infrastructureRiskScore : decayScore,
        publicHealthHazards: Array.isArray(parsedData.publicHealthHazards) ? parsedData.publicHealthHazards : hazards,
        legalLiabilityScore: typeof parsedData.legalLiabilityScore === 'number' ? parsedData.legalLiabilityScore : liabilityScore,
        proactiveMitigationAdvice: parsedData.proactiveMitigationAdvice || advice,
        futureRisk: parsedData.futureRisk || futureRisk,
        possibleConsequences: Array.isArray(parsedData.possibleConsequences) ? parsedData.possibleConsequences : possibleConsequences,
        urgencyLevel: parsedData.urgencyLevel || urgencyLevel,
        recommendations: Array.isArray(parsedData.recommendations) ? parsedData.recommendations : recommendations,
        communityImpact: parsedData.communityImpact || communityImpact
      };

      updatedContext.executionLog.push(`🔮 [Risk Prediction Agent] Calculated decay risk index: ${updatedContext.riskPrediction.infrastructureRiskScore}%`);
      updatedContext.executionLog.push(`🔮 [Risk Prediction Agent] Public liability rating: ${updatedContext.riskPrediction.legalLiabilityScore}/100`);
      updatedContext.executionLog.push(`🔮 [Risk Prediction Agent] Urgency category evaluated: ${updatedContext.riskPrediction.urgencyLevel?.toUpperCase()}`);

      return updatedContext;

    } catch (error: any) {
      const errMsg = error.message || 'Unknown error during Risk Prediction Agent execution.';
      console.warn(`[Risk Prediction Agent] API Execution failed, using offline fallback models:`, errMsg);

      updatedContext.executionLog.push(
        `⚠️ [Risk Prediction Agent] Prediction API failed (${errMsg}). Activating offline fallback models...`
      );

      updatedContext.riskPrediction = {
        infrastructureRiskScore: decayScore,
        publicHealthHazards: hazards,
        legalLiabilityScore: liabilityScore,
        proactiveMitigationAdvice: advice,
        futureRisk,
        possibleConsequences,
        urgencyLevel,
        recommendations,
        communityImpact
      };

      updatedContext.executionLog.push(`🔮 [Risk Prediction Agent] Fallback decay risk index: ${decayScore}%`);
      updatedContext.executionLog.push(`🔮 [Risk Prediction Agent] Fallback public liability rating: ${liabilityScore}/100`);
      return updatedContext;
    }
  }
}
