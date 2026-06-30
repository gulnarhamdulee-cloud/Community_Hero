import { CivicAgent } from './AgentTypes';
import { AgentContext } from './AgentContext';

export class DraftingAgent implements CivicAgent {
  name = 'Drafting Agent';

  async execute(context: AgentContext): Promise<AgentContext> {
    const updatedContext = { ...context };

    updatedContext.executionLog = [
      ...(updatedContext.executionLog || []),
      `📝 [Drafting Agent] Commencing multi-perspective civic drafting engine...`
    ];

    const category = updatedContext.category || 'General Civic Infrastructure';
    const subCat = updatedContext.subCategory || 'General Amenity Defect';
    const city = updatedContext.location?.city || 'Bengaluru';
    const dept = updatedContext.department || 'Municipal Division';
    const desc = updatedContext.description;
    const severity = updatedContext.severity || 'Moderate';

    try {
      const statePayload = {
        userDescription: desc,
        city: city,
        address: updatedContext.location?.address || 'Unknown Locality',
        classification: {
          category,
          subCategory: subCat
        },
        severity: {
          severityLevel: severity
        },
        routing: {
          department: dept,
          municipalCorporation: updatedContext.municipalCorporation,
          wardOffice: updatedContext.wardOffice,
          escalationAuthority: updatedContext.escalationAuthority,
          sla: updatedContext.sla
        }
      };

      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: 'DraftingAgent',
          state: statePayload
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status} ${response.statusText}`);
      }

      const parsedData = await response.json();

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Invalid or empty response from drafting execution endpoint');
      }

      const subject = parsedData.subject || `Urgent: Public safety hazard due to unresolved ${subCat.toLowerCase()} in ${city}`;
      const complaintDraftEnglish = parsedData.complaintDraftEnglish || this.getFallbackEnglishDraft(city, dept, subCat, desc, severity);
      const complaintDraftHindi = parsedData.complaintDraftHindi || this.getFallbackHindiDraft(city, dept, subCat, desc, severity);
      const rtiEscalationDraft = parsedData.rtiEscalationDraft || this.getFallbackRtiDraft(city, subCat);
      const citizenSummary = parsedData.citizenSummary || this.getFallbackCitizenSummary(city, subCat);

      updatedContext.complaintDraft = {
        subject,
        complaintDraftEnglish,
        complaintDraftHindi,
        rtiEscalationDraft,
        citizenSummary
      };

      updatedContext.executionLog.push(`📝 [Drafting Agent] Authoritative English & Devanagari Hindi drafts compiled successfully.`);
      updatedContext.executionLog.push(`📝 [Drafting Agent] Citizen Empowerment Summary and RTI Escalation package successfully prepared.`);

      return updatedContext;

    } catch (error: any) {
      const errMsg = error.message || 'Unknown error during Drafting Agent execution.';
      console.warn(`[Drafting Agent] API Execution failed, using offline template fallbacks:`, errMsg);

      updatedContext.executionLog.push(
        `⚠️ [Drafting Agent] Drafting API failed (${errMsg}). Activating offline fallback templates...`
      );

      const subject = `Urgent: Public safety hazard due to unresolved ${subCat.toLowerCase()} in ${city}`;
      const complaintDraftEnglish = this.getFallbackEnglishDraft(city, dept, subCat, desc, severity);
      const complaintDraftHindi = this.getFallbackHindiDraft(city, dept, subCat, desc, severity);
      const rtiEscalationDraft = this.getFallbackRtiDraft(city, subCat);
      const citizenSummary = this.getFallbackCitizenSummary(city, subCat);

      updatedContext.complaintDraft = {
        subject,
        complaintDraftEnglish,
        complaintDraftHindi,
        rtiEscalationDraft,
        citizenSummary
      };

      updatedContext.executionLog.push(`📝 [Drafting Agent] Offline bilingual sheets and RTI packages bundled into context.`);
      return updatedContext;
    }
  }

  private getFallbackEnglishDraft(city: string, dept: string, subCat: string, desc: string, severity: string): string {
    return `To,
The Ward Executive Engineer,
${dept},
Municipal Corporation of ${city}.

Subject: Urgent Complaint Regarding Unresolved Public safety hazard (${subCat}) in ${city}

Dear Sir/Madam,

I am writing to draw your urgent attention to a severe civic issue regarding "${subCat}" located in ${city}.

The issue can be described as follows:
"${desc}"

This matter has been evaluated with a risk severity level of ${severity.toUpperCase()} due to potential pedestrian hazards and community inconvenience. Adequate safety measures have not been established at the spot.

Kindly direct the concerned ward inspectorial officers to resolve this defect on high priority under the municipal service level charter.

Thanking you,
Yours faithfully,
Concerned Citizen of ${city}
(Generated via Community Hero Civic Platform)`;
  }

  private getFallbackHindiDraft(city: string, dept: string, subCat: string, desc: string, severity: string): string {
    return `सेवा में,
वार्ड कार्यकारी अभियंता,
${dept},
${city} नगर निगम।

विषय: ${subCat} के संबंध में त्वरित शिकायत

महोदय/महोदया,

मैं इस पत्र के माध्यम से ${city} में स्थित "${subCat}" से संबंधित एक गंभीर नागरिक समस्या की ओर आपका ध्यान आकर्षित करना चाहता हूँ।

समस्या का विवरण इस प्रकार है:
"${desc}"

इस समस्या को ${severity.toUpperCase() === 'SEVERE' || severity.toUpperCase() === 'CRITICAL' || severity.toUpperCase() === 'HIGH' ? 'अत्यंत गंभीर' : 'मध्यम'} माना गया है क्योंकि इससे दुर्घटना की प्रबल आशंका और स्थानीय जनता को भारी असुविधा हो रही है।

आपसे विनम्र अनुरोध है कि नागरिक सेवा चार्टर के तहत इस शिकायत पर संज्ञान लेते हुए संबंधित विभाग को त्वरित कार्रवाई करने का निर्देश दें।

सधन्यवाद,
जागरूक नागरिक, ${city}
(कम्युनिटी हीरो प्लेटफॉर्म द्वारा ऑटो-जनरेटेड)`;
  }

  private getFallbackRtiDraft(city: string, subCat: string): string {
    return `FORM 'A'
Form of Application for seeking information under Section 6(1) of the RTI Act, 2005

To,
The Public Information Officer (PIO),
Municipal Corporation of ${city}

1. Name of the Applicant: Concerned Citizen / Resident
2. Address: As specified in local complaint coordinates
3. Particulars of Information required:
   Regarding unresolved grievance of "${subCat}" in Ward/Division.
   Please provide the following information:
   a. Provide certified copies of all inspection reports, site logs, and supervisor notes recorded for this location during the current financial year.
   b. Details of the budget allocated, sanctioned, and disbursed for road/sanitation maintenance and repair works in this specific ward in the current budget.
   c. Certified copy of the work order, agreement, and tender details issued to the contractor responsible for maintaining the infrastructure at this location.
   d. The standard timeframe (SLA) allowed under the Citizen Charter for resolving such civic defects and the penalties leviable on the contractor/officers for delay.
4. I state that the information sought does not fall within the restrictions contained in Section 8 of the RTI Act 2005 and to the best of my knowledge it pertains to your office.
5. A fee of Rs. 10/- has been deposited (will be paid via Postal Order/Court Fee Stamp upon physical filing).

Place: ${city}
Date: ${new Date().toLocaleDateString()}`;
  }

  private getFallbackCitizenSummary(city: string, subCat: string): string {
    return `### Citizen Empowerment Summary
Under the Municipal Corporation Act, the local municipality is legally bound and obligated to maintain safe, hygienic, and defect-free public paths and infrastructure for all residents.

#### Your Rights & Entitlements:
- **Right to Safe Passageways**: Safe streets and disease-free environments are core components of the Right to Life guaranteed under Article 21 of the Constitution.
- **Service Charter Guarantees**: Municipal citizen charters mandate that public complaints of this nature must be inspected within 48 hours and resolved within the stipulated SLA days.

#### Strategic Action Plan:
1. **Submit formal complaint**: File the generated English or Hindi complaint draft directly on your city's official grievance web portal (such as BBMP Sahaya, Delhi MCD App, or BMC PG Portal).
2. **Obtain acknowledgement receipt**: Keep the unique complaint ticket ID safe.
3. **Trigger Escalation (Wait 7 Days)**: If the issue is not resolved within the SLA timeline, file the attached RTI application to the Public Information Officer (PIO) to demand contractor details and budget utilization files, which often expedites immediate ground action!`;
  }
}
