import { CivicAgent } from './AgentTypes';
import { AgentContext } from './AgentContext';

export class VisionAgent implements CivicAgent {
  name = 'Vision Agent';

  async execute(context: AgentContext): Promise<AgentContext> {
    const updatedContext = { ...context };
    
    // Initialize logs
    updatedContext.executionLog = [
      ...(updatedContext.executionLog || []),
      `🔍 [Vision Agent] Initiating multi-agent visual scene diagnostics...`
    ];

    const description = updatedContext.description || '';
    const image = updatedContext.image;

    if (image) {
      updatedContext.executionLog.push(`🔍 [Vision Agent] Dispatching image payload and text descriptions to Gemini 2.5 Flash Vision...`);
    } else {
      updatedContext.executionLog.push(`🔍 [Vision Agent] No image detected. Using description fallback for text diagnostics...`);
    }

    try {
      // Build state parameter matching the API schema
      const statePayload = {
        userDescription: description,
        imageUrl: image,
        city: updatedContext.location?.city || 'Unknown City',
        address: updatedContext.location?.address || 'Unknown Address'
      };

      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: 'VisionAgent',
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

      // Check for expected properties and extract
      const detectedIssue = parsedData.detectedIssue || this.matchSupportedIssue(description);
      const confidence = typeof parsedData.confidence === 'number' ? parsedData.confidence : 0.85;
      const detectedObjects = Array.isArray(parsedData.detectedObjects) ? parsedData.detectedObjects : (parsedData.objectsDetected || ['Infrastructure damage']);
      const summary = parsedData.summary || parsedData.visualSceneDescription || 'Scene analyzed successfully with some minor issues detected.';

      // Store outputs inside AgentContext
      updatedContext.detectedIssue = detectedIssue;
      updatedContext.confidence = confidence;
      updatedContext.detectedObjects = detectedObjects;
      updatedContext.summary = summary;

      // Keep metadata backward compatible and updated
      updatedContext.metadata = {
        ...(updatedContext.metadata || {}),
        detectedObjects: detectedObjects,
        visionConfidence: confidence,
        imageAnalyzed: !!image,
        summary: summary
      };

      updatedContext.executionLog.push(
        `✅ [Vision Agent] Model analysis succeeded. [Detected Issue: ${detectedIssue}] | [Confidence: ${(confidence * 100).toFixed(1)}%] | [Objects: ${detectedObjects.join(', ')}]`
      );

      return updatedContext;

    } catch (error: any) {
      const errMsg = error.message || 'Unknown error during Vision Agent execution.';
      console.warn(`[Vision Agent] API Execution failed, using robust heuristic fallback:`, errMsg);
      
      updatedContext.executionLog.push(
        `⚠️ [Vision Agent] Vision API failed (${errMsg}). Activating local diagnostic fallback...`
      );

      // Perform local heuristic processing
      const detectedIssue = this.matchSupportedIssue(description);
      let objects = ['Infrastructure defect'];
      let sceneDesc = 'An issue requiring immediate civic inspection and maintenance.';
      const lowercaseDesc = description.toLowerCase();

      if (detectedIssue === 'Pothole') {
        objects = ['Pothole', 'Asphalt crack', 'Roadway hazard'];
        sceneDesc = 'Heuristic fallback: Visual cues indicate asphalt breakdown with a distinct roadway pothole.';
      } else if (detectedIssue === 'Garbage Dump') {
        objects = ['Overflowing waste', 'Trash bin', 'Unsanitary pile'];
        sceneDesc = 'Heuristic fallback: Description matches unmanaged municipal solid waste pile.';
      } else if (detectedIssue === 'Broken Streetlight') {
        objects = ['Streetlight column', 'Defective light fixture'];
        sceneDesc = 'Heuristic fallback: Dark public segment reported due to non-functioning streetlight.';
      } else if (detectedIssue === 'Waterlogging') {
        objects = ['Standing water', 'Flooded street', 'Drainage backup'];
        sceneDesc = 'Heuristic fallback: Significant public roadway flooding or water accumulation.';
      } else if (detectedIssue === 'Illegal Dumping') {
        objects = ['Disposed debris', 'Construction waste'];
        sceneDesc = 'Heuristic fallback: Unpermitted disposal of junk, debris, or waste material.';
      } else if (detectedIssue === 'Road Damage') {
        objects = ['Road cracks', 'Uneven asphalt', 'Pavement deformation'];
        sceneDesc = 'Heuristic fallback: Damaged pavement surface with structural cracking and bumps.';
      } else if (detectedIssue === 'Drain Blockage') {
        objects = ['Clogged sewer grate', 'Blocked manhole', 'Debris buildup'];
        sceneDesc = 'Heuristic fallback: Blocked stormwater inlet or storm sewer drain.';
      }

      updatedContext.detectedIssue = detectedIssue;
      updatedContext.confidence = 0.70; // lower confidence for heuristic fallback
      updatedContext.detectedObjects = objects;
      updatedContext.summary = sceneDesc;

      updatedContext.metadata = {
        ...(updatedContext.metadata || {}),
        detectedObjects: objects,
        visionConfidence: 0.70,
        imageAnalyzed: false,
        summary: sceneDesc
      };

      updatedContext.executionLog.push(
        `✅ [Vision Agent] Heuristic fallback completed. [Issue: ${detectedIssue}] | [Confidence: 70%] | [Objects: ${objects.join(', ')}]`
      );

      return updatedContext;
    }
  }

  /**
   * Matches the user's description against the supported list of issues
   */
  private matchSupportedIssue(description: string): string {
    const lowercaseDesc = description.toLowerCase();

    // Matching rules for supported categories
    if (lowercaseDesc.includes('pothole') || lowercaseDesc.includes('potholes')) {
      return 'Pothole';
    }
    if (lowercaseDesc.includes('garbage') || lowercaseDesc.includes('trash') || lowercaseDesc.includes('refuse') || lowercaseDesc.includes('dustbin') || lowercaseDesc.includes('waste')) {
      if (lowercaseDesc.includes('dump') || lowercaseDesc.includes('pile') || lowercaseDesc.includes('dumping')) {
        return 'Garbage Dump';
      }
      return 'Garbage Dump';
    }
    if (lowercaseDesc.includes('streetlight') || lowercaseDesc.includes('street light') || lowercaseDesc.includes('lamp') || lowercaseDesc.includes('darkness') || lowercaseDesc.includes('bulb')) {
      return 'Broken Streetlight';
    }
    if (lowercaseDesc.includes('waterlogging') || lowercaseDesc.includes('flood') || lowercaseDesc.includes('puddle') || lowercaseDesc.includes('water logging') || lowercaseDesc.includes('flooded')) {
      return 'Waterlogging';
    }
    if (lowercaseDesc.includes('dumping') || lowercaseDesc.includes('illegal dump') || lowercaseDesc.includes('debris') || lowercaseDesc.includes('construction waste')) {
      return 'Illegal Dumping';
    }
    if (lowercaseDesc.includes('drain') || lowercaseDesc.includes('sewer') || lowercaseDesc.includes('manhole') || lowercaseDesc.includes('blockage') || lowercaseDesc.includes('clogged')) {
      return 'Drain Blockage';
    }
    if (lowercaseDesc.includes('road') || lowercaseDesc.includes('street') || lowercaseDesc.includes('asphalt') || lowercaseDesc.includes('crack') || lowercaseDesc.includes('pavement')) {
      return 'Road Damage';
    }

    // Default general issue fallback
    return 'Road Damage';
  }
}
