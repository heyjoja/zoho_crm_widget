import { getZohoSDK } from '../context/ZohoContext.jsx'

const mapRecord = (record) => ({
  id: record.id,
  firstName: record.First_Name ?? '',
  lastName: record.Last_Name ?? '',
  email: record.Email ?? '',
  phone: record.Phone ?? '',
  location: record.Mailing_City ?? '',
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

  const response = await ZOHO.CRM.API.getAllRecords({
    Entity: 'Contacts',
    sort_order: 'asc',
  })

  const records = response?.data ?? []
  return records.map(mapRecord)
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

  const response = await ZOHO.CRM.API.searchRecord({
    Entity: 'Contacts',
    Type: 'word',
    Query: trimmed,
  })

  const records = response?.data ?? []
  return records.map(mapRecord)
}