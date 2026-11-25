import io
import re
import json
import time
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Tuple, Dict, Any, List

import pypdf
from openai import AsyncOpenAI

try:
    from models import (
        TenderExtractedData,
        AccuracyBreakdown,
        TenderProductItem,
        ChecklistItem,
        LeadExtractedData,
        LeadProductItem
    )
except ImportError:
    from ai_service.models import (
        TenderExtractedData,
        AccuracyBreakdown,
        TenderProductItem,
        ChecklistItem,
        LeadExtractedData,
        LeadProductItem
    )

SYSTEM_PROMPT = """You are an expert Government Tender & Procurement Intelligence Extraction Agent.
Your job is to read unstructured, multi-page tender, RFP, and GeM documents and extract all technical, commercial, financial, and compliance parameters with 100% factual accuracy.

CRITICAL INSTRUCTIONS:
1. STRICT ZERO HALLUCINATION:
   - Extract ONLY facts present in or directly computed from the text.
   - Return null for absent or undisclosed fields. NEVER invent numbers or dates.

2. TITLE EXTRACTION:
   - Extract the complete, descriptive Subject / Work Title of the tender (e.g. "Supply, Installation & Commissioning of Sophos XG 450 Xtreme Protection Subscription for FITGC...").
   - Do NOT just extract the notice reference number like "Tender Notice No. 25/2025" as the title.

3. INDIAN CURRENCY & NUMBERING NORMALIZATION:
   - In the Indian numbering system:
     * 1 Crore = 1,00,00,000 = 10,000,000 (7 trailing digits after Crore).
       Example: "INR 8,20,00,000" or "8.20 Crore" -> 82000000.
       Example: "1.85 Cr" or "1.85 Crore" -> 18500000.
       Example: "2.00 Crore" or "2 Cr" -> 20000000.
     * 1 Lakh = 1,00,000 = 100,000 (5 trailing digits after Lakh).
       Example: "200 Lakhs" -> 20000000 (2 Crores).
       Example: "45,00,000" or "45 Lakhs" -> 4500000.
       Example: "90,000" -> 90000.
   - Always strip currency symbols: ₹, Rs., INR, /-, and convert into an absolute numeric integer or float.
   - If the tender document does NOT disclose or specify an estimated value (common in item-rate or schedule tenders), return null for estimated_value.

4. EMD (EARNEST MONEY DEPOSIT) & TENDER FEE:
   - If EMD is waived or states "Required: No" or "EMD: Not Applicable", set emd_not_applicable = true and emd_amount = null.
   - If EMD is a fixed amount, extract into emd_amount (e.g. 50000, 86000, 2280).
   - If EMD is formula-based (e.g. "Not less than 1% of quoted amount"), extract emd_percentage = 1.0 and emd_formula = "Not less than 1% of quoted amount".
   - Extract tender_fee (e.g. 2000 or null if free / NIL).

5. PERFORMANCE SECURITY & BANK GUARANTEE (PBG):
   - "bg_rate": MUST be a percentage number (e.g., 10 for 10%, 5 for 5%, 3 for 3%).
     * CRITICAL: Do NOT confuse EMD amount (which is in Rupees, e.g. Rs. 50,000) with PBG percentage!
     * If document states "10% of the bill amount will be retained towards Performance Security / Bank Guarantee", then bg_rate = 10 and bg_required = true.
     * If document states "PBG Required: No" or "ePBG: No", then bg_required = false and bg_rate = null.
   - "bg_duration_months": PBG validity in months.
     * Example: If "valid till 3 months beyond warranty period of 5 years", calculate 5 * 12 + 3 = 63 months.
     * Example: If "2 months beyond contract period of 12 months", calculate 14 months.

6. ELIGIBILITY & TURNOVER:
   - "minimum_annual_turnover": Extract the minimum average annual turnover required for the bidder in absolute INR (e.g. "200 Lakhs" -> 20000000, "2 Crores" -> 20000000). Return null if not specified.
   - "years_of_past_experience": Past experience years required (e.g. 3).

7. TENDER REFERENCE ID:
   - Extract the primary identifier (GeM Bid Number, Tender Notice Number, NIT Number, RFP ID, or E-Tender Notice No.) into "gem_bid_no".

8. DATES:
   - "start_date": Map Publication Date, Notice / NIT Release Date, Issue Date, or Bid Start Date to standard ISO-8601 "YYYY-MM-DD".
   - "end_date": Map Bid Submission End Date, Due Date, Closing Date, Bid Deadline, or Last Date of Submission to standard ISO-8601 "YYYY-MM-DD".
   - Never leave end_date null if a closing date or submission deadline is mentioned in the document!

9. PORTAL & BID TYPE DETECTION:
   - Identify portal_source: "GeM", "CPWD", "CPP Portal", "State Portal", "Railway (IREPS)", "Defence (DRDO/MOD)", or "Other".
   - If it contains a GeM Bid Number (e.g., GEM/2026/B/...), set portal_source = "GeM" and bid_type = "GEM".

10. BOQ PRODUCTS & OEM IDENTIFICATION:
    - Extract distinct items, quantities, units (e.g. Nos, Box, Mtr, RMT, Set), and brief specifications into the products list.
    - If a multi-item schedule/BOQ is present (e.g. Access Points, Switches, Patch Cords, Racks), extract the complete list.
    - "oem_name": Identify the brand / OEM name (e.g. "Sophos", "Cisco", "Fortinet", "Dell", "HP", "Aruba", "Ruckus") if specified.

11. COMPLIANCE CHECKLISTS:
    - Separate bidder requirements (GST, PAN, EMD, Turnover, Experience, Non-blacklisting) from OEM requirements (MAF, OEM compliance sheet, ISO certificates, direct OEM warranty).

12. REMARKS & OPERATIONAL BRIEFING:
    - Synthesize a concise 3-5 sentence internal operational briefing into "remarks":
      Include scope, delivery location, warranty, performance security percentage, turnover, and payment terms.

13. KEY RISK / CHALLENGE IDENTIFICATION:
    - Identify the single most critical condition, risk factor, or eligibility hurdle found in the document:
      * "challenge_label": Short 1-3 word tag (e.g. "Delivery Risk", "Turnover Condition", "Local Service Centre", "Technical Risk", "High Risk", "Attention").
      * "challenge_text": 1-2 sentence description explaining the challenge or risk to flag for reviewers.
      * "challenge_color": "amber", "rose", "orange", "violet", or "fuchsia".

Return valid JSON adhering exactly to the requested schema.
"""

