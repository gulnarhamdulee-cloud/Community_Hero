import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface AutoAssignmentResult {
  assignedDepartment: string;
  assignedOfficerId: string;
  assignedOfficerName: string;
  estimatedResolutionTime: string;
}

/**
 * Automatically determines department, officer, and estimated resolution SLA 
 * based on category, severity, city, and ward.
 */
export async function getAutoAssignment(
  category: string,
  severity: string,
  city: string,
  ward: string
): Promise<AutoAssignmentResult> {
  const cat = (category || '').toLowerCase();
  const sev = (severity || '').toLowerCase();
  
  // 1. Determine department and officer designation based on rules
  let targetDesignation = "Road Maintenance Officer";
  let assignedDepartment = "Road Infrastructure & Traffic Wing";

  if (cat.includes("pothole") || cat.includes("road") || cat.includes("traffic")) {
    targetDesignation = "Road Maintenance Officer";
    assignedDepartment = "Road Infrastructure & Traffic Wing";
  } else if (cat.includes("garbage") || cat.includes("waste") || cat.includes("trash") || cat.includes("hygiene") || cat.includes("sanitation")) {
    targetDesignation = "Solid Waste Officer";
    assignedDepartment = "Solid Waste Management (SWM)";
  } else if (cat.includes("light") || cat.includes("electric") || cat.includes("power") || cat.includes("illumination") || cat.includes("streetlight")) {
    targetDesignation = "Electrical Officer";
    assignedDepartment = "Electrical Public Lighting Wing";
  } else if (cat.includes("water") || cat.includes("leak") || cat.includes("drain") || cat.includes("sewer") || cat.includes("piping")) {
    targetDesignation = "Water Supply Officer";
    assignedDepartment = "Sewerage & Hydraulic Engineering Division";
  } else {
    targetDesignation = "Road Maintenance Officer";
    assignedDepartment = "Road Infrastructure & Traffic Wing";
  }

  // 2. Determine estimated resolution time based on severity
  let estimatedResolutionTime = "48-72 Hours";
  if (sev.includes("critical")) {
    estimatedResolutionTime = "12-24 Hours";
  } else if (sev.includes("severe") || sev.includes("high")) {
    estimatedResolutionTime = "24-48 Hours";
  } else if (sev.includes("moderate") || sev.includes("medium")) {
    estimatedResolutionTime = "48-72 Hours";
  } else if (sev.includes("low")) {
    estimatedResolutionTime = "72+ Hours";
  }

  // 3. Query Firestore officers to find the best match
  let assignedOfficerId = "";
  let assignedOfficerName = "";

  try {
    const querySnapshot = await getDocs(collection(db, 'officers'));
    const officers = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as any[];

    // Filter officers that match the city
    const cityOfficers = officers.filter(o => o.city && o.city.toLowerCase() === city.toLowerCase());

    const cleanWard = (ward || "").toLowerCase();

    // Level 1 search: Match city + ward + department/designation
    let matchedOfficer = cityOfficers.find(o => {
      const oWard = (o.ward || "").toLowerCase();
      const oDept = (o.department || "").toLowerCase();
      const oDesg = (o.designation || "").toLowerCase();
      
      const wardMatch = oWard.includes(cleanWard) || cleanWard.includes(oWard);
      const roleMatch = oDept.includes(assignedDepartment.toLowerCase().split(' ')[0]) || 
                        oDesg.includes(targetDesignation.toLowerCase().split(' ')[0]);
      
      return wardMatch && roleMatch;
    });

    // Level 2 search: Match city + department/designation (city-wide)
    if (!matchedOfficer) {
      matchedOfficer = cityOfficers.find(o => {
        const oDept = (o.department || "").toLowerCase();
        const oDesg = (o.designation || "").toLowerCase();
        return oDept.includes(assignedDepartment.toLowerCase().split(' ')[0]) || 
               oDesg.includes(targetDesignation.toLowerCase().split(' ')[0]);
      });
    }

    // Level 3 search: Match city + ward (general ward officer)
    if (!matchedOfficer) {
      matchedOfficer = cityOfficers.find(o => {
        const oWard = (o.ward || "").toLowerCase();
        return oWard.includes(cleanWard) || cleanWard.includes(oWard);
      });
    }

    // Level 4 search: Match any officer in the same city
    if (!matchedOfficer && cityOfficers.length > 0) {
      matchedOfficer = cityOfficers[0];
    }

    if (matchedOfficer) {
      assignedOfficerId = matchedOfficer.uid;
      assignedOfficerName = matchedOfficer.name;
    } else {
      // Dynamic fallback if no officers exist in this city/system yet
      assignedOfficerId = "simulated-officer-id";
      assignedOfficerName = `Ward Officer (${targetDesignation})`;
    }
  } catch (e) {
    console.error("Error matching officer from firestore:", e);
    assignedOfficerId = "simulated-officer-id";
    assignedOfficerName = `Ward Officer (${targetDesignation})`;
  }

  return {
    assignedDepartment,
    assignedOfficerId,
    assignedOfficerName,
    estimatedResolutionTime
  };
}
