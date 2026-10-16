// The tender details a published lead carries: blank state, the payload sent to the server, and the checks.
// Shared by the Add / Edit Lead form and the Publish Lead dialog, so both capture and validate exactly the same thing.
import { validateEmd } from './tenderSpec.js'

/** The published-only fields of the lead form, flat (the server stores them under published_details). */
export const PUBLISHED_BLANK = {
  title: '',
  gem_bid_no: '',
  start_date: '',
  end_date: '',
  portal_source: 'GeM',
  bid_type: 'BID',
  quantity: '',
  emd_amount: '',
  emd_not_applicable: false,
  emd_exemption_types: [],
  emd_exemption_reason: '',
  emd_bank_name: '',
  emd_account_number: '',
  emd_ifsc_code: '',
  emd_branch: '',
  emd_beneficiary: '',
  emd_payable_at: '',
  bg_required: false,
  bg_rate: '',
  bg_duration_months: '',
}

export const blankProducts = () => [{ id: 1, product: '', description: '', qty: '', oem: '' }]

const text = (v) => (v && v.trim() ? v.trim() : undefined)
const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))

/** Same keys as the tender create payload, so a later Lead -> Bid conversion can pass these straight through. */
export function buildPublishedDetails(form, products, emdOnlineOn, emdDdOn) {
  return {
    gem_bid_no: text(form.gem_bid_no),
    start_date: form.start_date || undefined,
    end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
    portal_source: text(form.portal_source),
    bid_type: form.bid_type,
    quantity: num(form.quantity),
    requested_products: products
      .filter((p) => p.product.trim() || p.description.trim())
      .map(({ product, description, qty, oem }) => ({ product, description, qty, oem })),
    emd_not_applicable: form.emd_not_applicable,
    emd_amount: num(form.emd_amount),
    emd_online: emdOnlineOn,
    emd_bank_name: text(form.emd_bank_name),
    emd_account_number: text(form.emd_account_number),
    emd_ifsc_code: text(form.emd_ifsc_code),
    emd_branch: text(form.emd_branch),
    emd_dd: emdDdOn,
    emd_beneficiary: text(form.emd_beneficiary),
    emd_payable_at: text(form.emd_payable_at),
    emd_exemption_types: form.emd_exemption_types,
    emd_exemption_reason: text(form.emd_exemption_reason),
    bg_required: form.bg_required,
    bg_rate: form.bg_required ? num(form.bg_rate) : undefined,
    bg_duration_months: form.bg_required ? num(form.bg_duration_months) : undefined,
  }
}

/** The body of POST /leads/:id/publish. */
export const buildPublishPayload = (form, products, emdOnlineOn, emdDdOn) => ({
  title: form.title.trim(),
  published_details: buildPublishedDetails(form, products, emdOnlineOn, emdDdOn),
})

/** Message per field that cannot be saved (empty object = ready). */
export function validatePublished(form, emdOnlineOn, emdDdOn) {
  const errors = {}
  if (!form.title.trim()) errors.title = 'Tender title is required'
  Object.assign(errors, validateEmd(form, emdOnlineOn, emdDdOn))
  return errors
}