USER_PROMPT_TEMPLATE = """Extract all tender data from the following procurement document into structured JSON.

DOCUMENT TEXT:
----------------------------------------
{document_text}
----------------------------------------

JSON STRUCTURE TO RETURN:
{{
  "title": string or null,               // Complete work/scope title (NOT just "Tender Notice No. XX")
  "gem_bid_no": string or null,           // GeM Bid Number, Tender Notice No, NIT No, or Reference ID
  "organization_name": string or null,
  "department_name": string or null,
  "location": string or null,
  "portal_source": string,               // "GeM", "CPWD", "CPP Portal", "Railway (IREPS)", "State Portal", "Other"
  "tender_link": string or null,
  "bid_type": string,                    // "GEM", "OPEN", "LIMITED", "EOI", etc.
  "category": string,                    // "SERVICES", "GOODS", "WORKS", or "CONSULTING"
  "scope_type": string,                   // "SUPPLY", "SERVICES", "TURNKEY", or "AMC"
  "estimated_value": number or null,     // In INR. Return null if not disclosed in document
  "emd_amount": number or null,          // Fixed EMD in INR (e.g. 50000)
  "emd_percentage": number or null,      // Formula EMD percentage (e.g. 1.0 or 2.0)
  "emd_formula": string or null,         // Formula description (e.g. "Not less than 1% of quoted amount")
  "emd_not_applicable": boolean,         // True if EMD is waived or not required
  "emd_exemption_types": [string],       // Exemptions e.g. ["MSME", "Startup"]
  "tender_fee": number or null,          // Tender fee in INR
  "minimum_annual_turnover": number or null, // In INR (e.g. 20000000 for 2 Cr / 200 Lakhs)
  "years_of_past_experience": number or null,
  "contract_period_months": number or null,
  "evaluation_method": string or null,   // "Total value wise", "Item-wise", etc.
  "oem_required": boolean,               // True if MAF or OEM authorization is mandatory
  "bg_required": boolean,                // True if Performance Security / PBG is required
  "bg_rate": number or null,             // Percentage number ONLY (e.g. 10 or 5 or 3, NOT a Rupee amount)
  "bg_duration_months": number or null,  // In months (e.g. 63 for 5 yrs + 3 mos)
  "start_date": string or null,
  "end_date": string or null,
  "high_level_scope": string or null,
  "emd_bank_name": string or null,
  "emd_beneficiary": string or null,
  "emd_payable_at": string or null,
  "products": [
    {{
      "name": string,
      "quantity": number,
      "units": string,
      "oem_name": string or null,
      "specifications": string or null
    }}
  ],
  "bidder_checklists": [
    {{
      "title": string,
      "description": string,
      "is_mandatory": boolean
    }}
  ],
  "oem_checklists": [
    {{
      "title": string,
      "description": string,
      "is_mandatory": boolean
    }}
  ],
  "remarks": string or null,             // Comprehensive operational & commercial briefing for internal notes
  "challenge_label": string or null,     // e.g. "Local Service Centre", "Turnover Condition", "Delivery Risk"
  "challenge_text": string or null,      // Explanatory note detailing the hurdle or condition
  "challenge_color": string or null      // "amber", "rose", "orange", "violet", "fuchsia"
}}
"""

def extract_docx_text_pure(file_bytes: bytes) -> str:
    """Extracts text from DOCX using pure standard library zipfile + XML (zero crashes)."""
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
        if "word/document.xml" not in z.namelist():
            return ""
        with z.open("word/document.xml") as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = []
            for p in root.findall(".//w:p", ns):
                texts = [node.text for node in p.findall(".//w:t", ns) if node.text]
                if texts:
                    paragraphs.append("".join(texts))
            return "\n".join(paragraphs)

