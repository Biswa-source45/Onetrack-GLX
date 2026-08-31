import { motion } from "framer-motion"
import { ledger, ledgerFont } from "./ledgerTheme"
import { LedgerStampMark } from "./ledgerMarks"

// The world's one repeating grammar unit: a ruled ledger line with a code,
// a title, a note, and a status mark. Used for the pipeline register, the
// capability list, and the role list — one signature interaction (the stamp
// strike) rather than a different card pattern per section.
//
// status: "pending" (open circle, dim) | "reached" (ink stamp, struck)
//       | "active" (pulsing ring, in progress now)
export function LedgerRow({ code, title, note, status = "pending", selected = false, onClick, dense = false, right = null }) {
  const interactive = typeof onClick === "function"
  const Tag = interactive ? motion.button : motion.div

  return (
    <Tag
      onClick={onClick}
      whileTap={interactive ? { scale: 0.99 } : undefined}
      className={`group flex w-full items-center gap-4 text-left ${dense ? "py-2.5" : "py-3.5"} px-1 ${interactive ? "cursor-pointer" : ""}`}
      style={{
        borderBottom: `1px solid ${selected ? ledger.ruleBright : ledger.rule}`,
        opacity: selected ? 1 : undefined,
        transition: "border-color 220ms ease",
      }}
    >
      <span
        className="shrink-0 tabular-nums text-[11px] tracking-wide"
        style={{ fontFamily: ledgerFont.mono, color: selected ? ledger.accentDeep : ledger.textFaint, minWidth: "1.6rem" }}
      >
        {code}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className="block truncate font-medium"
          style={{ fontFamily: ledgerFont.display, color: selected ? ledger.text : ledger.text, fontSize: dense ? "0.95rem" : "1.05rem" }}
        >
          {title}
        </span>
        {note && (
          <span className="mt-0.5 block truncate text-xs" style={{ fontFamily: ledgerFont.body, color: ledger.textMuted }}>
            {note}
          </span>
        )}
      </span>

      <span className="shrink-0" aria-hidden={right ? undefined : "true"}>
        {right ? right : status === "reached" ? (
          <motion.span
            key="reached"
            initial={{ scale: 0.4, rotate: -18, opacity: 0 }}
            animate={{ scale: 1, rotate: -8, opacity: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 14 }}
            className="block size-5"
          >
            <LedgerStampMark className="size-5" color={ledger.accent} />
          </motion.span>
        ) : status === "active" ? (
          <span className="relative flex size-5 items-center justify-center">
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${ledger.accent}` }}
              animate={{ scale: [1, 1.35], opacity: [0.55, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="size-2 rounded-full" style={{ background: ledger.accent }} />
          </span>
        ) : (
          <span className="block size-5 rounded-full" style={{ border: `1.5px solid ${ledger.textFaint}` }} />
        )}
      </span>
    </Tag>
  )
}
