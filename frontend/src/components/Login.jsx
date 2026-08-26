import React, { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Layers, Eye, EyeOff, ArrowLeft, Loader2, Key, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { authService, tokenStorage } from "../services/auth"
import LoginArt from "./LoginArt"


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

  // WebGL water-ripple art (Three.js) driving the left illustration panel —
  // scoped ONLY to that panel. Pointer moves feed ripple origins straight
  // into the shader via an imperative ref; nothing is tracked in React state.
  const artRef = useRef(null)
  const lastRippleAt = useRef(0)

  function handlePanelMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height

    artRef.current?.updatePointer(nx, ny)

    const now = performance.now()
    if (now - lastRippleAt.current > 220) {
      lastRippleAt.current = now
      artRef.current?.addRipple(nx, ny)
    }
  }

  function handlePanelMouseLeave() {
    artRef.current?.clearPointer()
  }

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
    <div className="h-screen w-screen bg-neutral-50 flex items-center justify-center p-4 font-sans selection:bg-blue-100 selection:text-blue-900 relative overflow-hidden">

      {/* MAIN CONTAINER CARD */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-4xl h-[90vh] max-h-[550px] bg-white rounded-[2rem] p-2 flex flex-col md:flex-row gap-2 border border-neutral-200/80 overflow-hidden shadow-xl"
      >
        
        {/* LEFT COLUMN: WEBGL WATER PANEL (brand blue) — ripple/glow driven by Three.js, scoped to this panel only */}
        <div
          onMouseMove={handlePanelMouseMove}
          onMouseLeave={handlePanelMouseLeave}
          className="hidden md:flex md:w-[46%] lg:w-[48%] rounded-[1.5rem] overflow-hidden relative h-full flex-col justify-between p-8 lg:p-10 shrink-0 bg-neutral-950 text-white"
        >
          <LoginArt ref={artRef} />

          {/* Legibility wash so text stays crisp over the flowing shader */}
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-neutral-950/70 via-neutral-950/10 to-neutral-950/40 pointer-events-none" />

          {/* Top Row: Hero Brand Lockup */}
          <div className="relative z-20 flex items-center gap-2.5">
            <motion.div
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/30"
              animate={{ boxShadow: ["0 0 0 rgba(37,99,235,0.35)", "0 0 22px rgba(37,99,235,0.55)", "0 0 0 rgba(37,99,235,0.35)"] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Layers className="size-4.5 text-white" />
            </motion.div>
            <span className="font-display text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-white">OneTrack</span>
          </div>

          {/* Middle: high-impact headline + short supporting line */}
          <div className="relative z-20 my-auto py-8">
            <div className="h-1.5 w-12 bg-blue-500 rounded-full mb-6" />
            <h1 className="font-display text-4xl lg:text-[2.75rem] font-normal text-white leading-[1.1] tracking-tight">
              Track Every <br />Tender. <br />Win With Confidence.
            </h1>
            <p className="mt-4 text-[13px] lg:text-sm text-neutral-300 leading-relaxed max-w-[300px]">
              From GeM submission to contract closure — one workspace for your entire bid lifecycle.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: LOGIN FORM PANEL */}
        <div className="w-full md:w-[54%] lg:w-[52%] flex flex-col justify-between p-5 sm:p-6 lg:p-8 h-full overflow-y-auto bg-white">
          
          {/* Top Row: Back Navigation & Logo */}
          <div className="flex items-center justify-between w-full">
            <button 
              onClick={() => navigate("/")}
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-450 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>
            
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <Layers className="size-3.5" />
              </div>
              <span className="font-heading text-sm font-bold tracking-tight text-neutral-900">OneTrack</span>
            </div>
            
            <div className="w-10 opacity-0 pointer-events-none" />
          </div>

          {/* Middle Row: Content & Form */}
          <div className="my-auto max-w-sm w-full mx-auto space-y-6 py-4">
            
            {/* Headings */}
            <div className="text-center space-y-1">
              <h2 className="font-display text-2xl sm:text-3xl font-normal text-neutral-900 tracking-tight leading-none">
                Welcome Back
              </h2>
              <p className="text-[11px] text-neutral-400 font-normal leading-relaxed">
                Enter your system credentials to access your account
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {/* Username Input */}
              <div className="space-y-1">
                <label htmlFor="username" className="block text-xs font-semibold text-neutral-500">
                  Username or Email Address
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username or email address"
                  className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs placeholder:text-neutral-400 font-medium transition-all text-neutral-900"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-semibold text-neutral-505">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
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
                    className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none rounded-xl pl-3.5 pr-9 py-2.5 text-xs placeholder:text-neutral-400 font-medium transition-all text-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
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
                  className="bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white w-full py-3 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/10"
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
          <div className="text-center text-xs text-neutral-455">
            <span>Accessing public workspace? </span>
            <button 
              type="button" 
              onClick={() => navigate("/")}
              className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
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
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative z-10 w-full max-w-md bg-white border border-neutral-200 rounded-2xl p-6 shadow-xl space-y-5 text-neutral-900"
            >
              <div className="space-y-1">
                <h3 className="font-display text-xl font-normal text-neutral-900 flex items-center gap-2">
                  <Key className="size-5 text-blue-600" />
                  Forgot Password OTP Reset
                </h3>
                <p className="text-xs text-neutral-500 leading-normal">
                  {forgotStep === 1 && "Step 1/3: Enter your registered email address to receive a 6-digit OTP code."}
                  {forgotStep === 2 && `Step 2/3: Enter the 6-digit OTP code sent to ${resetEmail}.`}
                  {forgotStep === 3 && "Step 3/3: Set a new secure password for your OneTrack account."}
                </p>
              </div>

              {/* Step 1: Send OTP */}
              {forgotStep === 1 && (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Registered Email</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="e.g. biswabhusans@globx.co.in"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs placeholder:text-neutral-400 font-medium transition-all text-neutral-900"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetModal(false)}
                      className="flex-1 bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 text-neutral-700 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    
                    <button
                      type="submit"
                      disabled={isResetting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
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
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">6-Digit Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP code"
                      className="w-full bg-neutral-50 text-center tracking-widest text-lg font-mono hover:bg-neutral-100/60 focus:bg-white border border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none rounded-xl px-3.5 py-2 text-neutral-900 font-bold"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="flex-1 bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 text-neutral-700 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    
                    <button
                      type="submit"
                      disabled={isResetting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
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
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">New Password</label>
                    <div className="relative">
                      <input
                        type={showResetNewPass ? "text" : "password"}
                        required
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none rounded-xl pl-3.5 pr-9 py-2.5 text-xs placeholder:text-neutral-400 font-medium transition-all text-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetNewPass(!showResetNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                      >
                        {showResetNewPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white border border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs placeholder:text-neutral-400 font-medium transition-all text-neutral-900"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(2)}
                      className="flex-1 bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 text-neutral-700 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    
                    <button
                      type="submit"
                      disabled={isResetting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
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
  )
}