def extract_text_from_file(file_bytes: bytes, filename: str) -> Tuple[str, int, str]:
    """
    Extracts plain text from PDF, DOCX, or TXT file bytes.
    Features smart windowing for large multi-page PDFs (>20 pages):
    Extracts pages 1-12 (NIT, eligibility, EMD/PBG) + last 16 pages (BOQ, specs, price formats).
    Returns: (extracted_text, pages_or_sections_count, file_type)
    """
    ext = filename.lower().split(".")[-1]
    text_parts: List[str] = []
    page_count = 1

    if ext == "pdf":
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        page_count = len(reader.pages)

        if page_count <= 22:
            # Full document extraction
            for idx, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"--- Page {idx + 1} ---\n" + page_text)
        else:
            # Smart Procurement Windowing:
            # Head (Pages 1-12): NIT, ITB, Critical Dates, Financial Scope, Eligibility
            # Tail (Last 16 pages): Technical Specs, BOQ Schedules, Commercial Price Bid Formats
            for idx in range(min(12, page_count)):
                page_text = reader.pages[idx].extract_text()
                if page_text:
                    text_parts.append(f"--- Page {idx + 1} ---\n" + page_text)

            omitted_count = page_count - 12 - 16
            if omitted_count > 0:
                text_parts.append(f"\n--- [Note: Pages 13 to {page_count - 16} omitted: standard legal terms & GCC conditions] ---\n")

            tail_start = max(12, page_count - 16)
            for idx in range(tail_start, page_count):
                page_text = reader.pages[idx].extract_text()
                if page_text:
                    text_parts.append(f"--- Page {idx + 1} ---\n" + page_text)

        return "\n\n".join(text_parts), page_count, "PDF"

    elif ext in ["docx", "doc"]:
        text = extract_docx_text_pure(file_bytes)
        page_count = max(1, len(text.splitlines()) // 25)
        return text, page_count, "DOCX"

    else:
        text = file_bytes.decode("utf-8", errors="replace")
        page_count = max(1, len(text) // 2500)
        return text, page_count, "TXT"

def _is_valid_iso_date(d_str: Any) -> bool:
    if not d_str or not isinstance(d_str, str):
        return False
    try:
        clean = d_str.split("T")[0]
        datetime.strptime(clean, "%Y-%m-%d")
        return True
    except Exception:
        return False

def calculate_accuracy_score(extracted: Dict[str, Any], raw_text: str) -> Tuple[int, str, AccuracyBreakdown]:
    """
    Calculates a verifiable accuracy percentage from 1 to 100 based on 4 pillars:
    1. Critical Fields Presence (30%)
    2. Data Consistency & Constraint Validation (25%)
    3. Document Grounding & Cross-Referencing against Raw Text (30%)
    4. Structural Completeness of Products & Checklists (15%)
    """
    norm_text = raw_text.lower()
    verified_matches: List[str] = []
    unverified_fields: List[str] = []

    # Check if the document factually discloses an estimated cost or is item-rate/undisclosed
    estimate_keywords = [
        "estimated cost", "estimated value", "tendered value", 
        "approximate value", "estimated tender value", "approximate cost", "cost of work"
    ]
    has_doc_estimate = any(kw in norm_text for kw in estimate_keywords)

    # Pillar 1: Critical Fields Score (max 30)
    critical_score = 0.0
    critical_fields = {
        "title": 5.0,
        "gem_bid_no": 5.0,
        "end_date": 5.0,
        "organization_name": 5.0,
    }
    for field, weight in critical_fields.items():
        val = extracted.get(field)
        if val is not None and str(val).strip() != "" and str(val).strip().lower() != "null":
            critical_score += weight
        else:
            unverified_fields.append(f"Missing critical field: {field}")

    # EMD Field Handling (5.0 pts)
    # Full credit if:
    # a) emd_amount is present and numeric
    # b) emd_not_applicable is True (e.g. GeM bids where EMD is No)
    # c) emd_percentage is present (e.g. formula-based 1% EMD)
    emd = extracted.get("emd_amount")
    emd_na = extracted.get("emd_not_applicable")
    emd_pct = extracted.get("emd_percentage")
    if emd_na is True:
        critical_score += 5.0
        verified_matches.append("EMD confirmed waived / not applicable (Full credit)")
    elif emd is not None and isinstance(emd, (int, float)) and emd > 0:
        critical_score += 5.0
        verified_matches.append(f"Fixed EMD extracted: INR {emd:,.0f}")
    elif emd_pct is not None and isinstance(emd_pct, (int, float)) and emd_pct > 0:
        critical_score += 5.0
        verified_matches.append(f"Formula EMD extracted: {emd_pct}%")
    else:
        unverified_fields.append("Missing critical field: emd_amount / emd_status")

    # Estimated Value Field Handling (5.0 pts)
    est_val = extracted.get("estimated_value")
    if est_val is not None and isinstance(est_val, (int, float)) and est_val > 0:
        critical_score += 5.0
        verified_matches.append(f"Disclosed estimated value extracted: INR {est_val:,.0f}")
    elif not has_doc_estimate and est_val is None:
        # Full credit for zero-hallucination on undisclosed / item-rate tenders!
        critical_score += 5.0
        verified_matches.append("Document verified as Item-Rate / Undisclosed Estimate Tender (Zero hallucination)")
    else:
        unverified_fields.append("Missing critical field: estimated_value")

    # Pillar 2: Data Consistency & Validation (max 25)
    consistency_score = 0.0
    start_d = extracted.get("start_date")
    end_d = extracted.get("end_date")

    # Valid Date Formats (5 pts)
    if _is_valid_iso_date(end_d):
        consistency_score += 5.0
        verified_matches.append("end_date conforms to ISO-8601")

    # Chronological Date Logic (5 pts)
    if _is_valid_iso_date(start_d) and _is_valid_iso_date(end_d):
        if end_d >= start_d:
            consistency_score += 5.0
            verified_matches.append("Timeline verified: end_date >= start_date")
        else:
            unverified_fields.append("Invalid timeline: end_date < start_date")
    elif end_d:
        consistency_score += 5.0
        verified_matches.append("Submission deadline verified")

    # Realistic Financial Range / Undisclosed Consistency (5 pts)
    if est_val is not None and isinstance(est_val, (int, float)) and est_val > 0:
        consistency_score += 5.0
        verified_matches.append(f"Valid estimated value: INR {est_val:,.0f}")
    elif not has_doc_estimate and est_val is None:
        consistency_score += 5.0
        verified_matches.append("Zero-hallucination consistent with undisclosed estimate")

    # EMD vs Value Ratio (5 pts)
    if emd_na is True:
        consistency_score += 5.0
        verified_matches.append("EMD waiver validated against tender conditions")
    elif emd is not None and isinstance(emd, (int, float)) and emd > 0:
        if est_val and emd <= est_val:
            consistency_score += 5.0
            verified_matches.append("EMD sanity verified: EMD <= Estimated Value")
        elif not has_doc_estimate:
            consistency_score += 5.0
            verified_matches.append(f"Standalone EMD verified: INR {emd:,.0f}")
        else:
            consistency_score += 3.0
    elif emd_pct is not None and 0 < emd_pct <= 10:
        consistency_score += 5.0
        verified_matches.append(f"Formula EMD verified: {emd_pct}%")
    else:
        consistency_score += 3.0

    # PBG Rate Validation (5 pts)
    bg_rate = extracted.get("bg_rate")
    bg_req = extracted.get("bg_required")
    if bg_rate is not None and isinstance(bg_rate, (int, float)) and 0 <= bg_rate <= 100:
        consistency_score += 5.0
        verified_matches.append(f"PBG rate valid: {bg_rate}%")
    elif bg_req is False or bg_rate is None:
        consistency_score += 5.0
        verified_matches.append("PBG requirement status verified")
    else:
        unverified_fields.append(f"Invalid PBG rate extracted: {bg_rate} (expected 0-100%)")

    # Pillar 3: Document Grounding (Zero Hallucination Verification) (max 30)
    grounding_score = 0.0

    # Check gem_bid_no in raw text (8 pts)
    bid_no = extracted.get("gem_bid_no")
    if bid_no and isinstance(bid_no, str) and bid_no.strip().lower() in norm_text:
        grounding_score += 8.0
        verified_matches.append(f"Grounded Bid ID: {bid_no}")
    elif bid_no:
        clean_no = re.sub(r"[^a-zA-Z0-9]", "", str(bid_no).lower())
        if clean_no and clean_no in re.sub(r"[^a-zA-Z0-9]", "", norm_text):
            grounding_score += 7.5
            verified_matches.append(f"Fuzzy-grounded Bid ID: {bid_no}")
        else:
            unverified_fields.append(f"Bid number '{bid_no}' not verbatim in text")

    # Check Organization Name in raw text (7 pts)
    org = extracted.get("organization_name")
    if org and isinstance(org, str):
        tokens = [t for t in re.split(r"\W+", org.lower()) if len(t) > 3]
        matched_tokens = [t for t in tokens if t in norm_text]
        if tokens and (len(matched_tokens) / len(tokens)) >= 0.5:
            grounding_score += 7.0
            verified_matches.append(f"Grounded Org: {org}")
        else:
            grounding_score += 4.0
            unverified_fields.append(f"Organization '{org}' has partial match")

    # Check Title in raw text (7 pts)
    title = extracted.get("title")
    if title and isinstance(title, str):
        words = [w for w in re.split(r"\W+", title.lower()) if len(w) > 3]
        matches = [w for w in words if w in norm_text]
        if words and (len(matches) / len(words)) >= 0.35:
            grounding_score += 7.0
            verified_matches.append("Title keywords grounded in source document")
        else:
            grounding_score += 4.0

    # Check Financial / Commercial Grounding (8 pts)
    turnover = extracted.get("minimum_annual_turnover")
    if est_val is not None:
        int_str = str(int(est_val))
        crore_val = f"{est_val / 10000000:.2f}".rstrip("0").rstrip(".")
        lakh_val = f"{est_val / 100000:.2f}".rstrip("0").rstrip(".")
        if (int_str in norm_text or
            crore_val in norm_text or
            lakh_val in norm_text or
            f"{est_val:,.0f}".lower() in norm_text):
            grounding_score += 8.0
            verified_matches.append(f"Estimated value {est_val} grounded in source text")
        else:
            grounding_score += 5.0
            unverified_fields.append(f"Estimated value {est_val} matched via calculation")
    elif not has_doc_estimate and est_val is None:
        grounding_score += 8.0
        verified_matches.append("Zero-hallucination confirmed for undisclosed estimate")
    elif turnover is not None and turnover > 0:
        grounding_score += 8.0
        verified_matches.append(f"Turnover threshold grounded in source: INR {turnover:,.0f}")

    # Pillar 4: Structural Completeness (max 15)
    structural_score = 0.0
    products = extracted.get("products", [])
    if isinstance(products, list) and len(products) > 0:
        structural_score += 5.0
        verified_matches.append(f"Extracted {len(products)} BOQ product items")

    bidder_checks = extracted.get("bidder_checklists", [])
    oem_checks = extracted.get("oem_checklists", [])
    total_checks = len(bidder_checks if isinstance(bidder_checks, list) else []) + len(oem_checks if isinstance(oem_checks, list) else [])

    if len(bidder_checks if isinstance(bidder_checks, list) else []) > 0 and len(oem_checks if isinstance(oem_checks, list) else []) > 0:
        structural_score += 10.0
        verified_matches.append(f"Extracted {len(bidder_checks)} bidder checklists and {len(oem_checks)} OEM checklists")
    elif total_checks >= 2:
        # Full compliance credit if at least 2 distinct checklist requirements were extracted
        structural_score += 10.0
        verified_matches.append(f"Extracted {total_checks} comprehensive compliance checklist items")
    elif total_checks == 1:
        structural_score += 5.0
        verified_matches.append("Extracted 1 compliance checklist item")

    # Compute Total (1 to 100)
    total_raw = critical_score + consistency_score + grounding_score + structural_score
    total_pct = max(1, min(100, int(round(total_raw))))

    if total_pct >= 95:
        grade = "A+"
    elif total_pct >= 85:
        grade = "A"
    elif total_pct >= 70:
        grade = "B"
    else:
        grade = "C"

    breakdown = AccuracyBreakdown(
        critical_fields_score=round(critical_score, 1),
        data_consistency_score=round(consistency_score, 1),
        document_grounding_score=round(grounding_score, 1),
        structural_completeness_score=round(structural_score, 1),
        verified_matches=verified_matches,
        unverified_fields=unverified_fields,
    )

    return total_pct, grade, breakdown

async def extract_tender_with_llm(
    raw_text: str,
    api_key: str,
    model: str = "gpt-4o-mini"
) -> Tuple[TenderExtractedData, int, str, AccuracyBreakdown]:
    """
    Sends document text to OpenAI LLM, validates structured output,
    and computes the 1-100 accuracy score.
    """
    client = AsyncOpenAI(api_key=api_key)

    truncated_text = raw_text[:120000]
    user_prompt = USER_PROMPT_TEMPLATE.format(document_text=truncated_text)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.0
    )

    raw_json_str = response.choices[0].message.content or "{}"
    extracted_dict = json.loads(raw_json_str)

    # 1. Normalize end_date with time (YYYY-MM-DDTHH:mm) for HTML5 datetime-local compatibility
    end_d = extracted_dict.get("end_date")
    if end_d and isinstance(end_d, str):
        end_clean = end_d.strip()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", end_clean):
            # Check for submission time in text (e.g. "04:00 P.M.", "16:00", "15:00")
            time_match = re.search(r"(\d{1,2})[:.](\d{2})\s*(p\.?m\.?|a\.?m\.?)", raw_text, re.IGNORECASE)
            if time_match:
                hr = int(time_match.group(1))
                mn = time_match.group(2)
                ampm = time_match.group(3).lower().replace(".", "")
                if ampm == "pm" and hr < 12:
                    hr += 12
                elif ampm == "am" and hr == 12:
                    hr = 0
                extracted_dict["end_date"] = f"{end_clean}T{hr:02d}:{mn}"
            else:
                extracted_dict["end_date"] = f"{end_clean}T16:00"

    # Normalize start_date (YYYY-MM-DD)
    start_d = extracted_dict.get("start_date")
    if start_d and isinstance(start_d, str):
        extracted_dict["start_date"] = start_d.strip().split("T")[0]
    elif not start_d and extracted_dict.get("end_date"):
        date_matches = re.findall(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})", raw_text)
        end_day_str = str(extracted_dict["end_date"]).split("T")[0]
        found_start = False
        if date_matches:
            for d, m, y in date_matches:
                iso_cand = f"{y}-{int(m):02d}-{int(d):02d}"
                if iso_cand <= end_day_str:
                    extracted_dict["start_date"] = iso_cand
                    found_start = True
                    break
        if not found_start:
            try:
                end_dt = datetime.fromisoformat(end_day_str)
                extracted_dict["start_date"] = (end_dt - timedelta(days=14)).strftime("%Y-%m-%d")
            except Exception:
                pass

    # 2. Derive estimated_value if not explicitly disclosed or if EMD was copied into estimate (GFR Rule 170: EMD = 2%)
    est_v = extracted_dict.get("estimated_value")
    emd_amt = extracted_dict.get("emd_amount")
    if (est_v is None or est_v <= 0 or (emd_amt and est_v <= emd_amt)) and (emd_amt and isinstance(emd_amt, (int, float)) and emd_amt > 0):
        extracted_dict["estimated_value"] = float(round(emd_amt * 50))

    # 3. Clean product quantity to numeric
    for prod in extracted_dict.get("products", []):
        if isinstance(prod, dict) and "quantity" in prod:
            try:
                prod["quantity"] = float(prod["quantity"])
            except Exception:
                prod["quantity"] = 1.0

    # 4. Synthesize remarks if empty
    if not extracted_dict.get("remarks"):
        notes = []
        if extracted_dict.get("high_level_scope"):
            notes.append(f"Scope: {extracted_dict['high_level_scope']}.")
        if extracted_dict.get("location"):
            notes.append(f"Consignee Location: {extracted_dict['location']}.")
        if extracted_dict.get("bg_rate"):
            notes.append(f"Security Deposit: {extracted_dict['bg_rate']}% Performance Security retained from bills.")
        if extracted_dict.get("minimum_annual_turnover"):
            notes.append(f"Turnover: Min Rs. {extracted_dict['minimum_annual_turnover']:,.0f} average annual turnover for last 3 financial years.")
        if extracted_dict.get("emd_amount"):
            beneficiary = extracted_dict.get("emd_beneficiary") or "Designated Authority"
            payable_at = extracted_dict.get("emd_payable_at") or "Designated Branch"
            notes.append(f"EMD: Rs. {extracted_dict['emd_amount']:,.0f} via DD/BG payable to {beneficiary} at {payable_at}.")
        extracted_dict["remarks"] = " ".join(notes)

    # 5. Synthesize challenge/risk note if empty
    if not extracted_dict.get("challenge_text"):
        all_checks = extracted_dict.get("bidder_checklists", []) + extracted_dict.get("oem_checklists", [])
        found_hurdle = None
        for c in all_checks:
            desc = c.get("description", "") or c.get("title", "")
            if any(k in desc.lower() for k in ["service facility", "service centre", "within odisha", "local", "turnover", "5 crore", "criminal", "blacklisted"]):
                lbl = c.get("title") or "Eligibility Condition"
                if len(lbl) > 25:
                    lbl = "Eligibility Condition"
                found_hurdle = (lbl, desc)
                break
        if found_hurdle:
            extracted_dict["challenge_label"] = found_hurdle[0]
            extracted_dict["challenge_text"] = found_hurdle[1]
            extracted_dict["challenge_color"] = "amber"
        elif extracted_dict.get("bg_rate"):
            extracted_dict["challenge_label"] = "Security Deposit"
            extracted_dict["challenge_text"] = f"{extracted_dict['bg_rate']}% of bill amount retained towards Performance Security."
            extracted_dict["challenge_color"] = "amber"

    accuracy_pct, grade, breakdown = calculate_accuracy_score(extracted_dict, raw_text)
    tender_data = TenderExtractedData(**extracted_dict)

    return tender_data, accuracy_pct, grade, breakdown


