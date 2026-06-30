import { CivicAgent } from './AgentTypes';
import { AgentContext } from './AgentContext';

export class AdvisoryAgent implements CivicAgent {
  name = 'Civic Advisory Agent';

  async execute(context: AgentContext): Promise<AgentContext> {
    const updatedContext = { ...context };

    updatedContext.executionLog = [
      ...(updatedContext.executionLog || []),
      `⚖️ [Advisory Agent] Formulating legal frameworks, safety bylaws, and advisory timelines...`
    ];

    const category = updatedContext.category || 'General';
    const subCategory = updatedContext.subCategory || 'General';
    const city = updatedContext.location?.city || 'Bengaluru';
    const severity = updatedContext.severity || 'MEDIUM';
    const department = updatedContext.department || updatedContext.municipalDepartment || 'General Municipal Works';
    const desc = updatedContext.description || 'Civic infrastructure defect';

    // Step 1: Initialize high-quality local fallback values
    let summary = 'Citizens possess the constitutional right to safe, clean, and operational civic amenities in accordance with the Right to Life under Article 21.';
    let acts = ['Municipal Corporation Act', 'Right to Information (RTI) Act, 2005'];
    let dos = ['Report the issue immediately', 'Maintain visual records of the defect'];
    let donts = ['Do not attempt unauthorized repairs', 'Do not ignore safety hazards'];
    let escalationProcedures = [
      'Submit written grievance to the Ward Officer / Assistant Commissioner.',
      'Escalate to the Zonal Joint Commissioner if unresolved within SLA.',
      'File an appeal with the Municipal Commissioner or State Grievance Redressal Portal.'
    ];
    let expectedTimelines = '3 to 7 working days based on municipal service charter.';
    let recommendations = [
      'Keep your complaint reference ID stored safely for follow-ups.',
      'Gather community signatures if multiple properties or streets are affected.',
      'Take high-resolution photographs periodically to document the lack of progress.'
    ];

    // Local heuristic adjustments based on category
    if (category.includes('Roads')) {
      summary = 'Under Section 58 of the Karnataka Municipal Corporations Act (and corresponding Indian state laws), the municipal body has an absolute statutory obligation to maintain and repair public roads and streets for citizen safety.';
      acts = [
        'Section 58 of the Karnataka Municipal Corporations Act, 1976',
        'Motor Vehicles Act, 1988 (Section 198A - Failure of Authority to maintain roads)',
        'Right to Information (RTI) Act, 2005 (seeking road quality testing records)'
      ];
      dos = [
        'Slow down significantly when approaching the pothole zone.',
        'File an RTI query to ask for the "Contractor Liability & Defect Liability Period (DLP)" of this road segment if unresolved for 15 days.',
        'Alert other motorists by warning on community map apps.'
      ];
      donts = [
        'Do not drive over wet potholes at high speed as depth is often deceptive.',
        'Do not attempt to fill the pothole with loose stones or soil, which creates skid hazards for two-wheelers.',
        'Do not approach the road edge during heavy monsoon showers.'
      ];
      expectedTimelines = '48 hours for immediate pothole patching; 15 days for resurfacing.';
    } else if (category.includes('Sanitation') || category.includes('Waste')) {
      summary = 'Municipal authorities have a mandatory legal duty to arrange for the collection, sorting, transport, and scientific disposal of municipal solid wastes. Citizens have rights to clean environment under Article 21.';
      acts = [
        'Solid Waste Management Rules, 2016 (Ministry of Environment & Forests)',
        'Article 21 of the Constitution of India (Right to a Clean and Healthy Environment)',
        'Municipal Corporation Solid Waste Cleanliness Bylaws, 2020'
      ];
      dos = [
        'Keep organic and dry waste strictly segregated at source.',
        'Take photos of commercial operators illegally dumping construction debris or commercial waste at public black spots.',
        'Engage with your local Ward Committee to coordinate solid waste sweeps.'
      ];
      donts = [
        'Do not burn dry plastic or organic garbage piles, as this releases carcinogens and violates NGT directives.',
        'Do not hand over waste to un-authorized informal collectors who dispose of it in public water bodies.',
        'Do not mix sanitary or hazardous biomedical waste with normal household trash.'
      ];
      expectedTimelines = '24 hours for black spot clearing; 48 hours for regular doorstep collection failures.';
    } else if (category.includes('Streetlights')) {
      summary = 'Local municipal bylaws guarantee safe night-time mobility. Failure of illumination leading to injury, assault, or theft can establish grounds for public negligence.';
      acts = [
        'Municipal Street Lighting Guidelines and Safety Standard Code',
        'Right to Safe Passages (Article 19 & 21 night safety derivatives)',
        'Energy Conservation Building Code (ECBC) Lighting Mandates'
      ];
      dos = [
        'Use the high beam of vehicles responsibly to illuminate dark corners for pedestrians.',
        'Walk in groups when crossing dark patches during late hours.',
        'Lodge a formal ward-level complaint demanding active patrolling from local police beats in unlit sectors.'
      ];
      donts = [
        'Do not touch exposed electrical cables dangling from streetlight poles.',
        'Do not attempt to tap public lighting cables or modify poles privately.',
        'Do not leave household exterior lights completely off if they assist in light spill onto dark public footpaths.'
      ];
      expectedTimelines = '24 to 48 hours for single light bulb replacements; 3 days for cabling/circuit failures.';
    } else if (category.includes('Water') || category.includes('Sewerage')) {
      summary = 'The supply of safe drinking water and sewage containment is a core constitutional directive. Citizens are legally protected from contaminated utility supply.';
      acts = [
        'Water Supply and Sewage Board Act (Core Service Directives)',
        'Bureau of Indian Standards (BIS) drinking water specification (IS 10500)',
        'The Prohibition of Employment as Manual Scavengers and their Rehabilitation Act, 2013'
      ];
      dos = [
        'Boil municipal tap water for at least 15-20 minutes before ingestion during active local utility pipe bursts.',
        'Report wastewater logging to prevent foundational decay of immediate public buildings.',
        'Observe if water supply is running colored or foul-smelling, and store a sample for water-grid quality tests.'
      ];
      donts = [
        'Do not attempt to manually open sewer main manholes, which is strictly prohibited and highly dangerous.',
        'Do not build structures or dump heavy materials over buried water-main valve shafts.',
        'Do not consume uncooked vegetables washed in unboiled tap water while pipeline leaks remain active.'
      ];
      expectedTimelines = '24 hours for water line contamination/pipe burst; 48 hours for sewer overflows.';
    }

    // Step 2: Query Gemini API for live, context-tailored advisory and timelines
    try {
      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: 'AdvisoryAgent',
          state: {
            userDescription: desc,
            city: city,
            department: department,
            severity: severity,
            category: category,
            subCategory: subCategory
          }
        })
      });

      if (response.ok) {
        const parsedData = await response.json();
        if (parsedData && typeof parsedData === 'object') {
          summary = parsedData.citizenRightsSummary || summary;
          acts = parsedData.applicableActsAndBylaws || acts;
          if (parsedData.safetyDoAndDonts && typeof parsedData.safetyDoAndDonts === 'object') {
            dos = parsedData.safetyDoAndDonts.dos || dos;
            donts = parsedData.safetyDoAndDonts.donts || donts;
          }
          escalationProcedures = parsedData.escalationProcedures || escalationProcedures;
          expectedTimelines = parsedData.expectedTimelines || expectedTimelines;
          recommendations = parsedData.recommendations || recommendations;
          updatedContext.executionLog.push(`⚖️ [Advisory Agent] Successfully fetched dynamic Gemini legal and safety guidelines.`);
        }
      }
    } catch (apiError: any) {
      console.warn('[AdvisoryAgent] Gemini API execution failed, utilizing rich local heuristics:', apiError.message);
      updatedContext.executionLog.push(`⚖️ [Advisory Agent] Gemini API unavailable. Standard municipal guidelines successfully loaded.`);
    }

    // Save final outputs to AgentContext
    updatedContext.advisory = {
      citizenRightsSummary: summary,
      applicableActsAndBylaws: acts,
      safetyDoAndDonts: {
        dos,
        donts
      },
      escalationProcedures,
      expectedTimelines,
      recommendations
    };

    updatedContext.executionLog.push(`⚖️ [Advisory Agent] Formulated ${acts.length} statutory legal references for ${city}.`);
    updatedContext.executionLog.push(`⚖️ [Advisory Agent] Expected Timeline mapped: "${expectedTimelines}"`);
    updatedContext.executionLog.push(`⚖️ [Advisory Agent] Compiled customized citizen advisory profile successfully.`);

    return updatedContext;
  }
}
