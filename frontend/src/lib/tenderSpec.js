// Shared tender Section 1 data: preset options, EMD validation. Used by Add
// Tender and Add Lead (a Published lead captures the same tender spec).

export const STANDARD_PORTAL_SOURCES = ["GeM", "Private", "RTC", "CPPP", "eProcure"];
export const BID_TYPES = ["BID", "BID_TO_RA"];
export const SCOPE_TYPES = ["Supply", "Implementation", "Supply + Implementation", "Support", "N/A"];

// Tender Link must be an absolute http(s) URL — it is rendered as a clickable
// href, so anything else (javascript:, bare text) is rejected here and in the API.
export function isHttpUrl(s) {
  try {
    return /^https?:$/.test(new URL(s).protocol);
  } catch {
    return false;
  }
}
export const TENDER_LINK_ERROR = "Enter a valid link starting with http:// or https://";
export const STANDARD_CATEGORY_OPTIONS = [
  "End computing",
  "IT infra",
  "Non-IT infra",
  "Security",
  "Cloud",
  "Surveillance",
  "Software",
  "Manpower-augmentation",
];

// Every EMD field the No-EMD toggle clears.
export const EMD_DETAIL_FIELDS = {
  emd_amount: "",
  emd_exemption_types: [],
  emd_exemption_reason: "",
  emd_bank_name: "",
  emd_account_number: "",
  emd_ifsc_code: "",
  emd_branch: "",
  emd_beneficiary: "",
  emd_payable_at: "",
};

export function inputCls(err) {
  return `h-9 text-sm w-full bg-background ${err ? "border-destructive focus-visible:ring-destructive/30" : ""}`;
}

// EMD is raw data off the tender document: Online, DD, and exemption
// criteria are independent — tick whichever the document actually offers.
// Returns an errors object ({} when valid).
export function validateEmd(form, emdOnlineOn, emdDdOn) {
  const e = {};
  if (form.emd_not_applicable) return e;
  if (emdOnlineOn) {
    if (!form.emd_bank_name.trim()) e.emd_bank_name = "Bank name is required";
    if (!form.emd_account_number.trim())
      e.emd_account_number = "Account number is required";
    if (!form.emd_ifsc_code.trim()) e.emd_ifsc_code = "IFSC code is required";
  }
  if (emdDdOn) {
    if (!form.emd_beneficiary.trim())
      e.emd_beneficiary = "Beneficiary is required";
    if (!form.emd_payable_at.trim())
      e.emd_payable_at = "Payable at location is required";
  }
  if (!emdOnlineOn && !emdDdOn && form.emd_exemption_types.length === 0) {
    e.emd_mode =
      "Tick at least one: Online, DD, or an exemption criterion the tender document allows";
  }
  if (
    form.emd_exemption_types.includes("OTHER") &&
    !form.emd_exemption_reason.trim()
  ) {
    e.emd_exemption_reason = "Please specify the Other exemption criterion";
  }
  return e;
}