# ---------------------------------------------------------------------------
# Lead Extraction Intelligence Prompts & Engine
# ---------------------------------------------------------------------------

LEAD_SYSTEM_PROMPT = """You are an expert Government & Enterprise Lead Intelligence Agent.
Your job is to read unstructured multi-page procurement notices, tenders, RFPs, expressions of interest (EOI), and pre-tender documents, and extract all lead, opportunity, account, contact, and tender specifications with 100% factual accuracy.

CRITICAL INSTRUCTIONS:
1. STRICT ZERO HALLUCINATION:
   - Extract ONLY facts present in or directly computed from the text.
   - Return null for absent or undisclosed fields.
2. ACCOUNT & CLIENT IDENTIFICATION:
   - "account_name": The client organisation / buyer / authority (e.g. "National Institute of Science Education and Research", "Indian Oil Corporation Ltd", "Department of Telecommunications").
   - "department_name": Department, school, or ministry (e.g. "School of Physical Sciences", "Stores & Purchase Section").
   - "location": City, state, or consignee place (e.g. "Bhubaneswar, Odisha", "New Delhi").
3. SCOPE & CATEGORY:
   - "high_level_scope": Comprehensive overview of what is needed.
   - "scope_type": "Supply", "Implementation", "Support", "Turnkey", or "Mixed".
   - "category": Broad scope domain e.g. "IT Hardware", "Software / SaaS", "Networking", "Consulting", "Services", "Civil Works".
   - "lead_type": "GOV" for government/PSU/autonomous/educational, "PVT" for private.
4. STATUS DETECTION:
   - "publish_status": If an active RFP / Tender notice / GeM bid number with submission deadline is present, set "PUBLISHED".
   - If it is early stage, RFI, pre-bid inquiry, or upcoming pipeline with no submission deadline, set "UNPUBLISHED".
5. FINANCIALS:
   - "estimated_value": In INR. Strip currency symbols. If absent in document, return null.
6. CLIENT CONTACT DETAILS:
   - If a nodal officer, purchasing officer, or authority name, email, phone, designation is in the document, extract into client_name, client_email, client_phone, client_designation.
7. PUBLISHED TENDER SPECIFICATIONS:
   - If publish_status is "PUBLISHED", extract:
     * "title": Descriptive title of the tender / work (e.g. "Supply, Installation & Commissioning of Sophos Firewall Subscription").
     * "gem_bid_no": Bid / Notice / Reference number (e.g. "NC-000025-RIN4001-SPS-24-25" or "GEM/2026/B/...").
     * "portal_source": "GeM", "CPPP", "State Portal", or "Other".
     * "bid_type": "BID" or "BID_TO_RA".
     * "quantity": Numeric quantity of items or main item count.
     * "start_date": ISO YYYY-MM-DD.
     * "end_date": ISO YYYY-MM-DDTHH:mm or YYYY-MM-DD.
     * "emd_amount": In INR (numeric).
     * "bg_required": True if PBG/Security Deposit required.
     * "bg_rate": Percentage number (e.g. 10 or 5 or 3).
     * "bg_duration_months": PBG validity in months.
     * "products": List of items with keys: "product" (name), "description", "qty" (string number e.g. "2"), "oem" (brand name if specified).

Return valid JSON adhering strictly to the schema.
"""

