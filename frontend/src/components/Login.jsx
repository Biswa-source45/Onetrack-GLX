import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { Eye, EyeOff, ArrowLeft, Loader2, Key } from "lucide-react"
import { toast } from "sonner"
import { authService } from "../services/auth"
import { ledger, ledgerFont } from "../lib/ledgerTheme"
import { LedgerStampMark } from "../lib/ledgerMarks"
import { LoginHeroPanel } from "../lib/LoginHeroPanel"

const inputStyle = {
  fontFamily: ledgerFont.body,
  background: "#FFFFFF",
  border: `1px solid ${ledger.border}`,
  color: ledger.text,
}

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Reset Password (OTP Flow) states
  const [showResetModal, setShowResetModal] = useState(false)
  const [forgotStep, setForgotStep] = useState(1) // 1: Email, 2: OTP, 3: New Password
  const [resetEmail, setResetEmail] = useState("")
  const [resetOtp, setResetOtp] = useState("")
  const [resetNewPassword, setResetNewPassword] = useState("")
  const [resetConfirmPassword, setResetConfirmPassword] = useState("")
  const [showResetNewPass, setShowResetNewPass] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!username.trim() || !password) {
      toast.error("Please enter both username/email and password")
      return
    }

    setIsLoading(true)

    try {
      const result = await authService.login(username.trim().toLowerCase(), password)

      if (result.ok && result.success) {
        toast.success(result.message || "Logged in successfully!")
        setSuccess(true)
        setTimeout(() => {
          setIsLoading(false)
          navigate("/dashboard")
        }, 800)
      } else {
        setIsLoading(false)
        const errorMsg = result.error?.message || "Invalid credentials"
        toast.error(`${errorMsg} (Status: ${result.status})`)
      }
    } catch (err) {
      setIsLoading(false)
      toast.error("Network connection error. Is the backend running?")
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
        toast.success(res.message || "OTP code sent to email!")
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
      toast.error("New passwords do not match")
      return
    }

    setIsResetting(true)
    try {
      const res = await authService.resetPasswordOTP(resetEmail.trim(), resetOtp.trim(), resetNewPassword)
      if (res.ok && res.success) {
        toast.success("Password reset successfully! You can now sign in.")
        setShowResetModal(false)
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
    <div
      className="h-screen w-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: ledger.ground, fontFamily: ledgerFont.body }}
    >
      {/* MAIN CONTAINER CARD */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-4xl h-[90vh] max-h-[560px] rounded-[8px] p-2 flex flex-col md:flex-row gap-2 overflow-hidden"
        style={{ background: ledger.surface, border: `1px solid ${ledger.borderBright}`, boxShadow: "0 32px 80px -24px rgba(16,24,40,0.28)" }}
      >
        {/* LEFT COLUMN: abstract brand panel */}
        <div className="hidden md:block md:w-[46%] lg:w-[48%] rounded-[6px] overflow-hidden shrink-0">
          <LoginHeroPanel />
        </div>

        {/* RIGHT COLUMN: the blank entry page — a ruled paper form panel */}
        <div
          className="w-full md:w-[54%] lg:w-[52%] flex flex-col justify-between p-5 sm:p-6 lg:p-8 h-full overflow-y-auto rounded-[6px]"
          style={{ background: ledger.ground }}
        >
          {/* Top Row: Back Navigation & Logo */}
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => navigate("/")}
              className="group inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              style={{ color: ledger.textMuted }}
            >
              <ArrowLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[4px]" style={{ background: ledger.surfaceRaised, border: `1px solid ${ledger.borderBright}` }}>
                <LedgerStampMark className="size-4" color={ledger.accent} />
              </span>
              <span className="text-sm font-semibold tracking-tight" style={{ fontFamily: ledgerFont.display, color: ledger.text }}>OneTrack</span>
            </div>

            <div className="w-10 opacity-0 pointer-events-none" />
          </div>

          {/* Middle Row: Content & Form */}
          <div className="my-auto max-w-sm w-full mx-auto space-y-6 py-4">
            {/* Headings */}
            <div className="text-center space-y-1">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-none" style={{ fontFamily: ledgerFont.display, color: ledger.text }}>
                Welcome Back
              </h2>
              <p className="text-[11px] font-normal leading-relaxed" style={{ color: ledger.textMuted }}>
                Enter your system credentials to access your account
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Username Input */}
              <div className="space-y-1">
                <label htmlFor="username" className="block text-xs font-semibold" style={{ color: ledger.textMuted }}>
                  Username or Email Address
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username or email address"
                  className="w-full focus:outline-none focus:ring-2 rounded-[4px] px-3.5 py-2.5 text-xs font-medium transition-all"
                  style={{ ...inputStyle, "--tw-ring-color": ledger.accent }}
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-semibold" style={{ color: ledger.textMuted }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="text-[11px] font-bold hover:underline cursor-pointer"
                    style={{ color: ledger.accentDeep }}
                  >
                    Reset Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full focus:outline-none focus:ring-2 rounded-[4px] pl-3.5 pr-9 py-2.5 text-xs font-medium transition-all"
                    style={{ ...inputStyle, "--tw-ring-color": ledger.accent }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                    style={{ color: ledger.textMuted }}
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || success}
                  className="w-full py-3 rounded-[4px] font-semibold text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                  style={{ background: ledger.accent, color: "#FFFFFF", boxShadow: `0 1px 0 ${ledger.accentDeep}` }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Signing In...
                    </>
                  ) : success ? (
                    "Welcome Back!"
                  ) : (
                    "Sign In"
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Bottom Row: Sign Up Prompt */}
          <div className="text-center text-xs" style={{ color: ledger.textMuted }}>
            <span>Accessing public workspace? </span>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="font-bold hover:underline cursor-pointer"
              style={{ color: ledger.accentDeep }}
            >
              Go to Landing Page
            </button>
          </div>
        </div>
      </motion.div>

      {/* RESET PASSWORD MODAL (From Login Form) */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowResetModal(false)
                setForgotStep(1)
              }}
              className="absolute inset-0 backdrop-blur-xs"
              style={{ background: "rgba(15,23,42,0.55)" }}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative z-10 w-full max-w-md rounded-[8px] p-6 space-y-5"
              style={{ background: ledger.ground, border: `1px solid ${ledger.border}`, boxShadow: "0 32px 80px -24px rgba(16,24,40,0.28)" }}
            >
              <div className="space-y-1">
                <h3 className="text-xl font-semibold flex items-center gap-2" style={{ fontFamily: ledgerFont.display, color: ledger.text }}>
                  <Key className="size-5" style={{ color: ledger.accentDeep }} />
                  Forgot Password OTP Reset
                </h3>
                <p className="text-xs leading-normal" style={{ color: ledger.textMuted }}>
                  {forgotStep === 1 && "Step 1/3: Enter your registered email address to receive a 6-digit OTP code."}
                  {forgotStep === 2 && `Step 2/3: Enter the 6-digit OTP code sent to ${resetEmail}.`}
                  {forgotStep === 3 && "Step 3/3: Set a new secure password for your OneTrack account."}
                </p>
              </div>

              {/* Step 1: Send OTP */}
              {forgotStep === 1 && (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: ledger.textMuted }}>Registered Email</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="e.g. biswabhusans@globx.co.in"
                      className="w-full focus:outline-none focus:ring-2 rounded-[4px] px-3.5 py-2.5 text-xs font-medium transition-all"
                      style={{ ...inputStyle, "--tw-ring-color": ledger.accent }}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetModal(false)}
                      className="flex-1 py-2.5 rounded-[4px] font-semibold text-xs transition-colors cursor-pointer"
                      style={{ background: "#FFFFFF", border: `1px solid ${ledger.border}`, color: ledger.text }}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isResetting}
                      className="flex-1 py-2.5 rounded-[4px] font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      style={{ background: ledger.accent, color: "#FFFFFF" }}
                    >
                      {isResetting ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Sending OTP...
                        </>
                      ) : (
                        "Send OTP Code"
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Verify OTP */}
              {forgotStep === 2 && (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: ledger.textMuted }}>6-Digit Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP code"
                      className="w-full text-center tracking-widest text-lg font-bold focus:outline-none focus:ring-2 rounded-[4px] px-3.5 py-2"
                      style={{ ...inputStyle, fontFamily: ledgerFont.mono, "--tw-ring-color": ledger.accent }}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="flex-1 py-2.5 rounded-[4px] font-semibold text-xs transition-colors cursor-pointer"
                      style={{ background: "#FFFFFF", border: `1px solid ${ledger.border}`, color: ledger.text }}
                    >
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={isResetting}
                      className="flex-1 py-2.5 rounded-[4px] font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      style={{ background: ledger.accent, color: "#FFFFFF" }}
                    >
                      {isResetting ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify OTP"
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: New Password */}
              {forgotStep === 3 && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: ledger.textMuted }}>New Password</label>
                    <div className="relative">
                      <input
                        type={showResetNewPass ? "text" : "password"}
                        required
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full focus:outline-none focus:ring-2 rounded-[4px] pl-3.5 pr-9 py-2.5 text-xs font-medium transition-all"
                        style={{ ...inputStyle, "--tw-ring-color": ledger.accent }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetNewPass(!showResetNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                        style={{ color: ledger.textMuted }}
                      >
                        {showResetNewPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: ledger.textMuted }}>Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full focus:outline-none focus:ring-2 rounded-[4px] px-3.5 py-2.5 text-xs font-medium transition-all"
                      style={{ ...inputStyle, "--tw-ring-color": ledger.accent }}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(2)}
                      className="flex-1 py-2.5 rounded-[4px] font-semibold text-xs transition-colors cursor-pointer"
                      style={{ background: "#FFFFFF", border: `1px solid ${ledger.border}`, color: ledger.text }}
                    >
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={isResetting}
                      className="flex-1 py-2.5 rounded-[4px] font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      style={{ background: ledger.accent, color: "#FFFFFF" }}
                    >
                      {isResetting ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  )
}
