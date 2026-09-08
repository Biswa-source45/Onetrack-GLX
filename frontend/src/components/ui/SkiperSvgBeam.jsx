import React from "react"
import { motion } from "framer-motion"

/**
 * SkiperSvgBeam - Inspired by skiper-ui skiper19 animated SVG beam effect.
 * Pure White + Royal Blue + 5% Red Accent (No Purple!).
 */
export function SkiperSvgBeam({ className = "", duration = 4, rx = 16, glowColor = "#2563eb" }) {
  return (
    <div className={`pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden ${className}`} aria-hidden="true">
      <svg className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="skiperBeamGradientPure" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="25%" stopColor={glowColor} stopOpacity="0.25" />
            <stop offset="55%" stopColor="#2563eb" stopOpacity="1" />
            <stop offset="75%" stopColor="#dc2626" stopOpacity="0.85" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="glowFilterPure" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Static subtle trace track */}
        <rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx={rx}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />

        {/* Animated glowing tracer beam */}
        <motion.rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx={rx}
          fill="none"
          stroke="url(#skiperBeamGradientPure)"
          strokeWidth="2.5"
          strokeDasharray="180 600"
          filter="url(#glowFilterPure)"
          animate={{
            strokeDashoffset: [0, -780],
          }}
          transition={{
            duration: duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </svg>
    </div>
  )
}

/**
 * SkiperScrollBeam - An SVG line beam tracer for section scroll indicators (Pure Blue & White + Red Accent)
 */
export function SkiperScrollBeam({ path, width = 100, height = 800, className = "" }) {
  return (
    <div className={`pointer-events-none absolute ${className}`} aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" fill="none">
        <path d={path} stroke="#cbd5e1" strokeWidth="2" />
        <motion.path
          d={path}
          stroke="url(#skiperLineGradientPure)"
          strokeWidth="3.5"
          strokeLinecap="round"
          animate={{
            strokeDashoffset: [0, -1200],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "linear",
          }}
          strokeDasharray="160 400"
        />
        <defs>
          <linearGradient id="skiperLineGradientPure" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
