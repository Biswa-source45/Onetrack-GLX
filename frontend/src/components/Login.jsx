import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion, MotionConfig } from "framer-motion"
import { Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock } from "lucide-react"
import { toast } from "sonner"
import { authService } from "../services/auth"
import { ledgerFont } from "../lib/ledgerTheme"
import { LedgerStampMark } from "../lib/ledgerMarks"

// ── Abstract Building Vector Illustration ─────────────────────────────────
function BuildingAbstractIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Ground Line */}
      <line x1="10" y1="390" x2="490" y2="390" stroke="#1E293B" strokeWidth="5" strokeLinecap="round" />

      {/* Far Left Building */}
      <path d="M 30 390 L 30 270 L 110 200 L 110 390 Z" fill="#F1F5F9" stroke="#1E293B" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M 110 390 L 110 200 L 180 160 L 180 390 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="3.5" strokeLinejoin="round" />

      {/* Mid Left Building with Diagonal Texture */}
      <path d="M 180 390 L 180 160 L 260 190 L 260 390 Z" fill="#EFF6FF" stroke="#1E293B" strokeWidth="3.5" strokeLinejoin="round" />
      <line x1="195" y1="185" x2="250" y2="370" stroke="#93C5FD" strokeWidth="2.5" strokeDasharray="5 5" />

      {/* Main Tall Center Skyscraper */}
      <path d="M 260 390 L 260 70 L 350 15 L 350 390 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="4" strokeLinejoin="round" />
      <path d="M 350 390 L 350 15 L 450 85 L 450 390 Z" fill="#DBEAFE" stroke="#1E293B" strokeWidth="4" strokeLinejoin="round" />

      {/* Architectural Window Slats on Main Building */}
      <line x1="275" y1="100" x2="335" y2="80" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <line x1="275" y1="135" x2="335" y2="115" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <line x1="275" y1="170" x2="335" y2="150" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <line x1="275" y1="205" x2="335" y2="185" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <line x1="275" y1="240" x2="335" y2="220" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <line x1="275" y1="275" x2="335" y2="255" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <line x1="275" y1="310" x2="335" y2="290" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <line x1="275" y1="345" x2="335" y2="325" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />

      {/* Accent Nodes */}
      <circle cx="350" cy="15" r="4" fill="#2563EB" />
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("login") // "login" or "forgot"

  // Login form states
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Forgot password OTP states
  const [forgotStep, setForgotStep] = useState(1) // 1: Email, 2: OTP, 3: New Password
  const [resetEmail, setResetEmail] = useState("")
  const [resetOtp, setResetOtp] = useState("")
  const [resetNewPassword, setResetNewPassword] = useState("")
  const [resetConfirmPassword, setResetConfirmPassword] = useState("")
  const [isResetting, setIsResetting] = useState(false)

  const handleLoginSubmit = async (e) => {
    e.preventDefault()

    if (!username.trim() || !password) {
      toast.error("Please enter both username/email and password")
      return
    }

    setIsLoading(true)

    try {
      const result = await authService.login(username.trim().toLowerCase(), password)

      if (result.ok && result.success) {
        toast.success(result.message || "Signed in successfully!")
        setTimeout(() => {
          setIsLoading(false)
          navigate("/dashboard")
        }, 500)
      } else {
        setIsLoading(false)
        const errorMsg = result.error?.message || "Invalid credentials"
        toast.error(`${errorMsg}`)
      }
    } catch (err) {
      setIsLoading(false)
      toast.error("Network connection error. Please verify server status.")
    }
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    if (!resetEmail.trim()) {
      toast.error("Please enter your registered email address")
      return
    }
    setIsResetting(true)
    try {
      const res = await authService.forgotPassword(resetEmail.trim())
      if (res.ok && res.success) {
        toast.success(res.message || "OTP code sent to your email!")
        setForgotStep(2)
      } else {
        toast.error(res.message || res.error?.message || "Failed to send OTP")
      }
    } catch (err) {
      toast.error("Network error sending OTP code")
    } finally {
      setIsResetting(false)
    }
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    if (!resetOtp.trim()) {
      toast.error("Please enter the 6-digit OTP code")
      return
    }
    setIsResetting(true)
    try {
      const res = await authService.verifyOTP(resetEmail.trim(), resetOtp.trim())
      if (res.ok && res.success) {
        toast.success("OTP verified successfully!")
        setForgotStep(3)
      } else {
        toast.error(res.message || res.error?.message || "Invalid or expired OTP")
      }
    } catch (err) {
      toast.error("Network error verifying OTP code")
    } finally {
      setIsResetting(false)
    }
  }

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    if (!resetNewPassword || !resetConfirmPassword) {
      toast.error("Please fill in all password fields")
      return
    }
    if (resetNewPassword.length < 8) {
      toast.error("New password must be at least 8 characters long")
      return
    }
    if (resetNewPassword !== resetConfirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setIsResetting(true)
    try {
      const res = await authService.resetPasswordOTP(resetEmail.trim(), resetOtp.trim(), resetNewPassword)
      if (res.ok && res.success) {
        toast.success("Password reset successfully! You can now sign in.")
        setActiveTab("login")
        setForgotStep(1)
        setResetEmail("")
        setResetOtp("")
        setResetNewPassword("")
        setResetConfirmPassword("")
      } else {
        toast.error(res.message || res.error?.message || "Failed to reset password")
      }
    } catch (err) {
      toast.error("Network error during password reset")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen w-screen flex items-center justify-center p-4 sm:p-6 bg-[#F4F6F9] text-slate-900 selection:bg-blue-600 selection:text-white">
        
        {/* COMPACT SPLIT CARD CONTAINER */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-4xl min-h-[500px] rounded-3xl bg-white border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col md:flex-row"
        >
          {/* LEFT SIDE: ABSTRACT BUILDING VECTOR & QUOTE HIGHLIGHT */}
          <div className="w-full md:w-[48%] p-6 sm:p-8 bg-[#F1F5F9] border-r border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
            {/* Top Platform Statement */}
            <div className="relative z-10 space-y-3">
              <span className="text-3xl text-blue-600 font-serif leading-none block font-bold select-none">“</span>
              <p className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed tracking-tight" style={{ fontFamily: ledgerFont.display }}>
                Every public tender entered in one unified workspace. Sequential stage gating, automated EMD tracking, and strict role authorization enforced across GeM & CPPP portals.
              </p>

              <div className="flex items-center gap-2.5 pt-1">
                <div className="size-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                  OT
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">OneTrack Governance</h4>
                  <p className="text-[10px] font-medium text-slate-500">Enterprise Operations Platform</p>
                </div>
              </div>
            </div>

            {/* Bottom Abstract Building Line-Art Vector */}
            <div className="relative z-10 mt-6 w-full max-w-xs mx-auto">
              <BuildingAbstractIllustration className="w-full h-auto drop-shadow-sm" />
            </div>
          </div>

          {/* RIGHT SIDE: SIGN IN / RESET PASSWORD FORM */}
          <div className="w-full md:w-[52%] p-6 sm:p-9 flex flex-col justify-between bg-[#FBFDFD]">
            <div>
              {/* Header Bar */}
              <div className="flex items-center justify-between mb-6">
                <Link to="/" className="inline-flex items-center gap-2 group">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-blue-100 border border-blue-200 text-blue-600">
                    <LedgerStampMark className="size-4" color="#2563eb" />
                  </span>
                  <span className="text-lg font-extrabold tracking-tight text-slate-900" style={{ fontFamily: ledgerFont.display }}>
                    OneTrack
                  </span>
                </Link>

                <Link to="/" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
                  <ArrowLeft className="size-3.5" />
                  <span>Home</span>
                </Link>
              </div>

              {/* Form Title Block */}
              <div className="space-y-1 mb-6">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: ledgerFont.display }}>
                  {activeTab === "login" ? "Sign In" : "Reset Password"}
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  {activeTab === "login"
                    ? "Please enter your credentials to access your workspace"
                    : "Enter your registered email to receive a 6-digit OTP code"}
                </p>
              </div>

              {/* TAB 1: SIGN IN FORM */}
              {activeTab === "login" && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Email or Username <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="hello@globx.co.in"
                        className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTab("forgot")}
                        className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: RESET OTP */}
              {activeTab === "forgot" && (
                <div className="space-y-3">
                  {forgotStep === 1 && (
                    <form onSubmit={handleSendOTP} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">Registered Work Email</label>
                        <input
                          type="email"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="name@globx.co.in"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isResetting}
                        className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
                      >
                        {isResetting ? <Loader2 className="size-3.5 animate-spin mx-auto" /> : "Send 6-Digit OTP"}
                      </button>
                    </form>
                  )}

                  {forgotStep === 2 && (
                    <form onSubmit={handleVerifyOTP} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">Enter 6-Digit Code</label>
                        <input
                          type="text"
                          maxLength={6}
                          required
                          value={resetOtp}
                          onChange={(e) => setResetOtp(e.target.value)}
                          placeholder="123456"
                          className="w-full text-center text-base font-mono font-bold tracking-widest bg-white border border-slate-300 rounded-xl px-3 py-2 text-blue-600 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setForgotStep(1)}
                          className="w-1/3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={isResetting}
                          className="w-2/3 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
                        >
                          {isResetting ? <Loader2 className="size-3.5 animate-spin mx-auto" /> : "Verify Code"}
                        </button>
                      </div>
                    </form>
                  )}

                  {forgotStep === 3 && (
                    <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">New Password</label>
                        <input
                          type="password"
                          required
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">Confirm Password</label>
                        <input
                          type="password"
                          required
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isResetting}
                        className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
                      >
                        {isResetting ? <Loader2 className="size-3.5 animate-spin mx-auto" /> : "Update Password"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Back To Sign In Link */}
            {activeTab === "forgot" && (
              <div className="pt-4 mt-4 border-t border-slate-200/80 text-center text-xs font-semibold text-slate-600">
                <button
                  onClick={() => setActiveTab("login")}
                  className="font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  )
}
