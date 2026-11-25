from typing import List, Optional, Any, Dict, Union
from pydantic import BaseModel, Field, field_validator

class TenderProductItem(BaseModel):
    name: str = Field(default="Unknown Product", description="Item or product name")
    quantity: float = Field(default=1.0, description="Quantity required")
    units: str = Field(default="Nos", description="Units e.g. Nos, Sets, Lots, Meters, Box, RMT")
    oem_name: Optional[str] = Field(None, description="Preferred or required OEM")
    specifications: Optional[str] = Field(None, description="Brief technical specifications")

class LeadProductItem(BaseModel):
    product: str = Field(default="Unknown Product", description="Item or product name")
    description: Optional[str] = Field(default="", description="Brief technical specifications or unit info")
    qty: Optional[str] = Field(default="1", description="Quantity")
    oem: Optional[str] = Field(default="", description="Preferred or required OEM")

class ChecklistItem(BaseModel):
    title: str = Field(default="Requirement", description="Checklist requirement title")
    description: str = Field(default="", description="Detailed submission requirement")
    is_mandatory: bool = Field(default=True, description="Whether this is mandatory")

class LeadExtractedData(BaseModel):
    publish_status: Optional[str] = Field(default="PUBLISHED", description="PUBLISHED or UNPUBLISHED")
    lead_type: Optional[str] = Field(default="GOV", description="GOV or PVT")
    account_name: Optional[str] = Field(None, description="Procuring Organization or Client name")
    department_name: Optional[str] = Field(None, description="Department, Ministry, or Division")
    location: Optional[str] = Field(None, description="Project or Delivery location")
    high_level_scope: Optional[str] = Field(None, description="Comprehensive summary of project/opportunity scope")
    expected_date: Optional[str] = Field(None, description="Expected completion or delivery date YYYY-MM-DD")
    scope_type: Optional[str] = Field(default="Supply", description="Scope type: Supply, Implementation, Support, etc.")
    category: Optional[str] = Field(None, description="Category / Scope Group")
    estimated_value: Optional[float] = Field(None, description="Estimated Project Value in INR (Numeric)")

    # Client / Contact details
    client_name: Optional[str] = Field(None, description="Client nodal officer or authority contact name")
    client_email: Optional[str] = Field(None, description="Client email address")
    client_phone: Optional[str] = Field(None, description="Client phone or mobile number")
    client_designation: Optional[str] = Field(None, description="Client designation or department title")

    # Published Tender Details
    title: Optional[str] = Field(None, description="Tender or RFP Title / Subject")
    gem_bid_no: Optional[str] = Field(None, description="GeM Bid Number, Tender Notice Number or RFP ID")
    portal_source: Optional[str] = Field(default="GeM", description="Source portal (GeM, CPWD, CPP, Railway, etc.)")
    tender_link: Optional[str] = Field(None, description="Official portal link if found")
    bid_type: Optional[str] = Field(default="BID", description="Type of bid: BID or BID_TO_RA")
    quantity: Optional[float] = Field(None, description="Total quantity of items")
    start_date: Optional[str] = Field(None, description="Start Date in ISO-8601 YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="End / Submission Deadline in ISO-8601 YYYY-MM-DDTHH:mm")
    emd_amount: Optional[float] = Field(None, description="Earnest Money Deposit in INR (Numeric)")
    emd_bank_name: Optional[str] = Field(None, description="Bank name for EMD / DD")
    emd_beneficiary: Optional[str] = Field(None, description="Beneficiary in favor of whom EMD is payable")
    emd_payable_at: Optional[str] = Field(None, description="City / Branch where payable")
    bg_required: Optional[bool] = Field(default=False, description="True if Performance Security / PBG is required")
    bg_rate: Optional[float] = Field(None, description="PBG percentage (e.g. 3 or 5 or 10)")
    bg_duration_months: Optional[int] = Field(None, description="PBG validity in months")
    products: Optional[List[LeadProductItem]] = Field(default_factory=list, description="List of BOQ / Products")

    @field_validator("products", mode="before")
    def default_products(cls, v):
        return v if isinstance(v, list) else []

    @field_validator("bg_required", mode="before")
    def default_bg_bool(cls, v):
        return bool(v) if v is not None else False

class TenderExtractedData(BaseModel):
    title: Optional[str] = Field(None, description="Tender or RFP Title / Subject")
    gem_bid_no: Optional[str] = Field(None, description="GeM Bid Number or NIT Reference ID")
    organization_name: Optional[str] = Field(None, description="Procuring Organization or Ministry")
    department_name: Optional[str] = Field(None, description="Department, Division, or Sub-unit")
    location: Optional[str] = Field(None, description="Consignee or Project Location")
    portal_source: Optional[str] = Field(default="GeM", description="Source portal (GeM, CPWD, CPP, Railway, etc.)")
    tender_link: Optional[str] = Field(None, description="Official portal link if found")
    bid_type: Optional[str] = Field(default="GEM", description="Type of bid: GEM, OPEN, LIMITED, EOI, etc.")
    category: Optional[str] = Field(default="SERVICES", description="SERVICES, GOODS, WORKS, or CONSULTING")
    scope_type: Optional[str] = Field(default="SUPPLY", description="SUPPLY, SERVICES, TURNKEY, or AMC")
    estimated_value: Optional[float] = Field(None, description="Estimated Tender Value in INR (Numeric)")
    emd_amount: Optional[float] = Field(None, description="Earnest Money Deposit in INR (Numeric)")
    emd_percentage: Optional[float] = Field(None, description="EMD percentage if formula based (e.g. 1.0 or 2.0)")
    emd_formula: Optional[str] = Field(None, description="Description of EMD rule (e.g. '1% of quoted value')")
    emd_not_applicable: Optional[bool] = Field(default=False, description="True if EMD is waived or not required")
    emd_exemption_types: Optional[List[str]] = Field(default_factory=list, description="Exemptions: MSME, NSIC, Startup, etc.")
    tender_fee: Optional[float] = Field(None, description="Tender processing fee / document cost in INR")
    minimum_annual_turnover: Optional[float] = Field(None, description="Minimum average annual turnover required for bidder in INR")
    years_of_past_experience: Optional[int] = Field(None, description="Past experience in years required for bidder")
    contract_period_months: Optional[int] = Field(None, description="Contract or delivery period in months")
    evaluation_method: Optional[str] = Field(None, description="Evaluation method: Total value wise, Item-wise, etc.")
    oem_required: Optional[bool] = Field(default=False, description="True if Manufacturer Authorization Form (MAF) is mandatory")
    bg_required: Optional[bool] = Field(default=False, description="True if Performance Bank Guarantee (PBG) is required")
    bg_rate: Optional[float] = Field(None, description="PBG percentage (e.g. 3 or 5 or 10)")
    bg_duration_months: Optional[int] = Field(None, description="PBG validity in months")
    start_date: Optional[str] = Field(None, description="Start Date in ISO-8601 YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="End / Submission Deadline in ISO-8601 YYYY-MM-DD")
    high_level_scope: Optional[str] = Field(None, description="Comprehensive summary of project scope")
    emd_bank_name: Optional[str] = Field(None, description="Bank name for EMD / DD")
    emd_beneficiary: Optional[str] = Field(None, description="Beneficiary in favor of whom EMD is payable")
    emd_payable_at: Optional[str] = Field(None, description="City / Branch where payable")
    products: Optional[List[TenderProductItem]] = Field(default_factory=list, description="List of BOQ / Products")
    bidder_checklists: Optional[List[ChecklistItem]] = Field(default_factory=list, description="Bidder compliance checklist")
    oem_checklists: Optional[List[ChecklistItem]] = Field(default_factory=list, description="OEM compliance checklist")
    remarks: Optional[str] = Field(None, description="Detailed operational briefing and internal notes summarizing terms, delivery, and eligibility")
    challenge_label: Optional[str] = Field(None, description="Highlight condition or risk label e.g. 'Delivery Risk', 'Turnover Condition', 'Local Service Facility', 'Attention'")
    challenge_text: Optional[str] = Field(None, description="Detailed challenge or critical condition to highlight for reviewers")
    challenge_color: Optional[str] = Field(None, description="Color tag for challenge e.g. 'amber', 'rose', 'orange', 'violet'")

    @field_validator("category", mode="before")
    def default_category(cls, v):
        return v or "SERVICES"

    @field_validator("scope_type", mode="before")
    def default_scope(cls, v):
        return v or "SUPPLY"

    @field_validator("portal_source", mode="before")
    def default_portal(cls, v):
        return v or "Other"

    @field_validator("bid_type", mode="before")
    def default_bid_type(cls, v):
        return v or "OPEN"

    @field_validator("emd_not_applicable", "oem_required", "bg_required", mode="before")
    def default_bool(cls, v):
        return bool(v) if v is not None else False

    @field_validator("emd_exemption_types", "products", "bidder_checklists", "oem_checklists", mode="before")
    def default_list(cls, v):
        return v if isinstance(v, list) else []

class AccuracyBreakdown(BaseModel):
    critical_fields_score: float = Field(..., description="Score for high-priority mandatory fields (max 30)")
    data_consistency_score: float = Field(..., description="Score for format, range, and logical consistency (max 25)")
    document_grounding_score: float = Field(..., description="Score for verified grounding against raw document (max 30)")
    structural_completeness_score: float = Field(..., description="Score for arrays/lists: products & checklists (max 15)")
    verified_matches: List[str] = Field(default_factory=list, description="Fields factually verified against document text")
    unverified_fields: List[str] = Field(default_factory=list, description="Fields not explicitly found in document text")

class ExtractionMeta(BaseModel):
    filename: str
    file_type: str
    pages_read: int
    character_count: int
    extraction_time_ms: int
    accuracy_percentage: int = Field(..., ge=1, le=100, description="Calculated accuracy percentage 1-100")
    accuracy_grade: str = Field(..., description="A+ (95-100), A (85-94), B (70-84), C (<70)")
    accuracy_breakdown: AccuracyBreakdown
    model_used: str

class ExtractionResponse(BaseModel):
    success: bool
    data: Union[TenderExtractedData, LeadExtractedData, Dict[str, Any]]
    meta: ExtractionMeta
