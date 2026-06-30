import { CivicAgent } from './AgentTypes';
import { AgentContext } from './AgentContext';

export class ClassificationAgent implements CivicAgent {
  name = 'Classification Agent';

  async execute(context: AgentContext): Promise<AgentContext> {
    const updatedContext = { ...context };

    updatedContext.executionLog = [
      ...(updatedContext.executionLog || []),
      `🏷️ [Classification Agent] Standardizing grievance taxonomy with civic intelligence...`
    ];

    try {
      const statePayload = {
        userDescription: updatedContext.description,
        city: updatedContext.location?.city || 'Unknown City',
        address: updatedContext.location?.address || 'Unknown Address',
        vision: {
          imageAnalyzed: !!updatedContext.image,
          objectsDetected: updatedContext.detectedObjects || [],
          visualSceneDescription: updatedContext.summary || updatedContext.detectedIssue || ''
        }
      };

      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: 'ClassificationAgent',
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

      const category = parsedData.category || 'Roads & Traffic';
      const subCategory = parsedData.subCategory || 'General Amenity Concern';
      const municipalDepartment = parsedData.municipalDepartment || 'Road Maintenance Department';
      const complaintType = parsedData.complaintType || 'Road Damage';
      const tags = Array.isArray(parsedData.tags) ? parsedData.tags : ['civic-issue'];

      updatedContext.category = category;
      updatedContext.subCategory = subCategory;
      updatedContext.municipalDepartment = municipalDepartment;
      updatedContext.complaintType = complaintType;

      // Maintain extensible metadata
      updatedContext.metadata = {
        ...(updatedContext.metadata || {}),
        subCategory,
        taxonomyTags: tags,
        municipalDepartment,
        complaintType,
        classificationModel: 'CORTEX-Taxonomy-v3'
      };

      updatedContext.executionLog.push(`✅ [Classification Agent] Assigned primary category: "${category}"`);
      updatedContext.executionLog.push(`✅ [Classification Agent] Detected sub-category: "${subCategory}"`);
      updatedContext.executionLog.push(`✅ [Classification Agent] Determined department: "${municipalDepartment}"`);
      updatedContext.executionLog.push(`✅ [Classification Agent] Tags assigned: [${tags.join(', ')}]`);

      return updatedContext;

    } catch (error: any) {
      const errMsg = error.message || 'Unknown error during Classification Agent execution.';
      console.warn(`[Classification Agent] API Execution failed, using robust heuristic fallback:`, errMsg);

      updatedContext.executionLog.push(
        `⚠️ [Classification Agent] Classification API failed (${errMsg}). Activating local diagnostic fallback...`
      );

      // Robust fallback heuristics
      const searchStr = (updatedContext.description + ' ' + (updatedContext.detectedIssue || '')).toLowerCase();
      
      let category = 'Public Safety';
      let subCategory = 'General Civic Nuisance';
      let municipalDepartment = 'General Administration Division';
      let complaintType = 'Road Damage';
      let tags = ['civic-issue'];

      if (searchStr.includes('pothole')) {
        category = 'Road Infrastructure';
        subCategory = 'Road Potholes';
        municipalDepartment = 'Road Maintenance Department';
        complaintType = 'Pothole';
        tags = ['roads', 'pothole', 'traffic-safety'];
      } else if (searchStr.includes('garbage') || searchStr.includes('waste') || searchStr.includes('trash') || searchStr.includes('bin')) {
        category = 'Sanitation';
        subCategory = 'Unattended Waste / Garbage Dumping';
        municipalDepartment = 'Solid Waste Management';
        complaintType = 'Garbage Dump';
        tags = ['sanitation', 'waste-mgmt', 'garbage'];
      } else if (searchStr.includes('light') || searchStr.includes('bulb') || searchStr.includes('dark')) {
        category = 'Electricity & Illumination';
        subCategory = 'Broken Streetlight Column';
        municipalDepartment = 'Public Lighting Department';
        complaintType = 'Broken Streetlight';
        tags = ['electricity', 'streetlights', 'night-safety'];
      } else if (searchStr.includes('flood') || searchStr.includes('waterlogging') || searchStr.includes('puddle')) {
        category = 'Water & Sanitation';
        subCategory = 'Street Waterlogging / Drainage Overflow';
        municipalDepartment = 'Sewerage & Water Board';
        complaintType = 'Waterlogging';
        tags = ['water-logging', 'drainage', 'utility'];
      } else if (searchStr.includes('dumping') || searchStr.includes('debris')) {
        category = 'Sanitation & Environment';
        subCategory = 'Illegal Construction Debris Dumping';
        municipalDepartment = 'Solid Waste Management';
        complaintType = 'Illegal Dumping';
        tags = ['illegal-dumping', 'waste-mgmt', 'debris'];
      } else if (searchStr.includes('drain') || searchStr.includes('sewer') || searchStr.includes('manhole')) {
        category = 'Water & Sanitation';
        subCategory = 'Blocked Municipal Drainage Channels';
        municipalDepartment = 'Sewerage & Water Board';
        complaintType = 'Drain Blockage';
        tags = ['drainage', 'sewerage', 'clogged'];
      } else if (searchStr.includes('road') || searchStr.includes('asphalt') || searchStr.includes('crack')) {
        category = 'Road Infrastructure';
        subCategory = 'General Road Surface Damage';
        municipalDepartment = 'Road Maintenance Department';
        complaintType = 'Road Damage';
        tags = ['roads', 'pavement', 'infrastructure'];
      }

      updatedContext.category = category;
      updatedContext.subCategory = subCategory;
      updatedContext.municipalDepartment = municipalDepartment;
      updatedContext.complaintType = complaintType;

      updatedContext.metadata = {
        ...(updatedContext.metadata || {}),
        subCategory,
        taxonomyTags: tags,
        municipalDepartment,
        complaintType,
        classificationModel: 'Heuristic-Local-v1'
      };

      updatedContext.executionLog.push(`✅ [Classification Agent] Heuristic fallback completed. [Category: ${category}] | [Dept: ${municipalDepartment}]`);

      return updatedContext;
    }
  }
}