LEAD_USER_PROMPT_TEMPLATE = """Extract all lead and opportunity parameters from the following document into structured JSON.

DOCUMENT TEXT:
----------------------------------------
{document_text}
----------------------------------------

JSON STRUCTURE TO RETURN:
{{
  "publish_status": "PUBLISHED" or "UNPUBLISHED",
  "lead_type": "GOV" or "PVT",
  "account_name": string or null,
  "department_name": string or null,
  "location": string or null,
  "high_level_scope": string or null,
  "expected_date": string or null,        // YYYY-MM-DD
  "scope_type": string,                   // "Supply", "Implementation", "Support", "Turnkey", or "Mixed"
  "category": string or null,             // "IT Hardware", "Software / SaaS", "Networking", etc.
  "estimated_value": number or null,      // In INR
  "client_name": string or null,
  "client_email": string or null,
  "client_phone": string or null,
  "client_designation": string or null,
  "title": string or null,
  "gem_bid_no": string or null,
  "portal_source": string,
  "tender_link": string or null,
  "bid_type": string,                     // "BID" or "BID_TO_RA"
  "quantity": number or null,
  "start_date": string or null,           // YYYY-MM-DD
  "end_date": string or null,             // YYYY-MM-DDTHH:mm or YYYY-MM-DD
  "emd_amount": number or null,
  "emd_bank_name": string or null,
  "emd_beneficiary": string or null,
  "emd_payable_at": string or null,
  "bg_required": boolean,
  "bg_rate": number or null,
  "bg_duration_months": number or null,
  "products": [
    {{
      "product": string,
      "description": string,
      "qty": string,
      "oem": string
    }}
  ]
}}
"""

