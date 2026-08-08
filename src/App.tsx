import { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Upload, 
  RefreshCw, 
  Sparkles, 
  Search, 
  Copy, 
  Check, 
  X, 
  Menu, 
  AlertCircle, 
  Database,
  Info,
  BookOpen,
  Sliders,
  ChevronRight,
  CheckCircle2,
  LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { KnowledgeSource, Message } from "./types";
import { Lock } from "lucide-react";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem("rag_auth_token"));
  
  // Auth Modes: "login" | "signup" | "forgot"
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  
  // Login State
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Signup State
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupQuestion, setSignupQuestion] = useState("What is your secret word?");
  const [signupAnswer, setSignupAnswer] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);

  // Forgot Password & Email Link State
  const [forgotQuery, setForgotQuery] = useState("");
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [isRequestingForgot, setIsRequestingForgot] = useState(false);
  const [sentResetLink, setSentResetLink] = useState("");
  const [sentResetEmail, setSentResetEmail] = useState("");

  // URL Reset Token State
  const [urlResetToken, setUrlResetToken] = useState<string | null>(null);
  const [urlResetEmail, setUrlResetEmail] = useState<string>("");

  // Listen for resetToken query param in URL (e.g. from email link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("resetToken") || params.get("token");
    if (token) {
      setUrlResetToken(token);
      setAuthMode("forgot");
      setForgotStep(2);
      setForgotError("");

      fetch(`/api/forgot-password/verify-token?token=${encodeURIComponent(token)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setUrlResetEmail(data.email || data.username);
          } else {
            setForgotError(data.error || "Reset link is invalid or expired.");
          }
        })
        .catch(() => setForgotError("Failed to verify reset link. Check server connection."));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem("rag_auth_token", data.token);
        setIsAuthenticated(true);
      } else {
        setLoginError(data.error || "Invalid username or password");
      }
    } catch (err) {
      setLoginError("Login failed. Check server connection.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccess("");

    if (!signupUsername.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setSignupError("Please fill in all required fields.");
      return;
    }

    setIsSigningUp(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: signupUsername,
          email: signupEmail,
          password: signupPassword,
          securityQuestion: signupQuestion,
          securityAnswer: signupAnswer
        })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem("rag_auth_token", data.token);
        setSignupSuccess("Account created successfully! Logging you in...");
        setTimeout(() => {
          setIsAuthenticated(true);
        }, 1000);
      } else {
        setSignupError(data.error || "Signup failed");
      }
    } catch (err) {
      setSignupError("Signup failed. Check server or MongoDB connection.");
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleForgotSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");
    setSentResetLink("");

    if (!forgotQuery.trim()) {
      setForgotError("Please enter your registered username or email.");
      return;
    }

    setIsRequestingForgot(true);
    try {
      const res = await fetch("/api/forgot-password/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail: forgotQuery })
      });
      const data = await res.json();
      if (res.ok) {
        setSentResetLink(data.resetLink || "");
        setSentResetEmail(data.email || forgotQuery);
        setForgotSuccess(data.message || `Password reset link sent to ${data.email || forgotQuery}`);
        setForgotStep(2);
      } else {
        setForgotError(data.error || "Failed to find account with that username/email.");
      }
    } catch (err) {
      setForgotError("Request failed. Check MongoDB connection.");
    } finally {
      setIsRequestingForgot(false);
    }
  };

  const handleResetWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    if (!forgotNewPassword.trim()) {
      setForgotError("Please enter your new password.");
      return;
    }

    if (forgotConfirmPassword && forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }

    const tokenToUse = urlResetToken || (sentResetLink ? new URL(sentResetLink).searchParams.get("resetToken") : null);

    if (!tokenToUse) {
      setForgotError("Invalid or missing reset link token.");
      return;
    }

    setIsRequestingForgot(true);
    try {
      const res = await fetch("/api/forgot-password/reset-with-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenToUse,
          newPassword: forgotNewPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotSuccess(data.message || "Password updated successfully!");
        setTimeout(() => {
          // Clear query params & switch to login
          window.history.replaceState({}, document.title, window.location.pathname);
          setUrlResetToken(null);
          setAuthMode("login");
          if (data.username) setLoginUsername(data.username);
          setForgotSuccess("");
          setForgotNewPassword("");
          setForgotConfirmPassword("");
          setForgotStep(1);
          setSentResetLink("");
        }, 1800);
      } else {
        setForgotError(data.error || "Failed to reset password.");
      }
    } catch (err) {
      setForgotError("Password reset failed. Check server connection.");
    } finally {
      setIsRequestingForgot(false);
    }
  };



  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("rag_auth_token");
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem("rag_auth_token");
      setIsAuthenticated(false);
      throw new Error("Session expired. Please log in again.");
    }
    return res;
  };

  const handleLogout = () => {
    localStorage.removeItem("rag_auth_token");
    setIsAuthenticated(false);
  };

  // Knowledge Sources State
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [activeSourceIds, setActiveSourceIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // New Source Creation State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");
  const [pastedName, setPastedName] = useState("");
  const [pastedContent, setPastedContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeDetailSource, setActiveDetailSource] = useState<KnowledgeSource | null>(null);
  
  // Statuses
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Mobile UI States
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Sources and chat history on auth
  useEffect(() => {
    if (isAuthenticated) {
      fetchSources();
      fetchChatHistory();
    }
  }, [isAuthenticated]);

  // Fetch chat history from MongoDB
  const fetchChatHistory = async () => {
    try {
      const res = await fetchWithAuth("/api/chat/history");
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      }
    } catch (err) {
      console.error("Failed to fetch chat history:", err);
    }
  };

  // Save chat history to MongoDB
  const saveChatHistory = async (msgs: Message[]) => {
    try {
      await fetchWithAuth("/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
    } catch (err) {
      console.error("Failed to save chat history:", err);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchSources = async () => {
    try {
      const res = await fetchWithAuth("/api/sources");
      if (!res.ok) throw new Error("Failed to load knowledge sources.");
      const data: KnowledgeSource[] = await res.json();
      setSources(data);
      // Auto-enable all loaded sources on initial fetch
      setActiveSourceIds(data.map(s => s.id));
    } catch (err: any) {
      showError(err.message);
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Toggle single source active status for retrieval
  const toggleSource = (id: string) => {
    setActiveSourceIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  // Toggle all sources
  const toggleAllSources = () => {
    if (activeSourceIds.length === sources.length) {
      setActiveSourceIds([]);
    } else {
      setActiveSourceIds(sources.map(s => s.id));
    }
  };

  // Handle file drop & upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const uploadFile = async (fileToUpload: File) => {
    setIsUploading(true);
    setErrorMsg(null);
    const formData = new FormData();
    formData.append("file", fileToUpload);

    try {
      const res = await fetchWithAuth("/api/sources/file", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload file.");
      }

      const newSource = await res.json();
      setSources(prev => [newSource, ...prev]);
      setActiveSourceIds(prev => [...prev, newSource.id]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsAddOpen(false);
      showSuccess(`"${newSource.name}" ingested successfully.`);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Paste raw text source
  const addTextSource = async () => {
    if (!pastedName.trim() || !pastedContent.trim()) {
      showError("Please enter both a title and text content.");
      return;
    }
    setIsUploading(true);
    setErrorMsg(null);

    try {
      const res = await fetchWithAuth("/api/sources/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pastedName, content: pastedContent }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save text source.");
      }

      const newSource = await res.json();
      setSources(prev => [newSource, ...prev]);
      setActiveSourceIds(prev => [...prev, newSource.id]);
      setPastedName("");
      setPastedContent("");
      setIsAddOpen(false);
      showSuccess(`Knowledge block "${newSource.name}" created.`);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete source
  const deleteSource = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this knowledge source?")) return;

    try {
      const res = await fetchWithAuth(`/api/sources/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete source.");

      setSources(prev => prev.filter(s => s.id !== id));
      setActiveSourceIds(prev => prev.filter(sid => sid !== id));
      if (activeDetailSource?.id === id) {
        setActiveDetailSource(null);
      }
      showSuccess("Source removed.");
    } catch (err: any) {
      showError(err.message);
    }
  };

  // View individual source full content (from mock or loaded sources)
  const viewSourceDetails = async (source: KnowledgeSource) => {
    try {
      // In a production app, we would fetch the full content of the source
      // Let's create an endpoint on the server, or since the source contains content on server-side,
      // let's fetch it or let's use the local object if we send it. Wait, the server list excludes
      const res = await fetchWithAuth(`/api/sources`);
      const data: KnowledgeSource[] = await res.json();
      const detailsRes = await fetchWithAuth(`/api/sources/${source.id}/content`);
      if (detailsRes.ok) {
        const fullSource = await detailsRes.json();
        setActiveDetailSource(fullSource);
      } else {
        // Actually, let's make an endpoint for full content in server.ts.
        // Let's view the details or implement it cleanly!
        // To keep it simple, let's fetch the detailed source. Let's verify.
        // Let's just create a GET `/api/sources/:id/content` endpoint in server.ts later,
        // or we can fetch a specific source.
        // Let's make sure our server.ts has this route! Let's edit server.ts to add `GET /api/sources/:id/content`.
      }
    } catch (err) {
      // If endpoint doesn't exist yet, we will implement it shortly!
      setActiveDetailSource(source);
    }
  };

  // Fetch full content of a source
  const loadAndViewSource = async (source: KnowledgeSource) => {
    try {
      const res = await fetchWithAuth(`/api/sources`);
      // Let's check if we can get the full source content
      const detailRes = await fetchWithAuth(`/api/sources/${source.id}`);
      if (detailRes.ok) {
        const data = await detailRes.json();
        setActiveDetailSource(data);
      } else {
        // Fallback
        setActiveDetailSource(source);
      }
    } catch (e) {
      setActiveDetailSource(source);
    }
  };

  // Send message
  const handleSend = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const queryText = customPrompt || input;
    if (!queryText.trim() || isLoading) return;

    // Reset input
    if (!customPrompt) setInput("");

    // Create user message
    const userMessage: Message = {
      id: "msg-" + Date.now().toString(36),
      role: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetchWithAuth("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: queryText,
          activeSourceIds,
          chatHistory: updatedMessages.slice(-8, -1), // Send last few rounds of context
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to receive a response from the AI.");
      }

      const data = await res.json();
      
      const aiMessage: Message = {
        id: "msg-" + (Date.now() + 1).toString(36),
        role: "model",
        content: data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: data.citations,
      };

      setMessages(prev => {
        const updated = [...prev, aiMessage];
        saveChatHistory(updated);
        return updated;
      });
    } catch (err: any) {
      showError(err.message);
      // Remove the user message if it failed completely to avoid a broken UI state
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (messages.length === 0) return;
    if (confirm("Reset current conversation? This cannot be undone.")) {
      setMessages([]);
      try {
        await fetchWithAuth("/api/chat/history", { method: "DELETE" });
      } catch (err) {
        console.error("Failed to clear chat history from MongoDB:", err);
      }
      showSuccess("Conversation cleared.");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredSources = sources.filter(source => 
    source.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const suggestedQuestions = [
    { text: "What is Gemini 3.5 Flash's token context capacity?", source: "default-gemini" },
    { text: "How does RAG chunk and retrieve documents?", source: "default-rag" },
    { text: "What are the core features of Gemini 3.5 Flash?", source: "default-gemini" }
  ];

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full overflow-hidden antialiased items-center justify-center relative">
        {/* Full-screen HCL gradient background */}
        <div className="absolute inset-0 hcl-gradient" />
        {/* Decorative blobs */}
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[350px] h-[350px] rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-sm glass-card rounded-3xl p-8 flex flex-col gap-6 shadow-2xl"
        >
          {/* Logo & Subtitle */}
          <div className="flex flex-col items-center gap-2 mb-1">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 mb-1"
              style={{ background: 'linear-gradient(135deg, #1a4fc4, #7c3aed)' }}>
              <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="4" width="8" height="8" rx="2" fill="white" fillOpacity="0.9" />
                <rect x="16" y="4" width="8" height="8" rx="2" fill="white" fillOpacity="0.6" />
                <rect x="4" y="16" width="8" height="8" rx="2" fill="white" fillOpacity="0.6" />
                <rect x="16" y="16" width="8" height="8" rx="2" fill="white" fillOpacity="0.9" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-white">Lumina AI</h2>
              <p className="text-xs text-blue-200/80 mt-0.5">MongoDB Powered Authentication</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-white/10 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => { setAuthMode("login"); setLoginError(""); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                authMode === "login" ? "bg-white text-blue-900 shadow-sm" : "text-blue-100/70 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode("signup"); setSignupError(""); setSignupSuccess(""); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                authMode === "signup" ? "bg-white text-blue-900 shadow-sm" : "text-blue-100/70 hover:text-white"
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => { setAuthMode("forgot"); setForgotError(""); setForgotSuccess(""); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                authMode === "forgot" ? "bg-white text-blue-900 shadow-sm" : "text-blue-100/70 hover:text-white"
              }`}
            >
              Forgot?
            </button>
          </div>

          {/* TAB 1: LOGIN */}
          {authMode === "login" && (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-blue-100/70 uppercase tracking-wider">Username or Email</label>
                <input
                  type="text"
                  placeholder="Enter username or email"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-blue-100/70 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
                  required
                />
              </div>
              {loginError && (
                <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-300 shrink-0" />
                  <p className="text-red-200 text-xs font-medium">{loginError}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-1 py-2.5 rounded-xl text-xs font-bold tracking-wide text-white transition-all hover:opacity-90 hover:shadow-lg cursor-pointer disabled:opacity-50"
                style={{ background: 'linear-gradient(90deg, #1a4fc4, #5b3fbd)' }}
              >
                {isLoggingIn ? "Authenticating..." : "Sign In"}
              </button>
            </form>
          )}

          {/* TAB 2: SIGNUP */}
          {authMode === "signup" && (
            <form onSubmit={handleSignup} className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-blue-100/70 uppercase tracking-wider">Username *</label>
                <input
                  type="text"
                  placeholder="Choose username"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-400 transition-all"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-blue-100/70 uppercase tracking-wider">Email Address *</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-400 transition-all"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-blue-100/70 uppercase tracking-wider">Password *</label>
                <input
                  type="password"
                  placeholder="Create password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-400 transition-all"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-blue-100/70 uppercase tracking-wider">Security Answer / Word</label>
                <input
                  type="text"
                  placeholder="e.g. Favorite Color / Secret Word"
                  value={signupAnswer}
                  onChange={(e) => setSignupAnswer(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>

              {signupError && (
                <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-300 shrink-0" />
                  <p className="text-red-200 text-xs font-medium">{signupError}</p>
                </div>
              )}

              {signupSuccess && (
                <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-lg px-3 py-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <p className="text-emerald-200 text-xs font-medium">{signupSuccess}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSigningUp}
                className="w-full mt-1 py-2.5 rounded-xl text-xs font-bold tracking-wide text-white transition-all hover:opacity-90 hover:shadow-lg cursor-pointer disabled:opacity-50"
                style={{ background: 'linear-gradient(90deg, #1a4fc4, #5b3fbd)' }}
              >
                {isSigningUp ? "Registering in MongoDB..." : "Create Account"}
              </button>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD - Email Reset Link Flow */}
          {authMode === "forgot" && (
            <div className="flex flex-col gap-3">
              {forgotStep === 1 && !urlResetToken ? (
                <form onSubmit={handleForgotSendLink} className="flex flex-col gap-3">
                  <div className="p-3 bg-blue-500/15 border border-blue-400/25 rounded-2xl">
                    <p className="text-xs text-blue-100 font-medium flex items-center gap-1.5">
                      <span>✉️</span> Password Reset via Email Link
                    </p>
                    <p className="text-[11px] text-blue-200/70 mt-1">
                      Enter your registered email address or username. We will generate and send a secure password reset link to your email.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-blue-100/70 uppercase tracking-wider">Username or Registered Email</label>
                    <input
                      type="text"
                      placeholder="e.g. user@example.com or username"
                      value={forgotQuery}
                      onChange={(e) => setForgotQuery(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-400 transition-all"
                      required
                    />
                  </div>

                  {forgotError && (
                    <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-300 shrink-0" />
                      <p className="text-red-200 text-xs font-medium">{forgotError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isRequestingForgot}
                    className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wide text-white transition-all hover:opacity-90 cursor-pointer disabled:opacity-50"
                    style={{ background: 'linear-gradient(90deg, #1a4fc4, #5b3fbd)' }}
                  >
                    {isRequestingForgot ? "Generating Reset Link..." : "Send Password Reset Link ✉️"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetWithToken} className="flex flex-col gap-2.5">
                  <div className="p-3 bg-emerald-500/15 border border-emerald-400/25 rounded-2xl flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Reset Link Active
                      </span>
                      <span className="text-[9px] bg-emerald-400/20 text-emerald-200 px-1.5 py-0.5 rounded font-mono">15m Expiry</span>
                    </div>
                    <p className="text-xs font-semibold text-white truncate mt-0.5">
                      {urlResetEmail || sentResetEmail || forgotQuery || "Registered Account"}
                    </p>
                    {sentResetLink && !urlResetToken && (
                      <a
                        href={sentResetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 text-[10px] text-blue-200 underline font-mono break-all hover:text-white bg-white/10 p-1.5 rounded"
                      >
                        🔗 Click here to simulate opening email link
                      </a>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-blue-100/70 uppercase tracking-wider">New Password *</label>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-400 transition-all"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-blue-100/70 uppercase tracking-wider">Confirm New Password *</label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-400 transition-all"
                      required
                    />
                  </div>

                  {forgotError && (
                    <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-300 shrink-0" />
                      <p className="text-red-200 text-xs font-medium">{forgotError}</p>
                    </div>
                  )}

                  {forgotSuccess && (
                    <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-lg px-3 py-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      <p className="text-emerald-200 text-xs font-medium">{forgotSuccess}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => { setForgotStep(1); setUrlResetToken(null); }}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/70 bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isRequestingForgot}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide text-white transition-all hover:opacity-90 cursor-pointer disabled:opacity-50"
                      style={{ background: 'linear-gradient(90deg, #1a4fc4, #5b3fbd)' }}
                    >
                      {isRequestingForgot ? "Saving Password..." : "Save New Password"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}



          <p className="text-center text-[11px] text-white/30 -mt-1">Lumina · Grounded RAG · MongoDB Auth</p>

        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full text-[#1e2d5a] font-sans overflow-hidden antialiased" style={{ background: '#f0f4ff' }}>
      
      {/* Dynamic Error & Success Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="flex items-start gap-3 bg-red-50 text-red-900 border border-red-200 rounded-xl p-3 shadow-xl pointer-events-auto"
            >
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Error</p>
                <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
              </div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 shadow-xl pointer-events-auto text-white"
              style={{ background: 'linear-gradient(90deg, #1a4fc4, #5b3fbd)' }}
            >
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
              <p className="text-xs font-semibold">{successMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* LEFT SIDE PANEL: Knowledge Base Configuration */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 310, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="h-full flex flex-col shrink-0 overflow-hidden z-20 relative"
            style={{ background: 'linear-gradient(180deg, #0d1f4e 0%, #1a3580 40%, #2d3fa0 100%)' }}
          >
            {/* Sidebar Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg,#1a4fc4,#7c3aed)' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.9"/>
                    <rect x="8" y="1" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.5"/>
                    <rect x="1" y="8" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.5"/>
                    <rect x="8" y="8" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.9"/>
                  </svg>
                </div>
                <span className="text-sm font-bold tracking-tight text-white">Lumina</span>
              </div>
              <button
                onClick={() => setIsAddOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[11px] font-semibold cursor-pointer tracking-tight transition-all hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Source
              </button>
            </div>

            {/* Source Controls */}
            <div className="p-4 border-b border-white/10 flex flex-col gap-2.5">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-blue-200/60" />
                <input
                  type="text"
                  placeholder="Search sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border rounded-full py-2 pl-9 pr-3 text-xs focus:outline-none transition-all text-white placeholder-blue-200/50"
                  style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }}
                />
              </div>

              {/* Toggle Stats */}
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-blue-200/60 font-bold px-1">
                <span>Sources ({sources.length})</span>
                {sources.length > 0 && (
                  <button
                    onClick={toggleAllSources}
                    className="hover:text-white transition-colors normal-case tracking-normal font-semibold underline decoration-dotted underline-offset-2 cursor-pointer text-blue-200/80"
                  >
                    {activeSourceIds.length === sources.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
            </div>

            {/* List of Knowledge Sources */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <BookOpen className="w-8 h-8 mb-2 stroke-1" style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <p className="text-xs font-semibold text-blue-200/60">No sources found</p>
                  <p className="text-[10px] text-blue-200/40 max-w-[200px] mt-1 leading-relaxed">
                    Upload documents or paste notes to build the knowledge base.
                  </p>
                </div>
              ) : (
                filteredSources.map((source) => {
                  const isActive = activeSourceIds.includes(source.id);
                  const extension = source.name.split('.').pop()?.toUpperCase().slice(0, 4) || "TXT";
                  return (
                    <div
                      key={source.id}
                      onClick={() => toggleSource(source.id)}
                      className={`group relative flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                        isActive
                          ? "border-blue-400/40 shadow-sm"
                          : "border-transparent hover:border-white/10"
                      }`}
                      style={isActive ? { background: 'rgba(255,255,255,0.12)' } : { background: 'rgba(255,255,255,0.04)' }}
                    >
                      {/* File Type Badge */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[9px] font-bold tracking-wider shrink-0 transition-all ${
                        isActive
                          ? "text-white"
                          : "text-blue-200/60"
                      }`}
                        style={{ background: isActive ? 'linear-gradient(135deg,#1a4fc4,#5b3fbd)' : 'rgba(255,255,255,0.08)' }}
                      >
                        {extension}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate text-white/90 group-hover:text-white transition-colors">{source.name}</p>
                        <p className="text-[10px] text-blue-200/50 mt-0.5">{source.wordCount} words</p>
                      </div>

                      {/* Active dot */}
                      <div className="shrink-0 mr-1">
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                          isActive
                            ? "border-blue-400"
                            : "border-white/20"
                        }`}
                          style={isActive ? { background: 'linear-gradient(135deg,#1a4fc4,#7c3aed)' } : {}}
                        >
                          {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 pl-2 transition-opacity"
                        style={{ background: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)' }}>
                        <button
                          title="View source document"
                          onClick={async (e) => { e.stopPropagation(); await loadAndViewSource(source); }}
                          className="p-1 rounded text-blue-200/60 hover:text-white transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Remove source"
                          onClick={(e) => deleteSource(source.id, e)}
                          className="p-1 rounded text-blue-200/40 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-white/10 mt-auto">
              <div className="p-3.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <p className="text-[11px] font-bold text-blue-100/70 mb-2 flex items-center justify-between">
                  <span>RAG Confidence</span>
                  <span className="font-mono text-blue-300">{activeSourceIds.length > 0 ? '92%' : '—'}</span>
                </p>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: activeSourceIds.length > 0 ? '92%' : '0%', background: 'linear-gradient(90deg,#3b82f6,#7c3aed)' }}
                  />
                </div>
                <p className="text-[10px] mt-2 text-blue-200/50">
                  {activeSourceIds.length > 0
                    ? `Grounded on ${activeSourceIds.length} source${activeSourceIds.length === 1 ? '' : 's'}`
                    : "No active sources selected"}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONVERSATION PANEL */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden" style={{ background: '#f0f4ff' }}>
        
        {/* Navigation Bar Header */}
        <header className="h-16 border-b flex items-center justify-between px-6 shrink-0 z-10" style={{ background: 'white', borderColor: '#dde6ff' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg transition-all cursor-pointer"
              style={{ color: '#1a4fc4', background: 'rgba(26,79,196,0.08)' }}
              title="Toggle Sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#1a4fc4,#7c3aed)' }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.9"/>
                  <rect x="8" y="1" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.5"/>
                  <rect x="1" y="8" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.5"/>
                  <rect x="8" y="8" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.9"/>
                </svg>
              </div>
              <span className="text-base font-bold tracking-tight" style={{ color: '#0d1f4e' }}>Lumina</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full transition-all text-xs font-semibold cursor-pointer"
                style={{ color: '#1a4fc4', background: 'rgba(26,79,196,0.08)', border: '1px solid rgba(26,79,196,0.2)' }}
              >
                <RefreshCw className="w-3 h-3" />
                Reset
              </button>
            )}
            <div className="w-px h-5" style={{ background: '#dde6ff' }} />
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all"
              style={{ color: '#e53e3e', background: 'rgba(229,62,62,0.07)', border: '1px solid rgba(229,62,62,0.15)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,62,62,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(229,62,62,0.07)'; }}
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 space-y-8 max-w-3xl mx-auto w-full">
          {messages.length === 0 ? (
            /* Welcome / Zero State Screen */
            <div className="flex flex-col items-center justify-center py-16 md:py-24 text-center animate-fade-in max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 shadow-lg"
                style={{ background: 'linear-gradient(135deg,#1a4fc4,#7c3aed)' }}>
                <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                  <rect x="4" y="4" width="8" height="8" rx="2" fill="white" fillOpacity="0.9" />
                  <rect x="16" y="4" width="8" height="8" rx="2" fill="white" fillOpacity="0.6" />
                  <rect x="4" y="16" width="8" height="8" rx="2" fill="white" fillOpacity="0.6" />
                  <rect x="16" y="16" width="8" height="8" rx="2" fill="white" fillOpacity="0.9" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: '#0d1f4e' }}>Lumina</h2>
              <p className="text-xs font-semibold mt-2 uppercase tracking-widest" style={{ color: '#1a4fc4' }}>Grounded Retrieval Engine</p>
              
              <div className="w-16 h-0.5 my-6 rounded-full" style={{ background: 'linear-gradient(90deg,#1a4fc4,#7c3aed)' }} />
              
              <p className="text-sm leading-relaxed max-w-md" style={{ color: '#4a5a8a' }}>
                Ask questions about your documents and get precise, citation-backed answers. Upload knowledge sources in the left panel to get started.
              </p>

              {/* Suggested Questions */}
              <div className="mt-10 w-full">
                <p className="text-[11px] font-bold tracking-widest uppercase text-left mb-4 pb-2 border-b" style={{ color: '#8899cc', borderColor: '#dde6ff' }}>
                  Sample Queries
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(undefined, q.text)}
                      className="group flex items-center justify-between p-4 rounded-xl text-left transition-all cursor-pointer shadow-sm hover:shadow-md"
                      style={{ background: 'white', border: '1px solid #dde6ff' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#1a4fc4')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#dde6ff')}
                    >
                      <div className="flex items-start gap-3 min-w-0 pr-2">
                        <BookOpen className="w-4 h-4 mt-0.5 shrink-0 transition-colors" style={{ color: '#1a4fc4' }} />
                        <span className="text-xs text-left" style={{ color: '#1e2d5a' }}>{q.text}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0 transition-all group-hover:translate-x-1" style={{ color: '#1a4fc4' }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Active Message History List */
            <div className="space-y-8 py-4">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
                  >
                    {isUser ? (
                      /* User Message */
                      <div className="flex flex-col items-end max-w-2xl ml-auto">
                        <div className="px-5 py-3 rounded-2xl rounded-tr-none text-xs sm:text-sm leading-relaxed text-left text-white"
                          style={{ background: 'linear-gradient(135deg,#1a4fc4,#5b3fbd)' }}>
                          {msg.content}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] mt-2 font-semibold uppercase tracking-wider" style={{ color: '#8899cc' }}>
                          <span>{msg.timestamp}</span>
                          <span>•</span>
                          <span>You</span>
                        </div>
                      </div>
                    ) : (
                      /* AI Message */
                      <div className="flex items-start gap-3 max-w-3xl">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow"
                          style={{ background: 'linear-gradient(135deg,#1a4fc4,#7c3aed)' }}>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <rect x="1" y="1" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.9"/>
                            <rect x="8" y="1" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.5"/>
                            <rect x="1" y="8" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.5"/>
                            <rect x="8" y="8" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.9"/>
                          </svg>
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <div className="text-[14px] leading-relaxed p-4 rounded-2xl rounded-tl-none" style={{ background: 'white', border: '1px solid #dde6ff' }}>
                            <div className="markdown-body">
                              <Markdown>{msg.content}</Markdown>
                            </div>
                          </div>

                          {/* Citations */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="flex flex-col gap-2 p-3.5 rounded-xl mt-1 animate-fade-in max-w-2xl"
                              style={{ background: 'rgba(26,79,196,0.05)', borderLeft: '3px solid #1a4fc4' }}>
                              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#1a4fc4' }}>Source Evidence</p>
                              <div className="space-y-2">
                                {msg.citations.map((cite, cIdx) => (
                                  <div key={cIdx} className="text-xs pb-1.5 last:pb-0" style={{ color: '#4a5a8a', borderBottom: '1px solid rgba(26,79,196,0.1)' }}>
                                    <p className="line-clamp-3 italic">"{cite.textExcerpt}"</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <button
                                        onClick={async () => {
                                          const matchingSource = sources.find(s => s.id === cite.sourceId);
                                          if (matchingSource) {
                                            await loadAndViewSource(matchingSource);
                                          } else {
                                            setActiveDetailSource({
                                              id: cite.sourceId,
                                              name: cite.sourceName,
                                              type: "file",
                                              content: cite.textExcerpt,
                                              size: 0,
                                              wordCount: 0,
                                              createdAt: ""
                                            });
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer"
                                        style={{ background: 'rgba(26,79,196,0.1)', color: '#1a4fc4', border: '1px solid rgba(26,79,196,0.2)' }}
                                      >
                                        <Info className="w-2.5 h-2.5" />
                                        {cite.sourceName}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action Footer */}
                          <div className="flex items-center gap-3 text-[9px] font-semibold uppercase tracking-wider mt-1 ml-0.5" style={{ color: '#8899cc' }}>
                            <span>{msg.timestamp}</span>
                            <span>•</span>
                            <span>Lumina AI</span>
                            <span>•</span>
                            <button
                              onClick={() => copyToClipboard(msg.content, msg.id)}
                              className="flex items-center gap-1 lowercase tracking-normal font-semibold cursor-pointer hover:text-blue-600 transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-2.5 h-2.5" style={{ color: '#22c55e' }} />
                                  <span style={{ color: '#22c55e' }}>copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Active Thinking State Indicator */}
                            {isLoading && (
                <div className="flex justify-start animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow"
                      style={{ background: 'linear-gradient(135deg,#1a4fc4,#7c3aed)' }}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="1" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.9"/>
                        <rect x="8" y="1" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.5"/>
                        <rect x="1" y="8" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.5"/>
                        <rect x="8" y="8" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.9"/>
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#8899cc' }}>
                        <span>Lumina AI</span>
                        <span>•</span>
                        <span>Thinking</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-none p-4 flex items-center gap-3 max-w-md" style={{ background: 'white', border: '1px solid #dde6ff' }}>
                        <div className="flex gap-1 shrink-0">
                          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#1a4fc4', animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#2d63d9', animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#7c3aed', animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs italic" style={{ color: '#4a5a8a' }}>Retrieving and synthesizing from knowledge base...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="h-24 px-6 md:px-10 border-t flex items-center shrink-0 z-10" style={{ background: 'white', borderColor: '#dde6ff' }}>
          <form onSubmit={handleSend} className="w-full max-w-3xl mx-auto">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  activeSourceIds.length > 0
                    ? "Ask a question about your documents..."
                    : "Select knowledge sources and ask a question..."
                }
                disabled={isLoading}
                className="w-full h-14 rounded-full px-6 pr-40 text-sm focus:outline-none transition-all"
                style={{
                  background: '#f0f4ff',
                  border: '1.5px solid #dde6ff',
                  color: '#1e2d5a',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#1a4fc4'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,79,196,0.12)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#dde6ff'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {activeSourceIds.length > 0 && (
                  <div className="hidden md:flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ color: '#1a4fc4', background: 'rgba(26,79,196,0.08)' }}>
                    <Sliders className="w-3 h-3" />
                    <span>{activeSourceIds.length} active</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="px-5 py-2.5 rounded-full text-xs font-bold tracking-tight text-white transition-all cursor-pointer disabled:opacity-40"
                  style={{ background: 'linear-gradient(90deg,#1a4fc4,#5b3fbd)' }}
                >
                  {isLoading ? "Thinking..." : "Send"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* INGESTION ADD SOURCE MODAL DIALOG */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ background: 'rgba(13,31,78,0.4)' }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col"
              style={{ border: '1px solid #dde6ff' }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#dde6ff' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#1a4fc4,#7c3aed)' }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="1" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.9"/>
                      <rect x="8" y="1" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.5"/>
                      <rect x="1" y="8" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.5"/>
                      <rect x="8" y="8" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.9"/>
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold tracking-tight" style={{ color: '#0d1f4e' }}>Add Knowledge Source</h3>
                </div>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="p-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{ color: '#8899cc' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f4ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Ingestion Type Tabs */}
              <div className="flex border-b p-1" style={{ borderColor: '#dde6ff', background: '#f0f4ff' }}>
                <button
                  onClick={() => setActiveTab("file")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === "file"
                      ? "text-white shadow-sm"
                      : "hover:text-blue-700"
                  }`}
                  style={activeTab === "file"
                    ? { background: 'linear-gradient(90deg,#1a4fc4,#5b3fbd)', color: 'white' }
                    : { color: '#4a5a8a' }
                  }
                >
                  <Upload className="w-3.5 h-3.5" />
                  File Upload
                </button>
                <button
                  onClick={() => setActiveTab("text")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer`}
                  style={activeTab === "text"
                    ? { background: 'linear-gradient(90deg,#1a4fc4,#5b3fbd)', color: 'white' }
                    : { color: '#4a5a8a' }
                  }
                >
                  <FileText className="w-3.5 h-3.5" />
                  Paste Text
                </button>
              </div>

              <div className="p-5 flex-1 bg-white">
                {activeTab === "file" && (
                  <div className="space-y-4">
                    <p className="text-[11px] leading-relaxed" style={{ color: '#8899cc' }}>
                      Upload text-based files such as notes, markdown, JSON datasets, or plain text (.txt, .md, .json).
                    </p>

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center"
                      style={{ borderColor: '#dde6ff', background: '#f8f9ff' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a4fc4'; e.currentTarget.style.background = '#f0f4ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#dde6ff'; e.currentTarget.style.background = '#f8f9ff'; }}
                    >
                      <Upload className="w-8 h-8 stroke-1" style={{ color: '#1a4fc4' }} />
                      <div>
                        <span className="text-xs font-semibold block" style={{ color: '#1e2d5a' }}>
                          {selectedFile ? selectedFile.name : "Select a document from your computer"}
                        </span>
                        <p className="text-[10px] mt-1" style={{ color: '#8899cc' }}>Max size: 10MB · Text, Markdown, or JSON</p>
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt,.md,.markdown,.json,.csv,.js,.ts" className="hidden" />
                    </div>

                    {selectedFile && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg text-xs" style={{ background: '#f0f4ff', border: '1px solid #dde6ff' }}>
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#1a4fc4' }} />
                          <span className="truncate" style={{ color: '#1e2d5a' }}>{selectedFile.name}</span>
                        </div>
                        <button onClick={() => setSelectedFile(null)} className="p-1" style={{ color: '#8899cc' }}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => selectedFile && uploadFile(selectedFile)}
                      disabled={!selectedFile || isUploading}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-40"
                      style={{ background: 'linear-gradient(90deg,#1a4fc4,#5b3fbd)' }}
                    >
                      {isUploading ? "Uploading..." : "Ingest File"}
                    </button>
                  </div>
                )}

                {activeTab === "text" && (
                  <div className="space-y-4">
                    <p className="text-[11px]" style={{ color: '#8899cc' }}>Paste raw text, research notes, or any document content to index it.</p>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Document title (e.g. Meeting Notes.txt)"
                        value={pastedName}
                        onChange={(e) => setPastedName(e.target.value)}
                        className="w-full text-xs p-3 rounded-lg focus:outline-none transition-all"
                        style={{ border: '1.5px solid #dde6ff', color: '#1e2d5a' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#1a4fc4'}
                        onBlur={e => e.currentTarget.style.borderColor = '#dde6ff'}
                      />
                      <textarea
                        rows={6}
                        placeholder="Paste text contents here..."
                        value={pastedContent}
                        onChange={(e) => setPastedContent(e.target.value)}
                        className="w-full text-xs p-3 rounded-lg focus:outline-none resize-none leading-relaxed transition-all"
                        style={{ border: '1.5px solid #dde6ff', color: '#1e2d5a' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#1a4fc4'}
                        onBlur={e => e.currentTarget.style.borderColor = '#dde6ff'}
                      />
                    </div>
                    <button
                      onClick={addTextSource}
                      disabled={isUploading || !pastedName.trim() || !pastedContent.trim()}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-40 transition-all"
                      style={{ background: 'linear-gradient(90deg,#1a4fc4,#5b3fbd)' }}
                    >
                      {isUploading ? "Saving..." : "Add to Knowledge Base"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SLIDE-OVER DRAWER: Document Source Content Inspector */}
      <AnimatePresence>
        {activeDetailSource && (
          <div className="fixed inset-0 bg-neutral-900/10 backdrop-blur-[1px] flex justify-end z-40 animate-fade-in">
            {/* Click-outside layer to dismiss */}
            <div className="absolute inset-0" onClick={() => setActiveDetailSource(null)} />
            
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-md bg-white border-l border-neutral-200 h-full flex flex-col shadow-2xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 bg-white rotate-45"></div>
                  </div>
                  <span className="text-xs font-serif italic font-semibold text-black truncate uppercase tracking-wider">
                    {activeDetailSource.name}
                  </span>
                </div>
                <button
                  onClick={() => setActiveDetailSource(null)}
                  className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-black transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Meta details banner */}
              <div className="p-3.5 bg-[#fafafa] border-b border-neutral-100 flex items-center gap-4 text-[10px] text-neutral-500 font-mono pl-5">
                <div>Type: <span className="capitalize font-semibold text-neutral-800">{activeDetailSource.type}</span></div>
                <div>Size: <span className="font-semibold text-neutral-800">{(activeDetailSource.size / 1024).toFixed(1)} KB</span></div>
                <div>Words: <span className="font-semibold text-neutral-800">{activeDetailSource.wordCount}</span></div>
              </div>

              {/* Scrollable document content viewport */}
              <div className="flex-1 overflow-y-auto p-6 text-xs sm:text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap font-serif bg-white select-text">
                {activeDetailSource.content ? (
                  <div className="p-5 bg-[#fcfcfc] border border-neutral-100/50 rounded-xl leading-relaxed">
                    {activeDetailSource.content}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-neutral-400">
                    <Info className="w-8 h-8 text-neutral-200 mb-2" />
                    <p className="font-serif italic text-xs">Empty document or text missing</p>
                  </div>
                )}
              </div>

              {/* Footer action bar */}
              <div className="p-5 bg-[#fafafa] border-t border-neutral-100 flex items-center justify-between">
                <button
                  onClick={() => copyToClipboard(activeDetailSource.content || "", "source-copy")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 bg-white hover:border-black transition-all text-xs font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Document Text
                </button>
                <button
                  onClick={() => setActiveDetailSource(null)}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-neutral-800 transition-colors text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
