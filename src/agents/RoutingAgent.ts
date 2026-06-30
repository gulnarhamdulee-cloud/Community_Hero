import { CivicAgent } from './AgentTypes';
import { AgentContext } from './AgentContext';

export class RoutingAgent implements CivicAgent {
  name = 'Routing Agent';

  async execute(context: AgentContext): Promise<AgentContext> {
    const updatedContext = { ...context };

    updatedContext.executionLog = [
      ...(updatedContext.executionLog || []),
      `🏢 [Routing Agent] Aligning grievance with metropolitan ward administrative offices...`
    ];

    const category = updatedContext.category || 'General';
    const subCategory = updatedContext.subCategory || '';
    const city = updatedContext.location?.city || 'Bengaluru';
    const severity = updatedContext.severity || 'MEDIUM';

    try {
      const statePayload = {
        userDescription: updatedContext.description,
        city: city,
        address: updatedContext.location?.address || 'Unknown Address',
        classification: {
          category,
          subCategory
        },
        severity: {
          severityLevel: severity
        }
      };

      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: 'RoutingAgent',
          state: statePayload
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status} ${response.statusText}`);
      }

      const parsedData = await response.json();

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Invalid or empty response object from routing execution endpoint');
      }

      // Extract results from API response
      const department = parsedData.department || parsedData.responsibleDepartment || this.getFallbackDepartment(category);
      const wardInfo = parsedData.wardInfo || parsedData.wardOffice || `Ward Sector Office, ${city}`;
      const escalationContact = parsedData.escalationContact || parsedData.escalationAuthority || 'commissioner@municipal.gov.in';
      const municipalCorporation = parsedData.municipalCorporation || this.getFallbackCorporation(city);
      const wardOffice = parsedData.wardOffice || wardInfo;
      const responsibleDepartment = parsedData.responsibleDepartment || department;
      const escalationAuthority = parsedData.escalationAuthority || escalationContact;
      const sla = parsedData.sla || this.getFallbackSla(severity);

      // Save to context
      updatedContext.department = department;
      updatedContext.municipalCorporation = municipalCorporation;
      updatedContext.wardOffice = wardOffice;
      updatedContext.responsibleDepartment = responsibleDepartment;
      updatedContext.escalationAuthority = escalationAuthority;
      updatedContext.sla = sla;

      // Save metadata for extensibility and UI
      updatedContext.metadata = {
        ...(updatedContext.metadata || {}),
        routingContact: escalationContact,
        wardInfo: wardInfo,
        slaTargetDays: severity.toUpperCase() === 'CRITICAL' ? 1 : (severity.toUpperCase() === 'HIGH' || severity.toUpperCase() === 'SEVERE') ? 3 : 5,
        municipalCorporation,
        wardOffice,
        responsibleDepartment,
        escalationAuthority,
        sla,
        routedAt: new Date().toISOString()
      };

      updatedContext.executionLog.push(`🏢 [Routing Agent] Municipal Body assigned: "${municipalCorporation}"`);
      updatedContext.executionLog.push(`🏢 [Routing Agent] Target Ward Office: "${wardOffice}"`);
      updatedContext.executionLog.push(`🏢 [Routing Agent] Department routed: "${responsibleDepartment}"`);
      updatedContext.executionLog.push(`🏢 [Routing Agent] Escalation Contact: <${escalationContact}>`);
      updatedContext.executionLog.push(`🏢 [Routing Agent] Resolution SLA timeframe: "${sla}"`);

      return updatedContext;

    } catch (error: any) {
      const errMsg = error.message || 'Unknown error during Routing Agent execution.';
      console.warn(`[Routing Agent] API Execution failed, using robust heuristic fallback:`, errMsg);

      updatedContext.executionLog.push(
        `⚠️ [Routing Agent] Routing API failed (${errMsg}). Activating metropolitan offline fallback...`
      );

      const municipalCorporation = this.getFallbackCorporation(city);
      const mappings = this.getFallbackCityMappings(city, category);
      const sla = this.getFallbackSla(severity);

      updatedContext.department = mappings.department;
      updatedContext.municipalCorporation = municipalCorporation;
      updatedContext.wardOffice = mappings.wardOffice;
      updatedContext.responsibleDepartment = mappings.responsibleDepartment;
      updatedContext.escalationAuthority = mappings.escalationAuthority;
      updatedContext.sla = sla;

      updatedContext.metadata = {
        ...(updatedContext.metadata || {}),
        routingContact: mappings.escalationContact,
        wardInfo: mappings.wardOffice,
        slaTargetDays: severity.toUpperCase() === 'CRITICAL' ? 1 : (severity.toUpperCase() === 'HIGH' || severity.toUpperCase() === 'SEVERE') ? 3 : 5,
        municipalCorporation,
        wardOffice: mappings.wardOffice,
        responsibleDepartment: mappings.responsibleDepartment,
        escalationAuthority: mappings.escalationAuthority,
        sla,
        routedAt: new Date().toISOString()
      };

      updatedContext.executionLog.push(`🏢 [Routing Agent] Heuristic fallback assigned: "${municipalCorporation}" | "${mappings.wardOffice}"`);

      return updatedContext;
    }
  }

  private getFallbackCorporation(city: string): string {
    const c = city.trim().toLowerCase();
    if (c.includes('mumbai') || c.includes('bombay')) return 'Brihanmumbai Municipal Corporation (BMC)';
    if (c.includes('pune')) return 'Pune Municipal Corporation (PMC)';
    if (c.includes('bengaluru') || c.includes('bangalore')) return 'Bruhat Bengaluru Mahanagara Palike (BBMP)';
    if (c.includes('hyderabad')) return 'Greater Hyderabad Municipal Corporation (GHMC)';
    if (c.includes('chennai') || c.includes('madras')) return 'Greater Chennai Corporation (GCC)';
    if (c.includes('ahmedabad')) return 'Ahmedabad Municipal Corporation (AMC)';
    if (c.includes('kolkata') || c.includes('calcutta')) return 'Kolkata Municipal Corporation (KMC)';
    if (c.includes('delhi')) return 'Municipal Corporation of Delhi (MCD)';
    return `${city} Municipal Corporation`;
  }

  private getFallbackDepartment(category: string): string {
    const cat = category.toLowerCase();
    if (cat.includes('road')) return 'Road Infrastructure & Traffic Wing';
    if (cat.includes('sanitation') || cat.includes('waste')) return 'Solid Waste Management (SWM)';
    if (cat.includes('light') || cat.includes('power') || cat.includes('electricity')) return 'Electrical Public Lighting Wing';
    if (cat.includes('water') || cat.includes('sewer') || cat.includes('drain')) return 'Sewerage & Hydraulic Engineering Division';
    return 'Public Works and Grievances Desk';
  }

  private getFallbackSla(severity: string): string {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return '24 Hours';
      case 'HIGH':
      case 'SEVERE': return '3 Days';
      case 'MEDIUM':
      case 'MODERATE': return '5 Days';
      case 'LOW':
      default: return '7 Days';
    }
  }

  private getFallbackCityMappings(city: string, category: string) {
    const c = city.trim().toLowerCase();
    const cat = category.toLowerCase();

    // Default template structure
    const mappings = {
      department: this.getFallbackDepartment(category),
      wardOffice: 'General Administrative Ward Sector',
      responsibleDepartment: this.getFallbackDepartment(category),
      escalationAuthority: 'Assistant Municipal Commissioner',
      escalationContact: 'escalations@municipal.gov.in'
    };

    // 1. Mumbai
    if (c.includes('mumbai') || c.includes('bombay')) {
      mappings.wardOffice = 'Ward A, Fort Division, BMC';
      mappings.escalationAuthority = 'Assistant Municipal Commissioner (A Ward)';
      mappings.escalationContact = 'ward.a@mcgm.gov.in';
      if (cat.includes('road')) {
        mappings.responsibleDepartment = 'BMC Roads & Traffic Wing';
        mappings.department = 'Road Maintenance & Infrastructure Office';
      } else if (cat.includes('waste') || cat.includes('sanitation')) {
        mappings.responsibleDepartment = 'BMC Solid Waste Management Wing';
        mappings.department = 'SWM Ward Cleaning Cell';
      } else if (cat.includes('water') || cat.includes('sewer') || cat.includes('drain')) {
        mappings.responsibleDepartment = 'BMC Hydraulic Engineering Division';
        mappings.department = 'Water Works and Pipeline Control';
      }
    }
    // 2. Pune
    else if (c.includes('pune')) {
      mappings.wardOffice = 'Aundh-Baner Ward Office, PMC';
      mappings.escalationAuthority = 'Assistant Commissioner, Aundh Ward PMC';
      mappings.escalationContact = 'aundh.ward@punecorporation.org';
      if (cat.includes('road')) {
        mappings.responsibleDepartment = 'PMC Road Project Wing';
        mappings.department = 'PMC Pavement Management Wing';
      } else if (cat.includes('waste') || cat.includes('sanitation')) {
        mappings.responsibleDepartment = 'PMC Solid Waste Management Division';
        mappings.department = 'PMC Public Hygiene Board';
      } else if (cat.includes('water') || cat.includes('sewer') || cat.includes('drain')) {
        mappings.responsibleDepartment = 'PMC Water Supply Department';
        mappings.department = 'PMC Drain Repair Division';
      }
    }
    // 3. Bengaluru
    else if (c.includes('bengaluru') || c.includes('bangalore')) {
      mappings.wardOffice = 'Indiranagar Ward, East Zone, BBMP';
      mappings.escalationAuthority = 'Zonal Joint Commissioner (East Zone) BBMP';
      mappings.escalationContact = 'jc.east@bbmp.gov.in';
      if (cat.includes('road')) {
        mappings.responsibleDepartment = 'BBMP Major Roads Wing';
        mappings.department = 'BBMP Road Maintenance Cell';
      } else if (cat.includes('waste') || cat.includes('sanitation')) {
        mappings.responsibleDepartment = 'BBMP Solid Waste Management (SWM)';
        mappings.department = 'BBMP Garbage Management Desk';
      } else if (cat.includes('water') || cat.includes('sewer') || cat.includes('drain')) {
        mappings.responsibleDepartment = 'BWSSB Hydraulic Maintenance Board';
        mappings.department = 'BWSSB Indiranagar Sub-division';
      }
    }
    // 4. Hyderabad
    else if (c.includes('hyderabad')) {
      mappings.wardOffice = 'Circle 10 (Khairatabad), Zone IV GHMC';
      mappings.escalationAuthority = 'Zonal Commissioner (Khairatabad Zone) GHMC';
      mappings.escalationContact = 'zc.khairatabad@ghmc.gov.in';
      if (cat.includes('road')) {
        mappings.responsibleDepartment = 'GHMC Projects and Roads Department';
        mappings.department = 'GHMC Road Maintenance Wing';
      } else if (cat.includes('waste') || cat.includes('sanitation')) {
        mappings.responsibleDepartment = 'GHMC Solid Waste Management Division';
        mappings.department = 'GHMC Sanitation Section';
      } else if (cat.includes('water') || cat.includes('sewer') || cat.includes('drain')) {
        mappings.responsibleDepartment = 'HMWSSB Water and Sewerage Division';
        mappings.department = 'HMWSSB Khairatabad Desk';
      }
    }
    // 5. Chennai
    else if (c.includes('chennai') || c.includes('madras')) {
      mappings.wardOffice = 'Zone 5 (Royapuram), GCC';
      mappings.escalationAuthority = 'Regional Joint Commissioner (North) GCC';
      mappings.escalationContact = 'rjc.north@chennaicorporation.gov.in';
      if (cat.includes('road')) {
        mappings.responsibleDepartment = 'GCC Bus Route Roads Division';
        mappings.department = 'GCC Road Infrastructure Maintenance';
      } else if (cat.includes('waste') || cat.includes('sanitation')) {
        mappings.responsibleDepartment = 'GCC Solid Waste Management Wing';
        mappings.department = 'GCC Sanitation Cell';
      } else if (cat.includes('water') || cat.includes('sewer') || cat.includes('drain')) {
        mappings.responsibleDepartment = 'CMWSSB Drainage Wing';
        mappings.department = 'CMWSSB Royapuram Desk';
      }
    }
    // 6. Ahmedabad
    else if (c.includes('ahmedabad')) {
      mappings.wardOffice = 'West Zone Office, AMC';
      mappings.escalationAuthority = 'Deputy Municipal Commissioner (West Zone) AMC';
      mappings.escalationContact = 'dycomm.west@ahmedabadcity.gov.in';
      if (cat.includes('road')) {
        mappings.responsibleDepartment = 'AMC Road Project Wing';
        mappings.department = 'AMC Highway Maintenance Division';
      } else if (cat.includes('waste') || cat.includes('sanitation')) {
        mappings.responsibleDepartment = 'AMC Solid Waste Management';
        mappings.department = 'AMC Cleanliness Control Department';
      } else if (cat.includes('water') || cat.includes('sewer') || cat.includes('drain')) {
        mappings.responsibleDepartment = 'AMC Water Resources Wing';
        mappings.department = 'AMC Sewer and Drain Maintenance';
      }
    }
    // 7. Kolkata
    else if (c.includes('kolkata') || c.includes('calcutta')) {
      mappings.wardOffice = 'Borough VII, District II, KMC';
      mappings.escalationAuthority = 'Borough Chairman (Borough VII) KMC';
      mappings.escalationContact = 'borough7@kmcgov.in';
      if (cat.includes('road')) {
        mappings.responsibleDepartment = 'KMC Roads & Asphaltum Department';
        mappings.department = 'KMC Road Construction & Repairs';
      } else if (cat.includes('waste') || cat.includes('sanitation')) {
        mappings.responsibleDepartment = 'KMC Solid Waste Department';
        mappings.department = 'KMC Garbage Removal Cell';
      } else if (cat.includes('water') || cat.includes('sewer') || cat.includes('drain')) {
        mappings.responsibleDepartment = 'KMC Water Supply Wing';
        mappings.department = 'KMC Sewerage and Drainage Desk';
      }
    }
    // 8. Delhi
    else if (c.includes('delhi')) {
      mappings.wardOffice = 'Karol Bagh Zone Office, MCD';
      mappings.escalationAuthority = 'Deputy Commissioner (Karol Bagh Zone) MCD';
      mappings.escalationContact = 'dc.karolbagh@mcd.nic.in';
      if (cat.includes('road')) {
        mappings.responsibleDepartment = 'MCD Engineering Department (Roads)';
        mappings.department = 'MCD Road Maintenance Cell';
      } else if (cat.includes('waste') || cat.includes('sanitation')) {
        mappings.responsibleDepartment = 'MCD DEMS (Sanitation)';
        mappings.department = 'MCD Public Health Division';
      } else if (cat.includes('water') || cat.includes('sewer') || cat.includes('drain')) {
        mappings.responsibleDepartment = 'Delhi Jal Board (DJB) Drainage Section';
        mappings.department = 'DJB West Division Desk';
      }
    }

    return mappings;
  }
}