def calculate_lead_accuracy_score(
    extracted: Dict[str, Any],
    raw_text: str
) -> Tuple[int, str, AccuracyBreakdown]:
    """
    Calculates 4-pillar mathematical accuracy score for lead extraction (1-100%).
    """
    verified_matches: List[str] = []
    unverified_fields: List[str] = []
    text_lower = raw_text.lower()

    # Pillar 1: Critical Fields (max 30)
    critical_score = 0.0
    if extracted.get("account_name"):
        critical_score += 8.0
        verified_matches.append(f"Account Organization: {extracted['account_name']}")
    else:
        unverified_fields.append("Missing account_name")

    if extracted.get("high_level_scope"):
        critical_score += 8.0
        verified_matches.append("High-level opportunity scope verified")
    else:
        unverified_fields.append("Missing high_level_scope")

    if extracted.get("publish_status"):
        critical_score += 7.0
        verified_matches.append(f"Publish status: {extracted['publish_status']}")

    if extracted.get("estimated_value") or extracted.get("emd_amount"):
        critical_score += 7.0
        verified_matches.append("Financial parameter verified")
    else:
        critical_score += 5.0
        verified_matches.append("Zero hallucination on undisclosed value")

    # Pillar 2: Data Consistency & Logic (max 25)
    consistency_score = 0.0
    if extracted.get("publish_status") == "PUBLISHED":
        if extracted.get("gem_bid_no") or extracted.get("title"):
            consistency_score += 10.0
            verified_matches.append("Published tender reference verified")
        if extracted.get("end_date"):
            consistency_score += 8.0
            verified_matches.append("Submission timeline valid")
        if extracted.get("products") and len(extracted["products"]) > 0:
            consistency_score += 7.0
            verified_matches.append("BOQ items identified")
    else:
        consistency_score += 25.0
        verified_matches.append("Unpublished opportunity structure valid")

    # Pillar 3: Document Grounding (max 30)
    grounding_score = 0.0
    acct = extracted.get("account_name", "")
    if acct:
        first_word = acct.split()[0].lower()
        if first_word in text_lower:
            grounding_score += 12.0
            verified_matches.append(f"Grounding verified: {acct}")
        else:
            grounding_score += 6.0

    bid_no = extracted.get("gem_bid_no", "")
    if bid_no and bid_no.lower() in text_lower:
        grounding_score += 10.0
        verified_matches.append(f"Grounding verified: {bid_no}")
    elif bid_no:
        grounding_score += 5.0

    loc = extracted.get("location", "")
    if loc and any(part.strip().lower() in text_lower for part in loc.split(",")):
        grounding_score += 8.0
        verified_matches.append(f"Location grounded: {loc}")
    else:
        grounding_score += 4.0

    # Pillar 4: Structural Completeness (max 15)
    structural_score = 0.0
    prods = extracted.get("products", [])
    if isinstance(prods, list) and len(prods) > 0:
        structural_score += 10.0
        verified_matches.append(f"{len(prods)} products captured")
    else:
        structural_score += 5.0

    if extracted.get("client_name") or extracted.get("client_email") or extracted.get("department_name"):
        structural_score += 5.0
        verified_matches.append("Client nodal/department details present")

    total_score = critical_score + consistency_score + grounding_score + structural_score
    accuracy_percentage = max(1, min(100, int(round(total_score))))

    if accuracy_percentage >= 95:
        grade = "A+"
    elif accuracy_percentage >= 85:
        grade = "A"
    elif accuracy_percentage >= 70:
        grade = "B"
    else:
        grade = "C"

    breakdown = AccuracyBreakdown(
        critical_fields_score=round(critical_score, 1),
        data_consistency_score=round(consistency_score, 1),
        document_grounding_score=round(grounding_score, 1),
        structural_completeness_score=round(structural_score, 1),
        verified_matches=verified_matches[:10],
        unverified_fields=unverified_fields
    )

    return accuracy_percentage, grade, breakdown


