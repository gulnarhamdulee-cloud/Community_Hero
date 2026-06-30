import { useState, useRef, useEffect, memo } from 'react';
import { Sparkles, Send, MessageSquare, ArrowRight, ShieldAlert, BookOpen, Plus, Trash2, ChevronLeft, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, ChatSession, DbChatMessage } from '../types';
import { useAuth } from '../features/auth/useAuth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';

function CivicBot() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mobileShowSidebar, setMobileShowSidebar] = useState(true);
  
  const messageContainerRef = useRef<HTMLDivElement>(null);

  const starterQuestions = [
    { text: "RTI filing procedure", prompt: "Could you walk me through the steps to draft and file a Right to Information (RTI) application for local municipal expenditure?" },
    { text: "Who maintains streetlights?", prompt: "Which municipal ward department handles defective streetlights and public dark spots in Indian metro cities?" },
    { text: "Waste management laws 2016", prompt: "What are the key legal duties of municipal corporations under the Solid Waste Management Rules 2016?" },
    { text: "Pothole compensation rules", prompt: "Are there any High Court rulings or compensation guidelines for citizens affected by municipal pothole negligence?" }
  ];

  const defaultGreeting: ChatMessage = {
    role: 'assistant',
    text: "Namaste! I am Nagrik Shastra, your Civic AI Grievance Assistant. I can help you understand municipal bylaws, craft formal escalations, file RTI requests, or figure out which municipal ward department is responsible for specific public assets. How can I serve your community today?",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  // 1. Listen for user's chat sessions from Firestore
  useEffect(() => {
    if (!user) {
      setSessions([]);
      setIsSessionsLoading(false);
      return;
    }

    setIsSessionsLoading(true);
    const q = query(
      collection(db, 'chatSessions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedSessions: ChatSession[] = [];
      snapshot.forEach((docSnap) => {
        loadedSessions.push({ id: docSnap.id, ...docSnap.data() } as ChatSession);
      });
      // Sort locally by updatedAt desc to avoid composite index requirements
      loadedSessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      setSessions(loadedSessions);
      setIsSessionsLoading(false);

      // Auto-select the most recent session if none is currently selected
      if (loadedSessions.length > 0 && !currentSessionId) {
        setCurrentSessionId(loadedSessions[0].id);
        // On desktop, show chat. On mobile, keep list visible unless they click
        if (window.innerWidth >= 1024) {
          setMobileShowSidebar(false);
        }
      }
    }, (error) => {
      console.error("Error subscribing to chat sessions:", error);
      setIsSessionsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 2. Listen for messages in the selected active session
  useEffect(() => {
    if (!currentSessionId || !user) {
      setMessages([]);
      return;
    }

    const messagesRef = collection(db, 'chatSessions', currentSessionId, 'messages');
    const q = query(messagesRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMsgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedMsgs.push({
          role: data.role,
          text: data.text,
          timestamp: data.timestamp,
          createdAt: data.createdAt || new Date().toISOString()
        } as ChatMessage);
      });
      // Sort in-memory stably by createdAt to prevent database-level ordering failures
      loadedMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(loadedMsgs);
    }, (error) => {
      console.error("Error subscribing to session messages:", error);
    });

    return () => unsubscribe();
  }, [currentSessionId, user?.uid]);

  // Auto-scroll to bottom of the message container on new messages
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTo({
        top: messageContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  // 3. Create a new chat session manually or automatically
  const handleCreateNewSession = async (initialTitle: string = "New Conversation") => {
    if (!user) return null;
    try {
      const sessionRef = doc(collection(db, 'chatSessions'));
      const sessionId = sessionRef.id;
      const now = new Date().toISOString();
      const newSession: ChatSession = {
        id: sessionId,
        userId: user.uid,
        title: initialTitle,
        createdAt: now,
        updatedAt: now
      };

      try {
        await setDoc(sessionRef, newSession);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `chatSessions/${sessionId}`);
      }

      setCurrentSessionId(sessionId);
      setMobileShowSidebar(false);
      return sessionId;
    } catch (err) {
      console.error("Failed to create new chat session:", err);
      return null;
    }
  };

  // 4. Send Message Handler
  const handleSendMessage = async (msgText: string) => {
    if (!msgText.trim() || isLoading || !user) return;

    let sessionId = currentSessionId;

    // Create session on-the-fly if none selected
    if (!sessionId) {
      const titleProposal = msgText.substring(0, 32) + (msgText.length > 32 ? '...' : '');
      const newId = await handleCreateNewSession(titleProposal);
      if (!newId) return;
      sessionId = newId;
    }

    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();

    const userMsgData = {
      role: 'user',
      text: msgText,
      timestamp: timestampStr,
      createdAt: nowIso,
      userId: user.uid
    };

    const messagesCollRef = collection(db, 'chatSessions', sessionId, 'messages');

    try {
      // Add user message to subcollection
      try {
        await addDoc(messagesCollRef, userMsgData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `chatSessions/${sessionId}/messages`);
      }

      // Update session's title if it's currently generic
      const currentSession = sessions.find(s => s.id === sessionId);
      const updates: any = { updatedAt: nowIso };
      if (currentSession && (currentSession.title === "New Conversation" || currentSession.title === "New Chat")) {
        updates.title = msgText.substring(0, 32) + (msgText.length > 32 ? '...' : '');
      }

      try {
        await updateDoc(doc(db, 'chatSessions', sessionId), updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `chatSessions/${sessionId}`);
      }

    } catch (err) {
      console.error("Error setting user message state:", err);
    }

    setInputMessage('');
    setIsLoading(true);

    try {
      // Gather current message history context to pass server-side (excluding loader notes)
      const chatHistory = messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/civic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msgText,
          chatHistory: chatHistory
        })
      });

      const data = await res.json();

      if (res.ok) {
        const assistantMsgData = {
          role: 'assistant',
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: new Date().toISOString(),
          userId: user.uid
        };

        try {
          await addDoc(messagesCollRef, assistantMsgData);
          await updateDoc(doc(db, 'chatSessions', sessionId), { updatedAt: new Date().toISOString() });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `chatSessions/${sessionId}/messages`);
        }
      } else {
        throw new Error(data.error || 'Server responded with an error');
      }

    } catch (err: any) {
      console.error(err);
      
      const assistantMsgError = {
        role: 'assistant',
        text: `⚠️ Error State Note: ${err.message || 'Connecting to advisor failed'}. Please verify your connection state.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        userId: user.uid
      };

      try {
        await addDoc(messagesCollRef, assistantMsgError);
      } catch (fErr) {
        console.error("Failed to write error message to DB:", fErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Delete Session Handler
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Avoid triggering click select
    if (!window.confirm("Are you sure you want to permanently delete this chat history session?")) return;

    try {
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }

      // First, fetch and delete all nested message subcollection documents
      const messagesRef = collection(db, 'chatSessions', sessionId, 'messages');
      const q = query(messagesRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);

      // Now, delete the parent session document
      try {
        await deleteDoc(doc(db, 'chatSessions', sessionId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `chatSessions/${sessionId}`);
      }
    } catch (err) {
      console.error("Error deleting chat session:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="w-full h-[400px] flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-3 border-navy border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-mono text-slate-400">Loading Nagrik Shastra Console...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <div className="w-16 h-16 bg-navy/5 text-navy rounded-2xl flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="font-display font-bold text-lg text-slate-900 mb-2">Secure Gateway Required</h3>
        <p className="text-xs text-slate-500 leading-relaxed mb-6">
          Please log in or register a free citizen account to interact with Nagrik Shastra AI and securely back up your chat sessions.
        </p>
      </div>
    );
  }

  const selectedSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[650px] h-[600px] max-w-7xl mx-auto px-4 md:px-0">
      
      {/* LEFT SIDEBAR: Conversations List */}
      <div className={`lg:w-1/3 w-full lg:flex flex-col gap-4 h-full ${mobileShowSidebar ? 'flex' : 'hidden lg:flex'}`}>
        {/* Sidebar Actions Header */}
        <div className="bg-white rounded-2xl border border-slate-200/85 p-4 shadow-sm flex flex-col gap-3">
          <button
            onClick={() => handleCreateNewSession("New Conversation")}
            className="w-full bg-navy text-white hover:bg-slate-800 rounded-xl py-3 px-4 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Start New Chat</span>
          </button>
        </div>

        {/* Sessions History List */}
        <div className="bg-white rounded-2xl border border-slate-200/85 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[220px]">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Grievance History</span>
            </span>
            <span className="text-[9px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-full font-mono font-bold">
              {sessions.length} sessions
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
            {isSessionsLoading ? (
              <div className="py-12 text-center text-[11px] text-slate-400 font-mono flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div>
                <span>Syncing sessions...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-16 text-center px-4">
                <p className="text-xs font-semibold text-slate-400 mb-1">No chats yet</p>
                <p className="text-[10px] text-slate-400 leading-normal max-w-[200px] mx-auto">
                  Start a new chat to begin consulting Nagrik Shastra about local bylaws!
                </p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    setCurrentSessionId(session.id);
                    setMobileShowSidebar(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs cursor-pointer group flex items-center justify-between ${
                    session.id === currentSessionId
                      ? 'border-navy/30 bg-navy/[0.03] text-navy font-bold shadow-xs'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare className={`w-4 h-4 shrink-0 ${session.id === currentSessionId ? 'text-navy' : 'text-slate-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs tracking-tight">{session.title}</p>
                      <span className="text-[9px] text-slate-400 block font-mono font-medium mt-0.5">
                        {new Date(session.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="p-1 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-300 group-hover:text-slate-400 transition-all shrink-0 cursor-pointer ml-1"
                    title="Delete Conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Chat Conversation viewport */}
      <div className={`lg:w-2/3 w-full lg:flex flex-col h-full bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden ${!mobileShowSidebar ? 'flex' : 'hidden lg:flex'}`}>
        
        {/* Chat Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            {/* Mobile Back Button */}
            <button
              onClick={() => setMobileShowSidebar(true)}
              className="lg:hidden p-1.5 -ml-1 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-0.5 text-xs font-bold transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <div>
                <h4 className="font-display font-extrabold text-sm text-slate-900 leading-tight">
                  {selectedSession ? selectedSession.title : "Nagrik Shastra Advisor"}
                </h4>
                <span className="text-[9px] text-slate-400 font-bold font-mono tracking-wide">MODEL: GEMINI-3.5-FLASH</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-saffron/10 border border-saffron/20 px-2.5 py-1 rounded-lg text-saffron text-[9px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 animate-pulse" />
            <span>Civic-Smart Sandbox</span>
          </div>
        </div>

        {/* Messages / Welcome suggestions Viewport */}
        <div ref={messageContainerRef} data-lenis-prevent className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          
          {/* Always display Greeting if no messages */}
          {messages.length === 0 ? (
            <div className="space-y-6">
              {/* Default Greeting Bubble */}
              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-saffron/15 text-saffron border border-saffron/20 flex items-center justify-center shrink-0 text-sm font-semibold shadow-inner">
                  N
                </div>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none font-medium">
                  <div className="whitespace-pre-wrap">{defaultGreeting.text}</div>
                  <div className="text-[9px] text-slate-400 mt-1.5 text-right font-mono">{defaultGreeting.timestamp}</div>
                </div>
              </div>

              {/* Informative Grid & Starters */}
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-gradient-to-br from-navy to-slate-900 text-white rounded-2xl p-5 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-xl translate-x-2 -translate-y-2"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="p-1.5 rounded-lg bg-saffron/10 text-saffron inline-flex">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    </span>
                    <h3 className="font-display font-bold text-xs text-white">Nagrik Shastra AI</h3>
                  </div>
                  <p className="text-slate-350 text-[10px] leading-relaxed mb-4">
                    Trained on Indian legal frameworks, PWD bylaws, municipal charters (BMC, BBMP, MCD), and Right to Information rules.
                  </p>
                  <div className="space-y-2.5 border-t border-slate-700/60 pt-3 text-[10px] text-slate-300 font-medium">
                    <div className="flex items-start gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-saffron shrink-0 mt-0.5" />
                      <span>Reference laws like the **RTI Act 2005** or **SWM Rules 2016**.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                      <span>Learn about municipal safety mandates and citizen legal rights.</span>
                    </div>
                  </div>
                </div>

                {/* Quick-Prompt Suggestions */}
                <div className="bg-white rounded-2xl p-4 border border-slate-150 flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-semibold text-[10px] uppercase tracking-wider text-slate-400 mb-2.5">Suggested Topics</h4>
                    <div className="space-y-2">
                      {starterQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(q.prompt)}
                          className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-navy/20 hover:bg-slate-50 transition-all text-[11px] text-slate-700 font-medium group flex items-center justify-between"
                        >
                          <span className="truncate pr-2">{q.text}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Render actual chat history
            messages.map((m, index) => (
              <div
                key={index}
                className={`flex items-start gap-3.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-semibold shadow-inner ${
                  m.role === 'user' ? 'bg-navy text-white' : 'bg-saffron/15 text-saffron border border-saffron/20'
                }`}>
                  {m.role === 'user' ? 'C' : 'N'}
                </div>
                
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-navy/5 text-slate-800 rounded-tr-none'
                    : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none font-medium'
                }`}>
                  {m.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  ) : (
                    <div className="markdown-body">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold text-navy">{children}</strong>,
                          h1: ({ children }) => <h1 className="text-sm font-extrabold text-navy mt-3 mb-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-xs font-bold text-navy mt-2 mb-1">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-xs font-semibold text-slate-800 mt-2 mb-1">{children}</h3>,
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  )}
                  <div className="text-[9px] text-slate-400 mt-1.5 text-right font-mono">{m.timestamp}</div>
                </div>
              </div>
            ))
          )}

          {/* AI loader indicator */}
          {isLoading && (
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-saffron/15 text-saffron border border-saffron/20 flex items-center justify-center animate-bounce">
                N
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputMessage);
          }}
          className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50/50"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask about RTI drafts, municipal duties, street bylaws..."
            disabled={isLoading}
            className="flex-1 bg-white border border-slate-200 px-4 py-3 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy disabled:bg-slate-50 transition-all font-medium"
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="px-5 bg-navy text-white rounded-xl text-xs font-semibold hover:bg-navy-hover transition-colors shadow-sm cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
          >
            <span>Send</span>
            <Send className="w-3 h-3" />
          </button>
        </form>
      </div>

    </div>
  );
}

export default memo(CivicBot);
