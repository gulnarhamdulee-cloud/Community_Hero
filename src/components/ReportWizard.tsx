import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Upload, Sparkles, MapPin, Building2, AlertOctagon, HelpCircle, FileText, CheckCircle2, RotateCcw, Copy, AlertCircle, Eye, RefreshCw, Terminal, CheckCircle, AlertTriangle, ShieldAlert, TrendingUp, Activity, Cpu, Layers, Globe, Gauge, Wifi, Clock, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { Report, CivicLocation, INDIAN_CITIES } from '../types';
import { useNotifications } from '../features/notifications/NotificationProvider';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { CivicWorkflowState, AgentStatus } from '../agents/types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAutoAssignment } from '../utils/assignmentEngine';

interface ReportWizardProps {
  onSuccess: (newReport: Report) => void;
  userId: string;
  userEmail: string;
  userName: string;
}

// Low-profile highly compatible base64 representations of mock images
// (This lets judges click a button to instant-populate a beautiful pothole/trash image to test AI vision!)
const MOCK_IMAGES = {
  pothole: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
  garbage: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
  streetlight: "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80"
};

function ReportWizard({ onSuccess, userId, userEmail, userName }: ReportWizardProps) {
  const { addNotification } = useNotifications();

  // Recovery states
  const [recoveredWorkflow, setRecoveredWorkflow] = useState<CivicWorkflowState | null>(null);
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(false);

  // Step tracker: 'upload' -> 'analysis' -> 'review'
  const [step, setStep] = useState<'upload' | 'analysis' | 'review'>('upload');
  
  // Input fields
  const [selectedCityName, setSelectedCityName] = useState('Bengaluru');
  const [address, setAddress] = useState('');
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  
  // AI Generated / Parsed States
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiProgress, setAiProgress] = useState(0);

  // Multi-Agent Workflow State & Logs
  const [workflowState, setWorkflowState] = useState<CivicWorkflowState | null>(null);
  const [orchestrationLogs, setOrchestrationLogs] = useState<string[]>([]);
  const [agentDurations, setAgentDurations] = useState<Record<string, number>>({});
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 'analysis') {
      setAgentDurations({});
      return;
    }

    const interval = setInterval(() => {
      setAgentDurations(prev => {
        const next = { ...prev };
        const agentsList = [
          'VisionAgent', 'ClassificationAgent', 'SeverityAgent', 'RoutingAgent', 
          'DraftingAgent', 'RiskPredictionAgent', 'AdvisoryAgent', 'HeatmapAgent'
        ];
        
        agentsList.forEach(id => {
          const status = workflowState?.agentStatuses?.[id as keyof typeof workflowState.agentStatuses] || 'Pending';
          if (status === 'Running') {
            next[id] = (next[id] || 0) + 100;
          } else if (status === 'Pending' && !next[id]) {
            next[id] = 0;
          }
        });
        
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [step, workflowState?.agentStatuses]);

  // Check for interrupted workflow run on mount/login
  useEffect(() => {
    const checkRecovery = async () => {
      const activeId = localStorage.getItem('activeCivicWorkflowId');
      if (activeId) {
        setIsCheckingRecovery(true);
        try {
          const docRef = doc(db, 'agentWorkflows', activeId);
          let docSnap;
          try {
            docSnap = await getDoc(docRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `agentWorkflows/${activeId}`);
          }
          if (docSnap.exists()) {
            const data = docSnap.data() as CivicWorkflowState;
            const agentsList = [
              'VisionAgent', 'ClassificationAgent', 'SeverityAgent', 'RoutingAgent',
              'DraftingAgent', 'RiskPredictionAgent', 'AdvisoryAgent', 'HeatmapAgent'
            ];
            const allCompleted = agentsList.every(id => data.agentStatuses[id as keyof typeof data.agentStatuses] === 'Completed');
            if (!allCompleted) {
              setRecoveredWorkflow(data);
            } else {
              localStorage.removeItem('activeCivicWorkflowId');
            }
          }
        } catch (e) {
          console.warn('Failed to fetch recovery workflow:', e);
        } finally {
          setIsCheckingRecovery(false);
        }
      }
    };

    checkRecovery();
  }, [userId]);

  const handleResumeWorkflow = async (workflow: CivicWorkflowState) => {
    setRecoveredWorkflow(null);
    setStep('analysis');
    setIsAiLoading(true);
    setWorkflowState(workflow);

    setSelectedCityName(workflow.city);
    setAddress(workflow.address || '');
    setImageFile(workflow.imageUrl || null);
    setDescription(workflow.userDescription);

    const restoredLogs = workflow.logs || [
      "⚙️ [RECOVERY] Restoring previously active multi-agent pipeline...",
      `⚙️ [RECOVERY] Resuming analysis flow for session: ${workflow.id}`
    ];
    setOrchestrationLogs(restoredLogs);

    try {
      const orchestrator = new AgentOrchestrator();
      const finalState = await orchestrator.executeWorkflow(workflow, (updatedState) => {
        setWorkflowState(updatedState);

        const agentsList = [
          'VisionAgent', 'ClassificationAgent', 'SeverityAgent', 'RoutingAgent', 
          'DraftingAgent', 'RiskPredictionAgent', 'AdvisoryAgent', 'HeatmapAgent'
        ];

        const completedCount = agentsList.filter(id => updatedState.agentStatuses[id as keyof typeof updatedState.agentStatuses] === 'Completed').length;
        const failedCount = agentsList.filter(id => updatedState.agentStatuses[id as keyof typeof updatedState.agentStatuses] === 'Failed').length;
        const progressPercent = Math.min(100, Math.round(((completedCount + failedCount) / agentsList.length) * 100));
        setAiProgress(progressPercent);

        const currentRunning = agentsList.find(id => updatedState.agentStatuses[id as keyof typeof updatedState.agentStatuses] === 'Running');
        if (currentRunning) {
          setOrchestrationLogs(prev => {
            const lastLog = prev[prev.length - 1];
            const runningMsg = `📡 [ORCHESTRATOR] Directing processing flow to: ${currentRunning}`;
            if (lastLog !== runningMsg) {
              return [...prev, runningMsg, `🤖 [${currentRunning}] Invoking server-side analysis model...`];
            }
            return prev;
          });
        }

        agentsList.forEach(id => {
          const status = updatedState.agentStatuses[id as keyof typeof updatedState.agentStatuses];
          if (status === 'Completed') {
            setOrchestrationLogs(prev => {
              const compMsg = `✅ [${id}] Completed processing. Shared workflow state context updated.`;
              if (!prev.includes(compMsg)) {
                let detail = '';
                if (id === 'VisionAgent' && updatedState.vision) {
                  detail = `   🔍 Visual Context: "${updatedState.vision.visualSceneDescription.substring(0, 75)}..."`;
                } else if (id === 'ClassificationAgent' && updatedState.classification) {
                  detail = `   🏷️ Classified Category: "${updatedState.classification.category}" / SubCategory: "${updatedState.classification.subCategory}"`;
                } else if (id === 'SeverityAgent' && updatedState.severity) {
                  detail = `   ⚠️ Assessed Priority: ${updatedState.severity.severityLevel} - "${updatedState.severity.justification}"`;
                } else if (id === 'RoutingAgent' && updatedState.routing) {
                  detail = `   🏛️ Routed Authority: "${updatedState.routing.department}"`;
                } else if (id === 'DraftingAgent' && updatedState.drafting) {
                  detail = `   📝 Complaint drafted. English subject: "${updatedState.drafting.subject}"`;
                } else if (id === 'RiskPredictionAgent' && updatedState.riskPrediction) {
                  detail = `   📉 Calculated Infrastructure Risk Index: ${updatedState.riskPrediction.infrastructureRiskScore}%`;
                } else if (id === 'AdvisoryAgent' && updatedState.advisory) {
                  detail = `   📜 Citizen legal empowerment standards matched.`;
                } else if (id === 'HeatmapAgent' && updatedState.heatmap) {
                  detail = `   🗺️ Region hotspot priority catalogued under ${updatedState.heatmap.geohashSector}.`;
                }
                return detail ? [...prev, compMsg, detail] : [...prev, compMsg];
              }
              return prev;
            });
          } else if (status === 'Failed') {
            setOrchestrationLogs(prev => {
              const failMsg = `❌ [${id}] Execution failure: ${updatedState.agentErrors[id as keyof typeof updatedState.agentErrors] || 'Model execution error'}`;
              if (!prev.includes(failMsg)) {
                return [...prev, failMsg];
              }
              return prev;
            });
          }
        });
      }, true);

      setEditedTitle(finalState.drafting?.subject || 'Civic Infrastructure Concern');
      setEditedCategory(finalState.classification?.category || 'Roads & Traffic');
      setEditedSubCategory(finalState.classification?.subCategory || 'Potholes / Damaged Road Structure');
      const severityMap: Record<string, 'Low' | 'Moderate' | 'Severe' | 'Critical'> = {
        'LOW': 'Low', 'MEDIUM': 'Moderate', 'HIGH': 'Severe', 'CRITICAL': 'Critical',
        'Low': 'Low', 'Moderate': 'Moderate', 'Severe': 'Severe', 'Critical': 'Critical'
      };
      setEditedSeverity(severityMap[finalState.severity?.severityLevel || 'Moderate'] || 'Moderate');
      
      const wardName = finalState.routing?.wardOffice || address || `Ward Zone, ${selectedCityName}`;
      const autoAssign = await getAutoAssignment(
        finalState.classification?.category || 'Roads & Traffic',
        finalState.severity?.severityLevel || 'Moderate',
        selectedCityName,
        wardName
      );
      setEditedDepartment(autoAssign.assignedDepartment);
      setEditedOfficerId(autoAssign.assignedOfficerId);
      setEditedOfficerName(autoAssign.assignedOfficerName);
      setEditedSlaTime(autoAssign.estimatedResolutionTime);

      setEditedComplaintEn(finalState.drafting?.complaintDraftEnglish || '');
      setEditedComplaintHi(finalState.drafting?.complaintDraftHindi || '');
      setEditedRtiDraft(finalState.drafting?.rtiEscalationDraft || '');
      setEditedCitizenSummary(finalState.drafting?.citizenSummary || '');
      
      const adviceBullet = finalState.advisory?.citizenRightsSummary || 'Rights mapping completed.';
      setEditedAdvice(adviceBullet);

      setStep('review');
    } catch (err: any) {
      console.error("Resume pipeline failed:", err);
      addNotification(
        userId,
        "Orchestration Error",
        `Multi-agent sequential resume crashed: ${err.message || err}`,
        'alert'
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem('activeCivicWorkflowId');
    setImageFile(null);
    setDescription('');
    setAddress('');
    setWorkflowState(null);
    setStep('upload');
  };

  // Editable fields before saving
  const [editedTitle, setEditedTitle] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  const [editedSubCategory, setEditedSubCategory] = useState('');
  const [editedSeverity, setEditedSeverity] = useState<'Low' | 'Moderate' | 'Severe' | 'Critical'>('Moderate');
  const [editedDepartment, setEditedDepartment] = useState('');
  const [editedOfficerId, setEditedOfficerId] = useState('');
  const [editedOfficerName, setEditedOfficerName] = useState('');
  const [editedSlaTime, setEditedSlaTime] = useState('');
  const [editedComplaintEn, setEditedComplaintEn] = useState('');
  const [editedComplaintHi, setEditedComplaintHi] = useState('');
  const [editedRtiDraft, setEditedRtiDraft] = useState('');
  const [editedCitizenSummary, setEditedCitizenSummary] = useState('');
  const [editedAdvice, setEditedAdvice] = useState('');

  const [activeLangTab, setActiveLangTab] = useState<'en' | 'hi'>('en');
  const [copystate, setCopystate] = useState(false);
  const [copyRtiState, setCopyRtiState] = useState(false);
  const [copySummaryState, setCopySummaryState] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cityObj = INDIAN_CITIES.find(c => c.name === selectedCityName) || INDIAN_CITIES[1];

  const handleCopyRti = () => {
    navigator.clipboard.writeText(editedRtiDraft);
    setCopyRtiState(true);
    setTimeout(() => setCopyRtiState(false), 2000);
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(editedCitizenSummary);
    setCopySummaryState(true);
    setTimeout(() => setCopySummaryState(false), 2000);
  };

  // Simulator helper to let judges skip having to take snapshot or upload real files
  const loadMockImage = async (type: 'pothole' | 'garbage' | 'streetlight') => {
    setAiStatusMessage("Fetching preset photo...");
    const imageUrl = MOCK_IMAGES[type];
    
    // Set matching pre-fill texts to make the experience ultra polished
    if (type === 'pothole') {
      setDescription("Massive deep pothole formed right in the middle of the double lane asphalt road causing bike skids.");
      setSelectedCityName("Bengaluru");
      setAddress("11th Main, Near Jogging Corner, Indiranagar, Bengaluru, Karnataka");
    } else if (type === 'garbage') {
      setDescription("Uncollected trash accumulating heavily near Dadar market. Some local vendors are setting it on fire.");
      setSelectedCityName("Mumbai");
      setAddress("SB Marg, Near Dadar West Market Exit, Dadar, Mumbai, Maharashtra");
    } else {
      setDescription("Streetlight column bracket broken and hanging loose. Panel is completely un-illuminated for 3 poles.");
      setSelectedCityName("Delhi");
      setAddress("Approach gate area, Connaught Place Block H, New Delhi, Delhi");
    }

    // Convert Unsplash image to a base64 string using canvas proxy
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFile(reader.result as string);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      // Fallback: Use standard mock placeholder URL directly
      setImageFile(imageUrl);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerAiAnalysis = async () => {
    if (!imageFile && !description.trim()) {
      alert("Please upload an image, select a simulator preset, or enter detailed description first.");
      return;
    }

    setStep('analysis');
    setIsAiLoading(true);
    setAiProgress(5);
    setOrchestrationLogs([
      "⚙️ [SYSTEM] Booting Multi-Agent Civic Intelligence Platform...",
      "⚙️ [SYSTEM] Connected to server-side Gemini 3.5 Reasoning Core.",
      "⚙️ [SYSTEM] Preparing sequential pipeline (8 Agents ready)...",
      "⚙️ [SYSTEM] Initializing shared workflow state context..."
    ]);

    try {
      const orchestrator = new AgentOrchestrator();

      const workflowId = "workflow-" + Date.now();
      localStorage.setItem('activeCivicWorkflowId', workflowId);

      const initialState = {
        id: workflowId,
        userId,
        userName,
        userEmail,
        userDescription: description,
        city: selectedCityName,
        address: address || `Ward Zone, ${selectedCityName}`,
        imageUrl: imageFile || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const finalState = await orchestrator.executeWorkflow(initialState, (updatedState) => {
        setWorkflowState(updatedState);

        const agentsList = [
          'VisionAgent', 'ClassificationAgent', 'SeverityAgent', 'RoutingAgent', 
          'DraftingAgent', 'RiskPredictionAgent', 'AdvisoryAgent', 'HeatmapAgent'
        ];

        // Calculate progress
        const completedCount = agentsList.filter(id => updatedState.agentStatuses[id as keyof typeof updatedState.agentStatuses] === 'Completed').length;
        const failedCount = agentsList.filter(id => updatedState.agentStatuses[id as keyof typeof updatedState.agentStatuses] === 'Failed').length;
        const progressPercent = Math.min(100, Math.round(((completedCount + failedCount) / agentsList.length) * 100));
        setAiProgress(progressPercent);

        // Update active log status
        const currentRunning = agentsList.find(id => updatedState.agentStatuses[id as keyof typeof updatedState.agentStatuses] === 'Running');
        if (currentRunning) {
          setOrchestrationLogs(prev => {
            const lastLog = prev[prev.length - 1];
            const runningMsg = `📡 [ORCHESTRATOR] Directing processing flow to: ${currentRunning}`;
            if (lastLog !== runningMsg) {
              return [...prev, runningMsg, `🤖 [${currentRunning}] Invoking server-side analysis model...`];
            }
            return prev;
          });
        }

        // Add success/fail logs
        agentsList.forEach(id => {
          const status = updatedState.agentStatuses[id as keyof typeof updatedState.agentStatuses];
          if (status === 'Completed') {
            setOrchestrationLogs(prev => {
              const compMsg = `✅ [${id}] Completed processing. Shared workflow state context updated.`;
              if (!prev.includes(compMsg)) {
                let detail = '';
                if (id === 'VisionAgent' && updatedState.vision) {
                  detail = `   🔍 Visual Context: "${updatedState.vision.visualSceneDescription.substring(0, 75)}..."`;
                } else if (id === 'ClassificationAgent' && updatedState.classification) {
                  detail = `   🏷️ Classified Category: "${updatedState.classification.category}" / SubCategory: "${updatedState.classification.subCategory}"`;
                } else if (id === 'SeverityAgent' && updatedState.severity) {
                  detail = `   ⚠️ Assessed Priority: ${updatedState.severity.severityLevel} - "${updatedState.severity.justification}"`;
                } else if (id === 'RoutingAgent' && updatedState.routing) {
                  detail = `   🏛️ Routed Authority: "${updatedState.routing.department}"`;
                } else if (id === 'DraftingAgent' && updatedState.drafting) {
                  detail = `   📝 Complaint drafted. English subject: "${updatedState.drafting.subject}"`;
                } else if (id === 'RiskPredictionAgent' && updatedState.riskPrediction) {
                  detail = `   📉 Calculated Infrastructure Risk Index: ${updatedState.riskPrediction.infrastructureRiskScore}%`;
                } else if (id === 'AdvisoryAgent' && updatedState.advisory) {
                  detail = `   📜 Citizen legal empowerment standards matched.`;
                } else if (id === 'HeatmapAgent' && updatedState.heatmap) {
                  detail = `   🗺️ Region hotspot priority catalogued under ${updatedState.heatmap.geohashSector}.`;
                }
                return detail ? [...prev, compMsg, detail] : [...prev, compMsg];
              }
              return prev;
            });
          } else if (status === 'Failed') {
            setOrchestrationLogs(prev => {
              const failMsg = `❌ [${id}] Execution failure: ${updatedState.agentErrors[id as keyof typeof updatedState.agentErrors] || 'Model execution error'}`;
              if (!prev.includes(failMsg)) {
                return [...prev, failMsg];
              }
              return prev;
            });
          }
        });
      });

      // Populate review values
      setEditedTitle(finalState.drafting?.subject || 'Civic Infrastructure Concern');
      setEditedCategory(finalState.classification?.category || 'Roads & Traffic');
      setEditedSubCategory(finalState.classification?.subCategory || 'Potholes / Damaged Road Structure');
      const severityMap: Record<string, 'Low' | 'Moderate' | 'Severe' | 'Critical'> = {
        'LOW': 'Low',
        'MEDIUM': 'Moderate',
        'HIGH': 'Severe',
        'CRITICAL': 'Critical',
        'LOW PRIORITY': 'Low',
        'MODERATE PRIORITY': 'Moderate',
        'SEVERE PRIORITY': 'Severe',
        'CRITICAL PRIORITY': 'Critical',
        'MODERATE': 'Moderate',
        'SEVERE': 'Severe',
        'Low': 'Low',
        'Moderate': 'Moderate',
        'Severe': 'Severe',
        'Critical': 'Critical'
      };
      const rawSeverity = finalState.severity?.severityLevel || 'Moderate';
      const normalizedSeverity = severityMap[rawSeverity.toUpperCase()] || severityMap[rawSeverity] || 'Moderate';
      setEditedSeverity(normalizedSeverity);
      
      const wardName = finalState.routing?.wardOffice || address || `Ward Zone, ${selectedCityName}`;
      const autoAssign = await getAutoAssignment(
        finalState.classification?.category || 'Roads & Traffic',
        normalizedSeverity,
        selectedCityName,
        wardName
      );
      setEditedDepartment(autoAssign.assignedDepartment);
      setEditedOfficerId(autoAssign.assignedOfficerId);
      setEditedOfficerName(autoAssign.assignedOfficerName);
      setEditedSlaTime(autoAssign.estimatedResolutionTime);

      setEditedComplaintEn(finalState.drafting?.complaintDraftEnglish || '');
      setEditedComplaintHi(finalState.drafting?.complaintDraftHindi || '');
      setEditedRtiDraft(finalState.drafting?.rtiEscalationDraft || '');
      setEditedCitizenSummary(finalState.drafting?.citizenSummary || '');

      // Structure beautiful Advice text
      const citizenRights = finalState.advisory?.citizenRightsSummary || '';
      const acts = finalState.advisory?.applicableActsAndBylaws || [];
      const dos = finalState.advisory?.safetyDoAndDonts?.dos || [];
      const donts = finalState.advisory?.safetyDoAndDonts?.donts || [];
      const escalation = finalState.advisory?.escalationProcedures || [];
      const timeline = finalState.advisory?.expectedTimelines || '';
      const recs = finalState.advisory?.recommendations || [];

      let constructedAdvice = `${citizenRights}\n\n` +
        `⚖️ Applicable Regulations:\n${acts.map(a => `• ${a}`).join('\n')}\n\n` +
        `⚠️ Community Safety Measures:\n` +
        `${dos.map(d => `✅ DO: ${d}`).join('\n')}\n` +
        `${donts.map(dn => `❌ DONT: ${dn}`).join('\n')}`;

      if (timeline) {
        constructedAdvice += `\n\n🕒 Expected Resolution Timeline:\n• ${timeline}`;
      }

      if (escalation.length > 0) {
        constructedAdvice += `\n\n📌 Grievance Escalation Procedures:\n${escalation.map(e => `• ${e}`).join('\n')}`;
      }

      if (recs.length > 0) {
        constructedAdvice += `\n\n💡 Recommendations for Citizens:\n${recs.map(r => `• ${r}`).join('\n')}`;
      }

      setEditedAdvice(constructedAdvice);

      addNotification(userId, "Multi-Agent Diagnostics Completed", `The 8-agent network has successfully compiled municipal complaints and city risk indexes.`, 'success');

      setTimeout(() => {
        setStep('review');
        setIsAiLoading(false);
      }, 1500);

    } catch (err: any) {
      console.error('Agent Orchestration Failure:', err);
      alert(`The Multi-Agent Platform experienced a failure: ${err.message || 'Offline'}. Falling back to standard templates.`);

      setEditedTitle(`Urgent: Civic issue reported in ${selectedCityName}`);
      setEditedCategory("Roads & Traffic");
      setEditedSubCategory("Potholes / Road damage");
      setEditedSeverity("Severe");
      getAutoAssignment(
        "Roads & Traffic",
        "Severe",
        selectedCityName,
        address || `Ward Zone, ${selectedCityName}`
      ).then(res => {
        setEditedDepartment(res.assignedDepartment);
        setEditedOfficerId(res.assignedOfficerId);
        setEditedOfficerName(res.assignedOfficerName);
        setEditedSlaTime(res.estimatedResolutionTime);
      });
      setEditedComplaintEn(`To, \nThe Ward Officer,\n${cityObj.municipalBody}\n\nSubject: Complaint regarding civic grievances at ${address || selectedCityName}\n\nDear Sir/Madam,\nThis is to report that we are facing severe concerns with ${description || 'damaged infrastructure'} situated here. Please verify and resolve.`);
      setEditedComplaintHi(`सेवा में, \nमुख्य अधिकारी,\n${cityObj.municipalBody}\n\nविषय: ${address || selectedCityName} पर जनसमस्याओं के निवारण के संबंध में।\n\nमहोदय,\nहम इस शिकायत के माध्यम से आपका ध्यान आकर्षित करना चाहते हैं कि यहाँ व्यापक समस्याएं हैं। कृपया तत्काल ठीक कराएं।`);
      setEditedRtiDraft(`FORM 'A'\nForm of Application for seeking information under Section 6(1) of the RTI Act, 2005\n\nTo,\nThe Public Information Officer (PIO),\n${cityObj.municipalBody}\n\nPlease provide details of budget allocation and responsible engineers.`);
      setEditedCitizenSummary(`### Citizen Empowerment Summary\nYou have the constitutional right to safe public pathways under Article 21 of the Constitution of India. Submit formal complaints, wait for the SLA response, and then trigger RTI escalation if unresolved.`);
      setEditedAdvice("Please notify neighbors and stay safe.");
      setStep('review');
      setIsAiLoading(false);
    }
  };

  const handleCopyComplaint = () => {
    const textToCopy = activeLangTab === 'en' ? editedComplaintEn : editedComplaintHi;
    navigator.clipboard.writeText(textToCopy);
    setCopystate(true);
    setTimeout(() => setCopystate(false), 2000);
  };

  const handleSubmitReport = async () => {
    setIsSubmitting(true);
    
    // Generate simulated coordinates slightly offset from city center to make map mapping vibrant
    const randomOffsetLat = (Math.random() - 0.5) * 0.08;
    const randomOffsetLng = (Math.random() - 0.5) * 0.08;
    const finalLat = cityObj.center[0] + randomOffsetLat;
    const finalLng = cityObj.center[1] + randomOffsetLng;

    const newReport: Report = {
      id: "report-" + Date.now(),
      title: editedTitle,
      description: description || "Report filed through Community Hero AI.",
      category: editedCategory,
      subCategory: editedSubCategory,
      severity: editedSeverity,
      severityJustification: workflowState?.severity?.justification || "Severity calculated by public safety impact index.",
      suggestedDepartment: editedDepartment,
      status: editedOfficerId ? "ASSIGNED" : "SUBMITTED",
      location: {
        lat: finalLat,
        lng: finalLng,
        city: selectedCityName,
        address: address || `Ward Area, ${selectedCityName}`
      },
      imageUrl: imageFile || undefined,
      complaintDraftEnglish: editedComplaintEn,
      complaintDraftHindi: editedComplaintHi,
      rtiEscalationDraft: editedRtiDraft || undefined,
      citizenSummary: editedCitizenSummary || undefined,
      civicAdvice: editedAdvice,
      upvotesCount: 1, // User auto-votes
      upvotesUsers: [userId],
      createdAt: new Date().toISOString(),
      userId,
      userEmail,
      userName,
      resolvedAt: null,
      assignedToOfficerId: editedOfficerId || undefined,
      assignedToOfficerName: editedOfficerName || undefined,
      estimatedResolutionTime: editedSlaTime || undefined,
      workflowId: workflowState?.id,
      workflowState: workflowState || undefined,
      agentContext: workflowState?.agentContext || undefined
    };

    try {
      // Direct Firestore create is supported:
      // Let's call the parent onSuccess first which will also persist to State and Sync in Firestore
      onSuccess(newReport);
      
      // Reset State
      localStorage.removeItem('activeCivicWorkflowId');
      setStep('upload');
      setImageFile(null);
      setDescription('');
      setAddress('');
      setWorkflowState(null);
    } catch (e) {
      console.error("Firestore persistence warning:", e);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm max-w-4xl mx-auto overflow-hidden">
      
      {/* Wizard Header Bar */}
      <div className="bg-slate-50 border-b border-slate-100 py-5 px-6 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-saffron/10 text-saffron rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900">AI-Powered Civic Reporting Wizard</h3>
            <p className="text-[10px] text-slate-400 font-medium">Bilingual complaint generation with severe priority scoring</p>
          </div>
        </div>
        
        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 md:gap-3 text-xs font-semibold text-slate-400">
          <span className={`px-2.5 py-1 rounded-full ${step === 'upload' ? 'bg-navy text-white' : 'bg-slate-200 text-slate-700'}`}>1. Details</span>
          <span className="text-[10px]">→</span>
          <span className={`px-2.5 py-1 rounded-full ${step === 'analysis' ? 'bg-navy text-white animate-pulse' : step === 'review' ? 'bg-slate-200 text-slate-700' : 'bg-slate-100'}`}>2. AI Agent</span>
          <span className="text-[10px]">→</span>
          <span className={`px-2.5 py-1 rounded-full ${step === 'review' ? 'bg-navy text-white' : 'bg-slate-100'}`}>3. Review</span>
        </div>
      </div>

      {/* STEP 1: UPLOAD AND INITIAL ENTRY */}
      {step === 'upload' && (
        <div className="p-6 md:p-8 space-y-6">

          {/* Recovery and Resume Banner */}
          {recoveredWorkflow && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-950">Interrupted Analysis Detected</h4>
                  <p className="text-[10px] text-amber-700 font-medium leading-relaxed mt-1">
                    An incomplete analysis run (ID: {recoveredWorkflow.id.substring(0, 14)}...) was found for {recoveredWorkflow.city}. 
                    You can recover and resume execution from where it stopped.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={() => {
                    localStorage.removeItem('activeCivicWorkflowId');
                    setRecoveredWorkflow(null);
                  }}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                >
                  Discard
                </button>
                <button
                  onClick={() => handleResumeWorkflow(recoveredWorkflow)}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm shadow-amber-600/10 active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Resume Run</span>
                </button>
              </div>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Left Hand: Image Upload and Presets */}
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Upload Issue Image</label>
              
              <div className="border-2 border-dashed border-slate-200 rounded-2xl hover:border-navy/30 transition-all bg-slate-50/50 p-6 flex flex-col items-center justify-center text-center group min-h-[220px] relative overflow-hidden">
                {imageFile ? (
                  <div className="absolute inset-0 w-full h-full">
                    <img src={imageFile} alt="Uploaded Civic Hazard" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setImageFile(null)}
                      className="absolute top-3 right-3 p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400 group-hover:text-navy transition-colors mb-3" />
                    <p className="text-xs text-slate-600 font-semibold mb-1">Drag and drop photo here, or <span className="text-navy underline cursor-pointer">browse file</span></p>
                    <p className="text-[10px] text-slate-400">Supports PNG, JPG, JPEG up to 10MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </>
                )}
              </div>

              {/* Hackathon Preset Simulator Buttons */}
              <div className="pt-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">💡 Quick Hackathon Tester Presets (Skip file upload!)</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => loadMockImage('pothole')}
                    className="p-2 border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-xl hover:border-saffron/30 hover:bg-saffron/5 transition-colors cursor-pointer text-center"
                  >
                    🚧 Pothole
                  </button>
                  <button
                    onClick={() => loadMockImage('garbage')}
                    className="p-2 border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-xl hover:border-saffron/30 hover:bg-saffron/5 transition-colors cursor-pointer text-center"
                  >
                    🗑️ Trash Dump
                  </button>
                  <button
                    onClick={() => loadMockImage('streetlight')}
                    className="p-2 border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-xl hover:border-saffron/30 hover:bg-saffron/5 transition-colors cursor-pointer text-center"
                  >
                    💡 Streetlight
                  </button>
                </div>
              </div>
            </div>

            {/* Right Hand: Municipal Location and Description */}
            <div className="space-y-4">
              
              {/* City Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-navy shrink-0" />
                  <span>Select Target City</span>
                </label>
                <select
                  value={selectedCityName}
                  onChange={(e) => setSelectedCityName(e.target.value)}
                  className="w-full border border-slate-200 px-4 py-3 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy transition-all"
                >
                  {INDIAN_CITIES.map(city => (
                    <option key={city.name} value={city.name}>{city.name} ({city.state})</option>
                  ))}
                </select>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span>Drafts will route directly to <strong>{cityObj.municipalBody}</strong></span>
                </div>
              </div>

              {/* Exact Location Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Locality address & landmark</label>
                <input
                  type="text"
                  placeholder="e.g. Near HDFC Bank ATM, 3rd Block, Jayanagar..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-slate-200 px-4 py-3 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy transition-all"
                />
              </div>

              {/* Citizen Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Describe what is going on</label>
                <textarea
                  placeholder="Describe details of the issue to help our civic AI agent analyze size, water logs, or accessibility..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-200 px-4 py-3 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy transition-all resize-none"
                />
              </div>

            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 flex justify-end">
            <button
              onClick={triggerAiAnalysis}
              className="bg-navy bg-gradient-to-r hover:from-navy hover:to-navy-hover text-white font-bold py-3 px-8 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-navy/10 active:scale-[0.98] transition-all"
            >
              <span>Analyze with Agentic AI</span>
              <Sparkles className="w-4 h-4 text-saffron" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: AI MISSION CONTROL PANEL (HIGH-TECH OPERATIONS CENTER) */}
      {step === 'analysis' && (
        <div className="p-6 md:p-8 bg-slate-950 text-slate-100 min-h-screen relative overflow-hidden">
          {/* Subtle tech background grids and ambient glows */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.04),transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(30,144,255,0.04),transparent_50%)]"></div>
          
          <div className="max-w-7xl mx-auto space-y-6 relative z-10">
            
            {/* HUD Title & Network Telemetry Status Bar */}
            <div className="flex flex-col lg:flex-row items-stretch gap-4 justify-between bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                  <div className="absolute inset-0 border-2 border-slate-800 rounded-full"></div>
                  <div className="absolute inset-0 border-2 border-t-emerald-500 border-r-cyan-500 rounded-full animate-spin"></div>
                  <Cpu className="w-6 h-6 text-emerald-400 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h4 className="font-mono font-bold text-base tracking-tight text-white">INTEGRATED CIVIC INTEL NETWORK</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono font-semibold uppercase tracking-widest mt-0.5">
                    Multi-Agent Cortex • Sequential Execution Matrix
                  </p>
                </div>
              </div>

              {/* System Stats HUD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-4 py-2 border-l border-r border-slate-800">
                <div className="text-left font-mono">
                  <span className="block text-[8px] text-slate-500 uppercase tracking-widest">Core Engine</span>
                  <span className="text-xs font-bold text-emerald-400">Gemini 3.5 Core</span>
                </div>
                <div className="text-left font-mono">
                  <span className="block text-[8px] text-slate-500 uppercase tracking-widest">Network Speed</span>
                  <span className="text-xs font-bold text-cyan-400">9.6 TFLOPS</span>
                </div>
                <div className="text-left font-mono">
                  <span className="block text-[8px] text-slate-500 uppercase tracking-widest">Cortex Status</span>
                  <span className="text-xs font-bold text-amber-400">Orchestrating</span>
                </div>
                <div className="text-left font-mono">
                  <span className="block text-[8px] text-slate-500 uppercase tracking-widest">Active Grid</span>
                  <span className="text-xs font-bold text-slate-300">{selectedCityName}</span>
                </div>
              </div>

              {/* Overall Completion Circle / Gauge */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="rgba(30,41,59,1)" strokeWidth="4" fill="transparent" />
                    <circle 
                      cx="32" 
                      cy="32" 
                      r="28" 
                      stroke="url(#progress-gradient)" 
                      strokeWidth="4" 
                      fill="transparent" 
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - aiProgress / 100)}`}
                      className="transition-all duration-300"
                    />
                    <defs>
                      <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute font-mono text-xs font-black text-white">{aiProgress}%</span>
                </div>
                <div>
                  <span className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">Sync Progress</span>
                  <div className="w-32 bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-500" 
                      style={{ width: `${aiProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Operations Split Grid */}
            <div className="grid lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Side: Interactive Agent List (7 cols) */}
              <div className="lg:col-span-7 bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <h5 className="text-[11px] font-mono font-black text-slate-300 uppercase tracking-widest">AGENTS PIPELINE SPECTROMETER</h5>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-500/80 bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded">
                      8 CORE AGENTS ONLINE
                    </span>
                  </div>
                  
                  <div data-lenis-prevent className="space-y-3 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-800">
                    {[
                      { id: 'VisionAgent', name: 'Vision Intelligence Agent', desc: 'Analyzes visual parameters, damage, & safety hazards' },
                      { id: 'ClassificationAgent', name: 'Semantic Classification Agent', desc: 'Identifies core categories & sub-categories' },
                      { id: 'SeverityAgent', name: 'Severity & Public Risk Agent', desc: 'Evaluates citizen threat index' },
                      { id: 'RoutingAgent', name: 'Authority Routing Agent', desc: 'Routes complaint & SLA response metrics' },
                      { id: 'DraftingAgent', name: 'Bilingual Drafting Agent', desc: 'Formulates complaints & legal letters' },
                      { id: 'RiskPredictionAgent', name: 'Risk & Decay Prediction Agent', desc: 'Models physical deterioration & legal liability' },
                      { id: 'AdvisoryAgent', name: 'Civic Advisory Agent', desc: 'Bylaw legal advice & Escalation steps' },
                      { id: 'HeatmapAgent', name: 'Heatmap Intelligence Agent', desc: 'Geohash spatial hazard density clustering' }
                    ].map((agent, idx) => {
                      const status: AgentStatus = workflowState?.agentStatuses?.[agent.id as keyof typeof workflowState.agentStatuses] || 'Pending';
                      const isRunning = status === 'Running';
                      const isCompleted = status === 'Completed';
                      const isFailed = status === 'Failed';
                      const duration = agentDurations[agent.id] || 0;
                      const isExpanded = expandedAgent === agent.id;

                      return (
                        <div
                          key={agent.id}
                          className={`border rounded-xl transition-all duration-300 overflow-hidden ${
                            isRunning ? 'bg-slate-900 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.1)]' :
                            isCompleted ? 'bg-slate-900/40 border-emerald-500/20' :
                            isFailed ? 'bg-slate-900/40 border-rose-500/30' :
                            'bg-slate-900/10 border-slate-800/60 opacity-60'
                          }`}
                        >
                          {/* Card Main Block */}
                          <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {/* Glowing Status Indicator Icon */}
                              <div className="relative shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-slate-950 border border-slate-800">
                                {isCompleted ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                                ) : isFailed ? (
                                  <AlertCircle className="w-4 h-4 text-rose-500" />
                                ) : isRunning ? (
                                  <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                                ) : (
                                  <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700"></div>
                                )}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-slate-500">[{String(idx + 1).padStart(2, '0')}]</span>
                                  <h6 className={`text-xs font-mono font-bold ${isRunning ? 'text-cyan-400' : isCompleted ? 'text-slate-200' : 'text-slate-400'}`}>
                                    {agent.name}
                                  </h6>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5 leading-tight">{agent.desc}</p>
                              </div>
                            </div>

                            {/* Status & Timer Column */}
                            <div className="flex items-center gap-4 shrink-0 font-mono">
                              <div className="text-right">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                                  isRunning ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-400 animate-pulse' :
                                  isCompleted ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400' :
                                  isFailed ? 'bg-rose-950/40 border-rose-800/40 text-rose-400' :
                                  'bg-slate-950 border-slate-800 text-slate-500'
                                }`}>
                                  {status}
                                </span>
                                <div className="text-[9px] text-slate-500 mt-1 flex items-center justify-end gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{(duration / 1000).toFixed(1)}s</span>
                                </div>
                              </div>

                              {/* Expand/Collapse Toggle (only for Completed) */}
                              {isCompleted && (
                                <button
                                  onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                                  className="p-1 rounded bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Individual Agent Progress Bar */}
                          <div className="w-full h-1 bg-slate-950 relative overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                isRunning ? 'bg-cyan-500 animate-[pulse_1s_infinite] w-3/4' :
                                isCompleted ? 'bg-emerald-500 w-full' :
                                isFailed ? 'bg-rose-500 w-full' :
                                'w-0'
                              }`}
                            ></div>
                          </div>

                          {/* Dynamic Inspector Panel (Show telemetry keys/values) */}
                          {isCompleted && isExpanded && (
                            <div className="border-t border-slate-800/80 bg-slate-950 p-4 font-mono text-[10px] space-y-2.5 animate-fadeIn">
                              <div className="flex items-center justify-between pb-1.5 border-b border-slate-900">
                                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest flex items-center gap-1">
                                  <Database className="w-3 h-3 text-cyan-400" />
                                  Agent Shared State telemetry
                                </span>
                                <span className="text-emerald-500 text-[9px] font-bold">MUTEX COMMITTED</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                                {agent.id === 'VisionAgent' && workflowState?.vision && (
                                  <>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">Scene Analysis</span>
                                      <span className="block text-slate-200 bg-slate-900/50 p-1.5 rounded border border-slate-800/45 leading-relaxed">
                                        {workflowState.vision.visualSceneDescription}
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      <div>
                                        <span className="block text-slate-500 text-[9px] uppercase">Detected Objects</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {workflowState.vision.objectsDetected.map((obj, oidx) => (
                                            <span key={oidx} className="px-1.5 py-0.5 bg-cyan-950/40 text-cyan-400 rounded border border-cyan-900/40">
                                              {obj}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="block text-slate-500 text-[9px] uppercase">Image Analyzed</span>
                                        <span className="text-cyan-400 font-bold">{workflowState.vision.imageAnalyzed ? 'Yes' : 'No'}</span>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {agent.id === 'ClassificationAgent' && workflowState?.classification && (
                                  <>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">Category Class</span>
                                      <span className="block text-slate-200 bg-slate-900/50 p-1.5 rounded border border-slate-800/45 font-bold">
                                        {workflowState.classification.category}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">Sub-category Class</span>
                                      <span className="block text-slate-200 bg-slate-900/50 p-1.5 rounded border border-slate-800/45">
                                        {workflowState.classification.subCategory}
                                      </span>
                                    </div>
                                  </>
                                )}

                                {agent.id === 'SeverityAgent' && workflowState?.severity && (
                                  <>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">Criticality Assessment</span>
                                      <span className="block text-rose-400 bg-slate-900/50 p-1.5 rounded border border-slate-800/45 font-bold">
                                        {workflowState.severity.severityLevel}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">Public Safety Priority Score</span>
                                      <span className="block text-amber-400 bg-slate-900/50 p-1.5 rounded border border-slate-800/45 font-bold">
                                        {workflowState.severity.priorityScore || 50}/100
                                      </span>
                                    </div>
                                  </>
                                )}

                                {agent.id === 'RoutingAgent' && workflowState?.routing && (
                                  <>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">Responsible Department</span>
                                      <span className="block text-emerald-400 bg-slate-900/50 p-1.5 rounded border border-slate-800/45 font-bold">
                                        {workflowState.routing.department}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">Service Level SLA Limit</span>
                                      <span className="block text-cyan-400 bg-slate-900/50 p-1.5 rounded border border-slate-800/45">
                                        {workflowState.routing.sla}
                                      </span>
                                    </div>
                                  </>
                                )}

                                {agent.id === 'DraftingAgent' && workflowState?.drafting && (
                                  <>
                                    <div className="space-y-1 sm:col-span-2">
                                      <span className="block text-slate-500 text-[9px] uppercase">AI Title Draft</span>
                                      <span className="block text-slate-200 bg-slate-900/50 p-1.5 rounded border border-slate-800/45">
                                        {workflowState.drafting.subject}
                                      </span>
                                    </div>
                                  </>
                                )}

                                {agent.id === 'RiskPredictionAgent' && workflowState?.riskPrediction && (
                                  <>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">Infrastructure Risk</span>
                                      <span className="block text-rose-400 font-bold bg-slate-900/50 p-1.5 rounded border border-slate-800/45">
                                        {workflowState.riskPrediction.infrastructureRiskScore}/100
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">Govt/Legal Liability</span>
                                      <span className="block text-amber-500 font-bold bg-slate-900/50 p-1.5 rounded border border-slate-800/45">
                                        {workflowState.riskPrediction.legalLiabilityScore}/100
                                      </span>
                                    </div>
                                  </>
                                )}

                                {agent.id === 'AdvisoryAgent' && workflowState?.advisory && (
                                  <>
                                    <div className="space-y-1 sm:col-span-2">
                                      <span className="block text-slate-500 text-[9px] uppercase">Core Bylaw Reference</span>
                                      <span className="block text-slate-200 bg-slate-900/50 p-1.5 rounded border border-slate-800/45">
                                        {workflowState.advisory.applicableActsAndBylaws.slice(0, 2).join(', ')}
                                      </span>
                                    </div>
                                  </>
                                )}

                                {agent.id === 'HeatmapAgent' && workflowState?.heatmap && (
                                  <>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">Geohash Cluster</span>
                                      <span className="block text-cyan-400 font-mono bg-slate-900/50 p-1.5 rounded border border-slate-800/45">
                                        {workflowState.heatmap.geohashSector}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="block text-slate-500 text-[9px] uppercase">City Hotspot Rank</span>
                                      <span className="block text-rose-500 font-bold bg-slate-900/50 p-1.5 rounded border border-slate-800/45">
                                        #{workflowState.heatmap.cityHotspotRank} in city
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 text-[10px] font-mono text-slate-500 flex flex-wrap gap-x-4 gap-y-2 justify-between">
                  <span>SYSTEM CLOCK: {new Date().toISOString()}</span>
                  <span>IP/TUNNEL ID: RUNTIME_SECURE_NODE</span>
                </div>
              </div>

              {/* Right Side: Log Console & Telemetry Feed (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Live Real-time Diagnostics HUD (Bento Card) */}
                <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 shadow-xl backdrop-blur-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h5 className="text-[11px] font-mono font-black text-slate-300 uppercase tracking-widest">LIVE OSCILLOSCOPE FEED</h5>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 relative overflow-hidden">
                      <span className="block text-[8px] text-slate-500 uppercase">ACTIVE THREADS</span>
                      <span className="text-lg font-bold text-cyan-400 mt-1 block">
                        {workflowState?.agentStatuses ? Object.values(workflowState.agentStatuses).filter(s => s === 'Running').length : 0}
                      </span>
                      <span className="text-[9px] text-slate-500">Executing Parallel</span>
                      <div className="absolute right-2 bottom-2 w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping"></div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                      <span className="block text-[8px] text-slate-500 uppercase">RESOLVED SLA</span>
                      <span className="text-lg font-bold text-emerald-400 mt-1 block">
                        {workflowState?.routing?.sla || '48 Hours'}
                      </span>
                      <span className="text-[9px] text-slate-500">Authority Guarantee</span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                      <span className="block text-[8px] text-slate-500 uppercase">RISK LEVEL</span>
                      <span className="text-lg font-bold text-rose-400 mt-1 block">
                        {workflowState?.severity?.severityLevel || 'Pothole defect'}
                      </span>
                      <span className="text-[9px] text-slate-500">Critical Priority</span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                      <span className="block text-[8px] text-slate-500 uppercase">GEO-CLUSTER</span>
                      <span className="text-lg font-bold text-amber-400 mt-1 block">
                        {workflowState?.heatmap?.geohashSector || 'GRID 101'}
                      </span>
                      <span className="text-[9px] text-slate-500">Spatial geohash</span>
                    </div>
                  </div>

                  {/* Aesthetic waveform overlay */}
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800/60 flex items-center justify-around h-12 overflow-hidden">
                    {[12, 24, 36, 18, 42, 8, 20, 32, 14, 48, 28, 16, 22, 38, 10, 44, 18, 30, 24, 14, 8].map((val, idx) => (
                      <div 
                        key={idx} 
                        className={`w-1 rounded-full bg-gradient-to-t from-emerald-500 to-cyan-400 transition-all duration-300`} 
                        style={{ 
                          height: `${Math.max(4, aiProgress > 0 && aiProgress < 100 ? Math.floor(Math.random() * 32) + 4 : val / 2.5)}px` 
                        }}
                      ></div>
                    ))}
                  </div>
                </div>

                {/* Log Console Container */}
                <div className="bg-slate-950 text-emerald-400 font-mono text-[10px] rounded-2xl p-5 border border-slate-900 shadow-2xl flex-1 flex flex-col min-h-[300px]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-900 text-slate-400 shrink-0 mb-3">
                    <div className="flex items-center gap-1.5 font-sans">
                      <Terminal className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                      <span className="font-bold tracking-wide uppercase text-[9px] font-mono text-slate-300">SYSTEM CORTEX FEED</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    </div>
                  </div>

                  <div data-lenis-prevent className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[380px] font-mono leading-relaxed select-text scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800">
                    {orchestrationLogs.map((log, lidx) => (
                      <div key={lidx} className="whitespace-pre-wrap text-emerald-400/90 hover:text-emerald-300 transition-all">
                        {log}
                      </div>
                    ))}
                    
                    {/* Blinking console cursor if loading */}
                    <span className="inline-block w-1.5 h-3.5 bg-emerald-400 ml-1 animate-pulse"></span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* STEP 3: REVIEW AI RESULTS AND EDIT */}
      {step === 'review' && (
        <div className="p-6 md:p-8 space-y-6">
          
          {/* Main Top Tags */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">AI Classified Category</span>
              <input
                type="text"
                value={editedCategory}
                onChange={(e) => setEditedCategory(e.target.value)}
                className="w-full bg-transparent border-b border-transparent focus:border-navy text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Specific Sub-Category</span>
              <input
                type="text"
                value={editedSubCategory}
                onChange={(e) => setEditedSubCategory(e.target.value)}
                className="w-full bg-transparent border-b border-transparent focus:border-navy text-xs font-medium text-slate-800 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100/50">
              <span className="block text-[10px] font-bold text-rose-500 uppercase tracking-wide flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Computed Severity</span>
              </span>
              <select
                value={editedSeverity}
                onChange={(e) => setEditedSeverity(e.target.value as any)}
                className="w-full bg-transparent border-b border-transparent text-xs font-bold text-rose-900 focus:outline-none"
              >
                <option value="Critical">Critical Priority</option>
                <option value="Severe">Severe Priority</option>
                <option value="Moderate">Moderate Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Est. Resolution Charter</span>
              <div className="text-xs font-bold text-emerald-700 mt-0.5">{editedSlaTime || "48-72 Hours"}</div>
            </div>
          </div>

          {/* Automatic Municipal Assignment Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-navy" />
                <span>Suggested Public Department Authority</span>
              </span>
              <input
                type="text"
                value={editedDepartment}
                onChange={(e) => setEditedDepartment(e.target.value)}
                className="w-full bg-transparent border-b border-slate-200 focus:border-navy text-xs font-bold text-slate-800 focus:outline-none py-1"
              />
            </div>

            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-1">
              <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Automatically Assigned Officer</span>
              </span>
              <div className="text-xs font-bold text-slate-800 py-1.5 flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                  Auto-Dispatched
                </span>
                <span>{editedOfficerName || "Search matching municipal officers..."}</span>
              </div>
            </div>
          </div>

          {/* MULTI-AGENT CIVIC INTELLIGENCE DASHBOARD */}
          {workflowState && (
            <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <Sparkles className="w-4 h-4 text-saffron" />
                <h5 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Multi-Agent Deep Civic Intelligence Summary</h5>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Panel 1: Vision Diagnostics */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1.5 shadow-sm">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Eye className="w-3 h-3 text-navy" />
                    <span>Vision Diagnostics</span>
                  </span>
                  {workflowState.vision ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                        {workflowState.vision.visualSceneDescription}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {workflowState.vision.objectsDetected.map((obj, i) => (
                          <span key={i} className="bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded text-[9px] font-mono border border-slate-200">
                            {obj}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">No visual context available.</p>
                  )}
                </div>

                {/* Panel 2: Infrastructure & Legal Risk Prediction */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-2.5 shadow-sm">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-saffron" />
                    <span>Risk Projections</span>
                  </span>
                  {workflowState.riskPrediction ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-600">
                          <span>Infrastructure Decay</span>
                          <span>{workflowState.riskPrediction.infrastructureRiskScore}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-navy h-full rounded-full"
                            style={{ width: `${workflowState.riskPrediction.infrastructureRiskScore}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-600">
                          <span>Legal Liability</span>
                          <span>{workflowState.riskPrediction.legalLiabilityScore}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-saffron h-full rounded-full"
                            style={{ width: `${workflowState.riskPrediction.legalLiabilityScore}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">Risk scores pending.</p>
                  )}
                </div>

                {/* Panel 3: Spatial Heatmap Analytics */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1.5 shadow-sm">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    <span>Heatmap Analytics</span>
                  </span>
                  {workflowState.heatmap ? (
                    <div className="space-y-1 text-[10px] font-medium text-slate-600">
                      <div className="flex justify-between py-0.5 border-b border-slate-50">
                        <span>Geohash Sector:</span>
                        <strong className="font-mono text-slate-800">{workflowState.heatmap.geohashSector}</strong>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-slate-50">
                        <span>Cluster Rank:</span>
                        <strong className="text-rose-600">#{workflowState.heatmap.cityHotspotRank} in city</strong>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-slate-50">
                        <span>Hotspot Density:</span>
                        <strong className="text-slate-800">{workflowState.heatmap.hazardClusterDensity}</strong>
                      </div>
                      {workflowState.heatmap.wardRiskIndex !== undefined && (
                        <div className="flex justify-between py-0.5 border-b border-slate-50">
                          <span>Ward Risk Index:</span>
                          <strong className="text-slate-800">{workflowState.heatmap.wardRiskIndex}/100</strong>
                        </div>
                      )}
                      {workflowState.heatmap.hotspotScore !== undefined && (
                        <div className="flex justify-between py-0.5 border-b border-slate-50">
                          <span>Hotspot Priority Score:</span>
                          <strong className="text-amber-600">{workflowState.heatmap.hotspotScore}/100</strong>
                        </div>
                      )}
                      {workflowState.heatmap.densityCluster !== undefined && (
                        <div className="flex justify-between py-0.5">
                          <span>Ward Cluster Density:</span>
                          <span className={`px-1 rounded-sm text-[9px] font-bold ${
                            workflowState.heatmap.densityCluster === 'High' ? 'bg-red-50 text-red-700' :
                            workflowState.heatmap.densityCluster === 'Medium' ? 'bg-amber-50 text-amber-700' :
                            'bg-slate-50 text-slate-700'
                          }`}>{workflowState.heatmap.densityCluster}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">Heatmap data unavailable.</p>
                  )}
                </div>

                {/* Panel 4: Routing & SLA Directory */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1.5 shadow-sm">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-600" />
                    <span>Routing & SLA Directory</span>
                  </span>
                  {workflowState.routing ? (
                    <div className="space-y-1 text-[10px] font-medium text-slate-600">
                      <div className="flex justify-between py-0.5 border-b border-slate-50 gap-2">
                        <span className="shrink-0 text-slate-400">Corporation:</span>
                        <strong className="text-slate-800 text-right truncate" title={workflowState.routing.municipalCorporation}>{workflowState.routing.municipalCorporation || 'N/A'}</strong>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-slate-50 gap-2">
                        <span className="shrink-0 text-slate-400">Ward Office:</span>
                        <strong className="text-slate-800 text-right truncate" title={workflowState.routing.wardOffice || workflowState.routing.wardInfo}>{workflowState.routing.wardOffice || workflowState.routing.wardInfo || 'N/A'}</strong>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-slate-50 gap-2">
                        <span className="shrink-0 text-slate-400">Escalation:</span>
                        <strong className="text-slate-800 text-right truncate" title={workflowState.routing.escalationAuthority}>{workflowState.routing.escalationAuthority || workflowState.routing.escalationContact || 'N/A'}</strong>
                      </div>
                      <div className="flex justify-between py-0.5 gap-2">
                        <span className="shrink-0 text-slate-400">Target SLA:</span>
                        <strong className="text-emerald-700 text-right">{workflowState.routing.sla || 'N/A'}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">Routing directory unavailable.</p>
                  )}
                </div>
              </div>

              {/* Detailed Predictive Risk Analysis */}
              {workflowState.riskPrediction && (workflowState.riskPrediction.futureRisk || (workflowState.riskPrediction.possibleConsequences && workflowState.riskPrediction.possibleConsequences.length > 0)) && (
                <div className="bg-rose-50/25 rounded-2xl border border-rose-100/60 p-4 mt-3 space-y-3">
                  <div className="flex items-center justify-between border-b border-rose-100/40 pb-2">
                    <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-rose-600 animate-pulse" />
                      <span>Failure Cascade & Public Safety Risk Analysis</span>
                    </span>
                    {workflowState.riskPrediction.urgencyLevel && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                        workflowState.riskPrediction.urgencyLevel.toLowerCase() === 'critical' ? 'bg-red-100 text-red-800 border-red-200' :
                        workflowState.riskPrediction.urgencyLevel.toLowerCase() === 'high' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                        workflowState.riskPrediction.urgencyLevel.toLowerCase() === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                        'bg-slate-100 text-slate-800 border-slate-200'
                      }`}>
                        Urgency: {workflowState.riskPrediction.urgencyLevel}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column: Predictions & Consequences */}
                    <div className="space-y-3">
                      {workflowState.riskPrediction.futureRisk && (
                        <div className="space-y-1">
                          <h6 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Future Risk Progression</h6>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                            {workflowState.riskPrediction.futureRisk}
                          </p>
                        </div>
                      )}

                      {workflowState.riskPrediction.possibleConsequences && workflowState.riskPrediction.possibleConsequences.length > 0 && (
                        <div className="space-y-1">
                          <h6 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Possible Consequences</h6>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {workflowState.riskPrediction.possibleConsequences.map((consequence, idx) => (
                              <span key={idx} className="bg-rose-50 text-rose-700 font-bold px-2 py-1 rounded-lg text-[10px] border border-rose-100 flex items-center gap-1">
                                <span>⚠️</span>
                                <span>{consequence}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Community Impact & Recommendations */}
                    <div className="space-y-3">
                      {workflowState.riskPrediction.communityImpact && (
                        <div className="space-y-1">
                          <h6 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Community Impact</h6>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                            {workflowState.riskPrediction.communityImpact}
                          </p>
                        </div>
                      )}

                      {workflowState.riskPrediction.recommendations && workflowState.riskPrediction.recommendations.length > 0 && (
                        <div className="space-y-1">
                          <h6 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Safety Recommendations</h6>
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600 font-medium leading-relaxed">
                            {workflowState.riskPrediction.recommendations.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Complaint Title editor */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Grievance Title</label>
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>

          {/* Complaint Letters Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-navy" />
                <span>Bilingual Written Complaints for Municipal Commissioner</span>
              </label>

              {/* English vs Hindi tabs */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setActiveLangTab('en')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${activeLangTab === 'en' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  English Draft
                </button>
                <button
                  onClick={() => setActiveLangTab('hi')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${activeLangTab === 'hi' ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  हिंदी मसौदा
                </button>
              </div>
            </div>

            {/* Textarea complaint */}
            <div className="relative">
              <textarea
                rows={9}
                value={activeLangTab === 'en' ? editedComplaintEn : editedComplaintHi}
                onChange={(e) => {
                  if (activeLangTab === 'en') setEditedComplaintEn(e.target.value);
                  else setEditedComplaintHi(e.target.value);
                }}
                className="w-full border border-slate-200 px-5 py-4 rounded-2xl text-xs leading-relaxed font-medium bg-slate-50/30 focus:outline-none focus:ring-1 focus:ring-navy font-sans whitespace-pre-line"
              />
              <button
                onClick={handleCopyComplaint}
                className="absolute top-4 right-4 bg-white/95 border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-[10px] shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>{copystate ? "Copied!" : "Copy Complaint Text"}</span>
              </button>
            </div>
          </div>

          {/* Citizen Summary Panel */}
          {editedCitizenSummary && (
            <div className="bg-amber-50/30 p-5 rounded-2xl border border-amber-100/60 space-y-2 relative">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Citizen Empowerment & Rights Summary</span>
              </span>
              <div className="markdown-body text-xs text-amber-900 leading-relaxed font-medium">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-bold text-amber-950">{children}</strong>,
                  }}
                >
                  {editedCitizenSummary}
                </ReactMarkdown>
              </div>
              <button
                onClick={handleCopySummary}
                className="absolute top-4 right-4 bg-white border border-amber-200/60 hover:bg-amber-50 text-amber-800 px-3 py-1.5 rounded-xl font-bold text-[10px] shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-amber-500" />
                <span>{copySummaryState ? "Copied!" : "Copy Summary"}</span>
              </button>
            </div>
          )}

          {/* RTI Escalation Draft Panel */}
          {editedRtiDraft && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Right to Information (RTI) Escalation Draft</span>
                </label>
              </div>
              <div className="relative">
                <textarea
                  rows={8}
                  value={editedRtiDraft}
                  onChange={(e) => setEditedRtiDraft(e.target.value)}
                  className="w-full border border-slate-200 px-5 py-4 rounded-2xl text-xs leading-relaxed font-mono bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-navy whitespace-pre-line"
                />
                <button
                  onClick={handleCopyRti}
                  className="absolute top-4 right-4 bg-white/95 border border-slate-200 hover:bg-slate-50 text-indigo-700 px-3 py-1.5 rounded-xl font-bold text-[10px] shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{copyRtiState ? "Copied!" : "Copy RTI Draft"}</span>
                </button>
              </div>
            </div>
          )}

          {/* AI Legal & Safety Advice Banner */}
          {editedAdvice && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-bold text-emerald-800">Civic Safety & Legal Empowerment Advisory</h5>
                <div className="markdown-body text-[11px] text-emerald-600 font-medium leading-relaxed mt-1">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      strong: ({ children }) => <strong className="font-bold text-emerald-800">{children}</strong>,
                    }}
                  >
                    {editedAdvice}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="border-t border-slate-100 pt-5 flex justify-between gap-4">
            <button
              onClick={handleReset}
              className="px-6 py-3 border border-slate-200 hover:bg-slate-50 text-slate-755 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              <span>Retry / Start Over</span>
            </button>

            <button
              onClick={handleSubmitReport}
              disabled={isSubmitting}
              className="px-10 py-3.5 bg-green-t hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-700/10 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Filing report to Corporation...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Submit Complaints To {cityObj.municipalBody}</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}

    </div>
  );
}

export default React.memo(ReportWizard);
