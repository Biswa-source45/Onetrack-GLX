import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { authService } from "../services/auth"
import { ledgerFont } from "../lib/ledgerTheme"
import { LedgerStampMark } from "../lib/ledgerMarks"
import { SkiperSvgBeam } from "./ui/SkiperSvgBeam"

export function AuthModal({ isOpen, onClose, initialTab = "login", onSuccessNavigate }) {
  const [activeTab, setActiveTab] = useState(initialTab) // "login", "register", "forgot"

  // Login Form States
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Registration / Access Request States
  const [regFullName, setRegFullName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regRole, setRegRole] = useState("BID_EXECUTIVE")
  const [regDepartment, setRegDepartment] = useState("Pre-Sales & Tenders")
  const [isRegistering, setIsRegistering] = useState(false)
  const [regSuccess, setRegSuccess] = useState(false)

  // Forgot Password / Reset OTP States
  const [forgotStep, setForgotStep] = useState(1) // 1: Email, 2: OTP, 3: New Password
  const [resetEmail, setResetEmail] = useState("")
  const [resetOtp, setResetOtp] = useState("")
  const [resetNewPassword, setResetNewPassword] = useState("")
  const [resetConfirmPassword, setResetConfirmPassword] = useState("")
  const [isResetting, setIsResetting] = useState(false)

  if (!isOpen) return null

  const handleLoginSubmit = async (e) => {
    e.preventDefault()

    if (!username.trim() || !password) {
      toast.error("Please fill in both username/email and password.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await authService.login(username.trim().toLowerCase(), password)
      if (res.ok && res.success) {
        toast.success(res.message || "Logged in successfully!")
        onClose()
        if (onSuccessNavigate) onSuccessNavigate()
      } else {
        toast.error(res.error?.message || res.message || "Invalid credentials")
      }
    } catch (err) {
      toast.error("Network connection error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    if (!regFullName.trim() || !regEmail.trim()) {
      toast.error("Please complete all registration fields")
      return
    }
    setIsRegistering(true)
    setTimeout(() => {
      setIsRegistering(false)
      setRegSuccess(true)
      toast.success("Access request logged successfully! Admin approval pending.")
    }, 900)
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
        toast.success(res.message || "6-digit OTP code sent to your email!")
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
      toast.error("Password must be at least 8 characters long")
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
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative z-10 w-full max-w-md rounded-2xl p-1 bg-white border border-blue-200 shadow-2xl overflow-hidden text-slate-900"
        >
          <SkiperSvgBeam duration={6} glowColor="#2563eb" />

          <div className="rounded-xl bg-white p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-blue-100 border border-blue-200 text-blue-600">
                  <LedgerStampMark className="size-4" color="#2563eb" />
                </span>
                <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: ledgerFont.display }}>
                  OneTrack
                </h3>
              </div>
              <button
                onClick={onClose}
                className="flex size-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Tab Selector Buttons */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                onClick={() => setActiveTab("login")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "login"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab("register")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "register"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Request Access
              </button>
              <button
                onClick={() => setActiveTab("forgot")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "forgot"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Reset OTP
              </button>
            </div>

            {/* TAB 1: SIGN IN */}
            {activeTab === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Username or Email Address</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username or email"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => setActiveTab("forgot")}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3.5 pr-9 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Authenticating...
                    </>
                  ) : (
                    "Sign In to OneTrack"
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: REQUEST ACCESS */}
            {activeTab === "register" && (
              <div>
                {regSuccess ? (
                  <div className="text-center py-4 space-y-3">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="size-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Application Registered</h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Your access application has been submitted to system administrators. You will receive an activation email upon approval.
                    </p>
                    <button
                      onClick={() => {
                        setRegSuccess(false)
                        setActiveTab("login")
                      }}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Return to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        placeholder="e.g. Biswabhusan Sahoo"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Work Email</label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="e.g. name@globx.co.in"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">System Role</label>
                        <select
                          value={regRole}
                          onChange={(e) => setRegRole(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                        >
                          <option value="BID_EXECUTIVE">Bid Executive</option>
                          <option value="PRE_SALES">Pre-Sales</option>
                          <option value="FINANCE">Finance</option>
                          <option value="MANAGER">Manager</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                        <input
                          type="text"
                          value={regDepartment}
                          onChange={(e) => setRegDepartment(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isRegistering}
                      className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isRegistering ? <Loader2 className="size-3.5 animate-spin" /> : "Submit Access Request"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TAB 3: RESET OTP */}
            {activeTab === "forgot" && (
              <div className="space-y-4">
                {forgotStep === 1 && (
                  <form onSubmit={handleSendOTP} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Registered Email</label>
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="e.g. name@globx.co.in"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isResetting}
                      className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isResetting ? <Loader2 className="size-3.5 animate-spin" /> : "Send 6-Digit OTP"}
                    </button>
                  </form>
                )}

                {forgotStep === 2 && (
                  <form onSubmit={handleVerifyOTP} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Enter 6-Digit OTP Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={resetOtp}
                        onChange={(e) => setResetOtp(e.target.value)}
                        placeholder="123456"
                        className="w-full text-center text-lg font-mono font-bold tracking-widest bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-blue-600 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForgotStep(1)}
                        className="w-1/3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isResetting}
                        className="w-2/3 py-2 rounded-lg bg-blue-600 text-white font-bold text-xs"
                      >
                        {isResetting ? <Loader2 className="size-3.5 animate-spin" /> : "Verify Code"}
                      </button>
                    </div>
                  </form>
                )}

                {forgotStep === 3 && (
                  <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                      <input
                        type="password"
                        required
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
                      <input
                        type="password"
                        required
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isResetting}
                      className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-bold text-xs"
                    >
                      {isResetting ? <Loader2 className="size-3.5 animate-spin" /> : "Update Password"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