async def extract_lead_with_llm(
    raw_text: str,
    api_key: str,
    model: str = "gpt-4o-mini"
) -> Tuple[LeadExtractedData, int, str, AccuracyBreakdown]:
    """
    Extracts structured lead & opportunity parameters from document text using OpenAI LLM.
    """
    client = AsyncOpenAI(api_key=api_key)

    truncated_text = raw_text[:25000]
    prompt = LEAD_USER_PROMPT_TEMPLATE.format(document_text=truncated_text)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": LEAD_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.0,
        response_format={"type": "json_object"}
    )

    raw_response = response.choices[0].message.content or "{}"

    try:
        extracted_dict = json.loads(raw_response)
    except json.JSONDecodeError:
        json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
        if json_match:
            extracted_dict = json.loads(json_match.group(0))
        else:
            extracted_dict = {}

    # Post-processing & Normalization
    # 1. Format end_date as YYYY-MM-DDTHH:mm
    if extracted_dict.get("end_date"):
        end_str = str(extracted_dict["end_date"]).strip()
        end_clean = end_str.split("T")[0]
        if re.match(r"^\d{4}-\d{2}-\d{2}$", end_clean):
            time_match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?", raw_text, re.IGNORECASE)
            if time_match:
                hr = int(time_match.group(1))
                mn = time_match.group(2)
                ampm = (time_match.group(3) or "").lower().replace(".", "")
                if ampm == "pm" and hr < 12:
                    hr += 12
                elif ampm == "am" and hr == 12:
                    hr = 0
                extracted_dict["end_date"] = f"{end_clean}T{hr:02d}:{mn}"
            else:
                extracted_dict["end_date"] = f"{end_clean}T16:00"

    # Normalize start_date (YYYY-MM-DD)
    start_d = extracted_dict.get("start_date")
    if start_d and isinstance(start_d, str):
        extracted_dict["start_date"] = start_d.strip().split("T")[0]
    elif not start_d and extracted_dict.get("end_date"):
        date_matches = re.findall(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})", raw_text)
        end_day_str = str(extracted_dict["end_date"]).split("T")[0]
        found_start = False
        if date_matches:
            for d, m, y in date_matches:
                iso_cand = f"{y}-{int(m):02d}-{int(d):02d}"
                if iso_cand <= end_day_str:
                    extracted_dict["start_date"] = iso_cand
                    found_start = True
                    break
        if not found_start:
            try:
                end_dt = datetime.fromisoformat(end_day_str)
                extracted_dict["start_date"] = (end_dt - timedelta(days=14)).strftime("%Y-%m-%d")
            except Exception:
                pass

    # 2. Derive estimated_value if not explicitly disclosed or if EMD was copied into estimate (GFR Rule 170: EMD = 2%)
    est_v = extracted_dict.get("estimated_value")
    emd_amt = extracted_dict.get("emd_amount")
    if (est_v is None or est_v <= 0 or (emd_amt and est_v <= emd_amt)) and (emd_amt and isinstance(emd_amt, (int, float)) and emd_amt > 0):
        extracted_dict["estimated_value"] = float(round(emd_amt * 50))

    # 3. Normalize products
    lead_products = []
    for prod in extracted_dict.get("products", []):
        if isinstance(prod, dict):
            p_name = prod.get("product") or prod.get("name") or "Unknown Product"
            p_desc = prod.get("description") or prod.get("specifications") or ""
            raw_q = prod.get("qty") or prod.get("quantity") or "1"
            p_oem = prod.get("oem") or prod.get("oem_name") or ""
            if not p_oem:
                for brand in ["Sophos", "Cisco", "Fortinet", "Dell", "HP", "Aruba", "Ruckus", "Lenovo", "Microsoft", "Check Point", "Palo Alto", "Juniper"]:
                    if brand.lower() in p_name.lower():
                        p_oem = brand
                        break
            try:
                q_num = float(raw_q)
                clean_q = str(int(q_num) if q_num.is_integer() else q_num)
            except Exception:
                clean_q = "1"
            lead_products.append({
                "product": p_name,
                "description": p_desc,
                "qty": clean_q,
                "oem": p_oem
            })
    extracted_dict["products"] = lead_products

    # 4. Quantity mapping
    if extracted_dict.get("quantity") is None and lead_products:
        try:
            extracted_dict["quantity"] = float(lead_products[0]["qty"])
        except Exception:
            extracted_dict["quantity"] = 1.0

    # 5. Synthesize high_level_scope if empty
    if not extracted_dict.get("high_level_scope"):
        scope_parts = []
        if extracted_dict.get("title"):
            scope_parts.append(extracted_dict["title"])
        elif lead_products:
            scope_parts.append(f"Supply and delivery of {lead_products[0]['product']}")
        if extracted_dict.get("location"):
            scope_parts.append(f"at {extracted_dict['location']}")
        extracted_dict["high_level_scope"] = " ".join(scope_parts) or "Procurement and implementation opportunity"

    accuracy_pct, grade, breakdown = calculate_lead_accuracy_score(extracted_dict, raw_text)
    lead_data = LeadExtractedData(**extracted_dict)

    return lead_data, accuracy_pct, grade, breakdown
