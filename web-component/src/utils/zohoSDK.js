
import { getZohoSDK } from '../context/ZohoContext.jsx'

/**
 * Fields to fetch from Zoho CRM.
 * Custom fields (like QID) must be listed explicitly — they are not returned by default.
 */
const CONTACT_FIELDS = [
  'id',
  'QID',
  'Record_Image',
  'First_Name',
  'Last_Name',
  'Phone',
  'Email',
  'Mailing_Flat_House_No_Building_Apartment_Name',
  'Mailing_Street',
  'Mailing_City',
  'Mailing_State',
  'Mailing_Zip',
  'Mailing_Country',
  'Mailing_Longitude',
  'Mailing_Latitude',
].join(',')

/** Fallback org ID — used when Zoho globals do not expose it at runtime. */
const FALLBACK_ORG_ID = '938042819'

/**
 * Reads the CRM organisation ID from Zoho SDK globals.
 * Falls back to FALLBACK_ORG_ID if none of the known paths are populated.
 * @returns {string}
 */
const resolveOrgId = () => {
  try {
    const fromConfig =
        window.ZOHO?.CRM?.CONFIG?.OrganizationInfo?.zgid ??
        window.ZOHO?.CRM?.CONFIG?.OrganizationInfo?.id ??
        window.ZOHO?.CRM?.CONFIG?.orgId ??
        null

    if (fromConfig) return String(fromConfig)

    const fromMeta =
        window.ZOHO?.CRM?.META?.orgId ??
        window.ZOHO?.CRM?.META?.zgid ??
        null

    if (fromMeta) return String(fromMeta)
  } catch {
    // ignore
  }

  console.warn(`[zohoSDK] resolveOrgId: could not read orgId from ZOHO globals — using fallback "${FALLBACK_ORG_ID}".`)
  return FALLBACK_ORG_ID
}

/**
 * Builds the full Zoho CRM image URL from a raw Record_Image hash.
 *
 * Zoho returns only the file hash in Record_Image, e.g.:
 *   "28ac36384e75b5110d94908681f34caa..."
 *
 * The loadable URL format is:
 *   https://crm.zoho.com/crm/org{ORG_ID}/EntityImageAttach.do
 *     ?action_module=Contacts&entityId={RECORD_ID}&actionName=readImage&fileId={HASH}
 *
 * @param {string|null} imageHash  - raw value from Record_Image field
 * @param {string}      recordId   - the record's Zoho entity ID (used as entityId)
 * @param {string}      orgId      - CRM org ID
 * @returns {string|null}
 */
const buildImageUrl = (imageHash, recordId, orgId) => {
  if (!imageHash || !recordId || !orgId) return null
  const params = new URLSearchParams({
    action_module: 'Contacts',
    entityId: String(recordId),
    actionName: 'readImage',
    fileId: imageHash,
  })
  return `https://crm.zoho.com/crm/org${orgId}/EntityImageAttach.do?${params.toString()}`
}

/**
 * Maps a raw Zoho CRM contact record to the internal contact model.
 * @param {Object} record
 * @param {string} orgId
 * @returns {Object}
 */
const mapRecord = (record, orgId) => ({
  id: record.id,

  // Human-readable sequential ID (custom field — must be requested explicitly)
  qid: record.QID ?? null,

  // Profile image: built from the file hash + record ID + org ID
  recordImage: buildImageUrl(record.Record_Image, record.id, orgId),

  // Name
  firstName: record.First_Name ?? '',
  lastName: record.Last_Name ?? '',

  // Contact info
  phone: record.Phone ?? '',
  email: record.Email ?? '',

  // Address parts — used by AddressEditor
  streetAddress: [
    record.Mailing_Flat_House_No_Building_Apartment_Name ?? '',
    record.Mailing_Street ?? '',
  ].filter(Boolean).join(', '),
  city: record.Mailing_City ?? '',
  provinceState: record.Mailing_State ?? '',
  postalCode: record.Mailing_Zip ?? '',
  country: record.Mailing_Country ?? '',

  // Coordinates
  coordinatesLng: record.Mailing_Longitude ?? null,
  coordinatesLat: record.Mailing_Latitude ?? null,

  // Computed display string for the Location column and map
  location: [
    record.Mailing_Flat_House_No_Building_Apartment_Name,
    record.Mailing_Street,
    record.Mailing_City,
    record.Mailing_State,
    record.Mailing_Country,
  ].filter(Boolean).join(', '),
})

/**
 * Fetches all Zoho CRM contacts (initial list).
 * @returns {Promise<Array>}
 */
export async function getAllContacts() {
  const ZOHO = getZohoSDK()

  if (!ZOHO) {
    throw new Error('Zoho SDK is not available.')
  }

  const orgId = resolveOrgId()

  const response = await ZOHO.CRM.API.getAllRecords({
    Entity: 'Contacts',
    sort_order: 'asc',
    fields: CONTACT_FIELDS,
  })

  console.group('[zohoSDK] getAllContacts — raw response')
  console.log('orgId resolved:', orgId)
  console.log('Full response object:', response)
  console.log('response.data:', response?.data)
  if (response?.data?.length > 0) {
    console.log('First raw record (all fields):', response.data[0])
    console.log('  → QID value:', response.data[0].QID)
    console.log('  → Record_Image (hash):', response.data[0].Record_Image)
  }
  console.groupEnd()

  const records = response?.data ?? []
  const mapped = records.map((r) => mapRecord(r, orgId))

  if (mapped.length > 0) {
    console.group('[zohoSDK] getAllContacts — first mapped contact')
    console.log(mapped[0])
    console.groupEnd()
  }

  return mapped
}

/**
 * Searches Zoho CRM contacts by a given search term.
 * Requires at least 2 non-whitespace characters.
 * @param {string} searchTerm
 * @returns {Promise<Array>}
 */
export async function searchContacts(searchTerm) {
  const ZOHO = getZohoSDK()

  if (!ZOHO) {
    throw new Error('Zoho SDK is not available.')
  }

  const trimmed = searchTerm.trim()

  if (trimmed.length < 2) {
    throw new Error('Search term must be at least 2 characters.')
  }

  const orgId = resolveOrgId()

  const response = await ZOHO.CRM.API.searchRecord({
    Entity: 'Contacts',
    Type: 'word',
    Query: trimmed,
    fields: CONTACT_FIELDS,
  })

  console.group(`[zohoSDK] searchContacts("${trimmed}") — raw response`)
  console.log('orgId resolved:', orgId)
  console.log('Full response object:', response)
  console.log('response.data:', response?.data)
  if (response?.data?.length > 0) {
    console.log('First raw record (all fields):', response.data[0])
    console.log('  → QID value:', response.data[0].QID)
    console.log('  → Record_Image (hash):', response.data[0].Record_Image)
  }
  console.groupEnd()

  const records = response?.data ?? []
  const mapped = records.map((r) => mapRecord(r, orgId))

  if (mapped.length > 0) {
    console.group(`[zohoSDK] searchContacts("${trimmed}") — first mapped contact`)
    console.log(mapped[0])
    console.groupEnd()
  }

  return mapped
}