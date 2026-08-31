# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal bid-operations staff at GlobX Technologies who run government tender bids end to
end: Super Admins/Admins (full system control), Managers (create tenders, assign owners,
review pipeline analytics), Bid Executives (run discovery through GeM submission — documents,
checklists, compliance), Pre-Sales (technical eligibility and OEM authorization tracking), and
Finance (EMD deposits, Bank Guarantees, commercial pricing). This is an internal operations
tool, not a self-serve product — there is no public sign-up; access is provisioned by an admin.

## Product Purpose

OneTrack tracks a government tender (GeM / CPPP) from the moment it's discovered through
final award and handover, via a ten-stage gated pipeline that mirrors how the team actually
works a bid: Discovered → OEM Authorization → Pricing Request → Document Checklist → EMD
Processing → Internal Approval → GeM Submission → Technical Evaluation → Financial Evaluation
→ Award & Handover. A tender cannot skip a stage it hasn't actually completed. Success means
nothing about a live bid's status, documents, or money lives in someone's inbox or a personal
spreadsheet.

## Positioning

A generic CRM or project tool has no concept of a GeM/CPPP tender's actual shape — EMD
(earnest money deposit) processing, Bank Guarantee tracking through discharge, OEM
authorization certificates (MAF/MII/No-Malicious-Code), and a stage sequence a bid cannot
skip. OneTrack's pipeline is not a generic kanban relabeled with tender terms — the gates,
the EMD/BG financial tracking, and the role permissions are built around the actual
GeM/CPPP procurement workflow.

## Operating Context

Government e-Marketplace (GeM) and CPPP public-sector procurement in India. Bids move
through OEM certificate collection, distributor pricing collection, EMD payment (online
transfer, DD, or a documented MSME/Startup/Other exemption), internal management sign-off,
portal submission before a hard deadline, technical and financial evaluation by the buyer,
and — on a win — PO receipt, Bank Guarantee issuance/discharge, and delivery. Every stage
transition and material field edit is written to an audit trail.

## Capabilities and Constraints

- Ten sequential, gated pipeline stages (see Product Purpose); a later stage is locked until
  the ones before it are actually complete.
- EMD and Bank Guarantee tracking from processing through return/discharge.
- Six roles with granular, server-enforced permissions (not just hidden UI).
- Pipeline analytics: stage funnel, win/loss, and per-owner performance.
- Bulk import from two legacy tracker spreadsheet formats, in addition to manual entry.
- No public self-serve signup; accounts are created by an admin. Login is by username/email
  and password, with an OTP-based password-reset flow.

## Brand Commitments

- Product name: **OneTrack** (one word, capital O and T). Company: **GlobX Technologies**
  (short form **GlobX**).
- Existing tagline in use: "Track Every Tender. Win With Confidence."
- Primary brand color: blue (existing Tailwind `primary` token, ~`blue-600`).

## Evidence on Hand

No client names, customer logos, usage statistics, or testimonials are approved for public
display. The landing page must sell on what the product verifiably does, not on unverifiable
numbers or claims — this was confirmed explicitly, not assumed.

## Product Principles

1. The pipeline is the product's actual mechanism — every marketing surface should make the
   ten real gates legible, not abstract them into generic "workflow" language.
2. Never assert a number, client, or outcome that isn't true today — this is an internal
   ops tool for a real bid team, not a scored SaaS landing page.
3. This is an internal tool wearing a front door, not a consumer product — the landing and
   login pages exist to look credible to the team (and anyone they show it to), not to
   convert cold traffic.
4. Domain-relevant visual language over generic SaaS abstraction — motifs should read as
   "procurement pipeline," not stock gradient-mesh-and-blob.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established; follow standard web
accessibility practice (contrast, keyboard operability, motion-reduction respect) as a floor.
