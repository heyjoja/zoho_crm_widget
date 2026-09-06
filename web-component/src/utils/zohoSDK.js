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
 * @param {string|null} imageHash
 * @param {string}      recordId
 * @param {string}      orgId
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
  qid: record.QID ?? null,
  recordImage: buildImageUrl(record.Record_Image, record.id, orgId),
  firstName: record.First_Name ?? '',
  lastName: record.Last_Name ?? '',
  phone: record.Phone ?? '',
  email: record.Email ?? '',
  streetAddress: [
    record.Mailing_Flat_House_No_Building_Apartment_Name ?? '',
    record.Mailing_Street ?? '',
  ].filter(Boolean).join(', '),
  city: record.Mailing_City ?? '',
  provinceState: record.Mailing_State ?? '',
  postalCode: record.Mailing_Zip ?? '',
  country: record.Mailing_Country ?? '',
  coordinatesLng: record.Mailing_Longitude ?? null,
  coordinatesLat: record.Mailing_Latitude ?? null,
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

/**
 * Fetches a single Zoho CRM contact by record ID.
 * @param {string} contactId
 * @returns {Promise<Object>}
 */
 export async function getContact(contactId) {
  const ZOHO = getZohoSDK()

  if (!ZOHO) {
    throw new Error('Zoho SDK is not available.')
  }

  const orgId = resolveOrgId()

  const response = await ZOHO.CRM.API.getRecord({
    Entity: 'Contacts',
    RecordID: contactId,
    fields: CONTACT_FIELDS,
  })

  console.group(`[zohoSDK] getContact("${contactId}") — raw response`)
  console.log('orgId resolved:', orgId)
  console.log('Full response object:', response)
  console.groupEnd()

  const record = response?.data?.[0]
  if (!record) {
    throw new Error(`[zohoSDK] getContact: no record returned for id "${contactId}"`)
  }

  return mapRecord(record, orgId)
 }

 /**
 * Updates a contact record in Zoho CRM.
 * Uses the same ZOHO.CRM SDK instance — no extra API keys required.
 *
 * @param {string} contactId - The Zoho CRM record ID of the contact.
 * @param {Object} fields - The fields to update, e.g. { First_Name: 'John', Last_Name: 'Doe' }
 * @returns {Promise<Object>} - The API response from Zoho CRM.
 */
export async function updateContact(contactId, fields) {
  const ZOHO = getZohoSDK()

  if (!ZOHO) {
    throw new Error('[Zoho] SDK not available. Cannot update contact.')
  }

  const response = await ZOHO.CRM.API.updateRecord({
    Entity: 'Contacts',
    APIData: {
      id: contactId,
      ...fields,
    },
    Trigger: [], // Set to ['workflow'] if you want to trigger Zoho workflows
  })

  // Zoho SDK wraps the result in response.data[0]
  const result = response?.data?.[0]

  if (result?.status === 'error' || result?.code !== 'SUCCESS') {
    throw new Error(
      `[Zoho] Failed to update contact: ${result?.message || JSON.stringify(result)}`
    )
  }

  return result
}

/**
 * Creates a new contact record in Zoho CRM.
 *
 * @param {Object} contactData - Internal contact model fields.
 * @param {string} contactData.firstName
 * @param {string} contactData.lastName
 * @param {string} [contactData.phone]
 * @param {string} [contactData.email]
 * @param {string} [contactData.streetAddress]   - maps to Mailing_Street
 * @param {string} [contactData.flatHouseNo]     - maps to Mailing_Flat_House_No_Building_Apartment_Name
 * @param {string} [contactData.city]
 * @param {string} [contactData.provinceState]
 * @param {string} [contactData.postalCode]
 * @param {string} [contactData.country]
 * @param {number} [contactData.coordinatesLng]
 * @param {number} [contactData.coordinatesLat]
 * @returns {Promise<Object>} - The API response result from Zoho CRM.
 */
export async function createContact(contactData) {
  const ZOHO = getZohoSDK()

  if (!ZOHO) {
    throw new Error('[Zoho] SDK not available. Cannot create contact.')
  }

  const APIData = {
    First_Name: contactData.firstName ?? '',
    Last_Name: contactData.lastName ?? '',
    ...(contactData.phone     && { Phone: contactData.phone }),
    ...(contactData.email     && { Email: contactData.email }),
    ...(contactData.flatHouseNo   && { Mailing_Flat_House_No_Building_Apartment_Name: contactData.flatHouseNo }),
    ...(contactData.streetAddress && { Mailing_Street: contactData.streetAddress }),
    ...(contactData.city          && { Mailing_City: contactData.city }),
    ...(contactData.provinceState && { Mailing_State: contactData.provinceState }),
    ...(contactData.postalCode    && { Mailing_Zip: contactData.postalCode }),
    ...(contactData.country       && { Mailing_Country: contactData.country }),
    ...(contactData.coordinatesLng != null && { Mailing_Longitude: contactData.coordinatesLng }),
    ...(contactData.coordinatesLat != null && { Mailing_Latitude: contactData.coordinatesLat }),
  }

  console.group('[zohoSDK] createContact — payload')
  console.log('APIData:', APIData)
  console.groupEnd()

  const response = await ZOHO.CRM.API.insertRecord({
    Entity: 'Contacts',
    APIData,
    Trigger: [],
  })

  console.group('[zohoSDK] createContact — raw response')
  console.log('Full response object:', response)
  console.groupEnd()

  // Zoho SDK wraps the result in response.data[0]
  const result = response?.data?.[0]

  if (result?.status === 'error' || result?.code !== 'SUCCESS') {
    throw new Error(
      `[Zoho] Failed to create contact: ${result?.message || JSON.stringify(result)}`
    )
  }

  return result
}