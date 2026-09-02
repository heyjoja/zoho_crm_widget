import { useEffect, useState } from 'react'

const postalCodeCache = new Map()
const addressSuggestionCache = new Map()
let nextNominatimRequestAt = 0

const countryOptions = [
    { code: 'CA', name: 'Canada' },
    { code: 'US', name: 'United States' },
]

const normalizeCountryCode = (value = '') => {
    const normalized = String(value).trim().toUpperCase()

    if (normalized === 'US' || normalized === 'USA' || normalized.includes('UNITED STATES')) return 'US'
    if (normalized === 'CA' || normalized === 'CAN' || normalized.includes('CANADA')) return 'CA'
    return ''
}

const normalizePostalCode = (value = '') => String(value).replace(/[\s-]/g, '').toUpperCase()

const getCity = (address = {}) => (
    address.city
    ?? address.town
    ?? address.village
    ?? address.municipality
    ?? address.county
    ?? ''
)

const lookupWithZippopotam = async (countryCode, postalCode) => {
    const requestPostalCode = countryCode === 'CA'
        ? postalCode.replace(/\s+/g, '').slice(0, 3)
        : postalCode
    const cacheKey = `${countryCode}:${requestPostalCode.toUpperCase()}`
    const cachedResult = postalCodeCache.get(cacheKey)

    if (cachedResult) return cachedResult

    const response = await fetch(
        `https://api.zippopotam.us/${encodeURIComponent(countryCode)}/${encodeURIComponent(requestPostalCode)}`,
    )
    if (!response.ok) throw new Error('Postal code not found in Zippopotam.')

    const result = await response.json()
    postalCodeCache.set(cacheKey, result)
    return result
}

const lookupWithNominatim = async ({ streetAddress, postalCode, countryCode }) => {
    const cacheKey = [countryCode, postalCode, streetAddress].join(':').toLowerCase()
    const cachedResult = addressSuggestionCache.get(cacheKey)

    if (cachedResult) return cachedResult

    const delay = Math.max(0, nextNominatimRequestAt - Date.now())
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    nextNominatimRequestAt = Date.now() + 1000

    const query = new URLSearchParams({
        postalcode: postalCode,
        format: 'jsonv2',
        addressdetails: '1',
        limit: '2',
        countrycodes: countryCode.toLowerCase(),
    })
    if (streetAddress.trim()) query.set('street', streetAddress.trim())
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
        headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error('Address suggestions are unavailable.')

    const result = await response.json()
    addressSuggestionCache.set(cacheKey, result)
    return result
}

const EditIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
)

const SaveIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
)

const SearchIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
    </svg>
)

const createDraft = (address) => ({
    streetAddress: address.streetAddress ?? '',
    postalCode: address.postalCode ?? '',
    city: address.city ?? '',
    provinceState: address.provinceState ?? '',
    country: address.country ?? '',
    countryCode: normalizeCountryCode(address.countryCode ?? address.country) || 'US',
})

export default function AddressEditor({ contactId, address, onSave }) {
    const [isEditing, setIsEditing] = useState(false)
    const [draft, setDraft] = useState(() => createDraft(address))
    const [lookupStatus, setLookupStatus] = useState('idle')
    const [lookupMessage, setLookupMessage] = useState('')
    const [streetSuggestions, setStreetSuggestions] = useState([])

    useEffect(() => {
        setDraft(createDraft(address))
        setIsEditing(false)
        setLookupStatus('idle')
        setLookupMessage('')
        setStreetSuggestions([])
    }, [contactId])

    const updateDraft = (field, value) => {
        setDraft((current) => ({ ...current, [field]: value }))
        if (field === 'postalCode' || field === 'countryCode') {
            setLookupStatus('idle')
            setLookupMessage('')
            setStreetSuggestions([])
        }
    }

    const updateCountry = (countryCode) => {
        const normalizedCountryCode = normalizeCountryCode(countryCode)
        const country = countryOptions.find((option) => option.code === normalizedCountryCode)?.name ?? ''
        setDraft((current) => ({ ...current, countryCode: normalizedCountryCode, country }))
        setLookupStatus('idle')
        setLookupMessage('')
        setStreetSuggestions([])
    }

    const lookupPostalCode = async () => {
        const countryCode = normalizeCountryCode(draft.countryCode)
        const postalCode = draft.postalCode.trim()

        if (!countryOptions.some((option) => option.code === countryCode) || !postalCode) {
            setLookupStatus('error')
            setLookupMessage('Enter a country code and postal code first.')
            return
        }

        setLookupStatus('loading')
        setLookupMessage('Looking up postal code...')
        setStreetSuggestions([])

        try {
            const [postalResult, nominatimResult] = await Promise.allSettled([
                lookupWithZippopotam(countryCode, postalCode),
                lookupWithNominatim({
                    streetAddress: draft.streetAddress,
                    postalCode,
                    countryCode,
                }),
            ])

            const postalData = postalResult.status === 'fulfilled' ? postalResult.value : null
            const rawNominatimData = nominatimResult.status === 'fulfilled' ? nominatimResult.value : []
            const requestedPostalCode = normalizePostalCode(postalCode)
            const nominatimData = rawNominatimData.filter((result) => {
                const resultAddress = result.address ?? {}
                const resultCountryCode = normalizeCountryCode(resultAddress.country_code)
                const resultPostalCode = normalizePostalCode(resultAddress.postcode)
                const matchesPostalCode = countryCode === 'CA' && requestedPostalCode.length === 3
                    ? resultPostalCode.startsWith(requestedPostalCode)
                    : resultPostalCode === requestedPostalCode || resultPostalCode.startsWith(requestedPostalCode)

                return resultCountryCode === countryCode && matchesPostalCode
            })
            const place = postalData?.places?.[0]
            const osmAddress = nominatimData[0]?.address ?? {}

            if (!place && !nominatimData.length) {
                throw new Error('Postal code not found. Check the country and try again.')
            }

            const suggestions = nominatimData
                .map((result) => {
                    const resultAddress = result.address ?? {}
                    const road = resultAddress.road
                        ?? resultAddress.pedestrian
                        ?? resultAddress.residential
                        ?? resultAddress.neighbourhood
                    const suggestedStreet = [resultAddress.house_number, road].filter(Boolean).join(' ')

                    if (!suggestedStreet) return null

                    return {
                        label: result.display_name,
                        streetAddress: suggestedStreet,
                        city: getCity(resultAddress),
                        provinceState: resultAddress.state ?? '',
                        country: resultAddress.country ?? '',
                    }
                })
                .filter((suggestion, index, allSuggestions) => (
                    suggestion
                    && allSuggestions.findIndex((item) => item?.streetAddress === suggestion.streetAddress) === index
                ))
                .slice(0, 2)

            const primarySuggestion = suggestions[0]

            setDraft((current) => ({
                ...current,
                streetAddress: primarySuggestion?.streetAddress ?? '',
                city: place?.['place name'] || primarySuggestion?.city || getCity(osmAddress) || '',
                provinceState: place?.state || primarySuggestion?.provinceState || osmAddress.state || '',
                country: postalData?.country || primarySuggestion?.country || osmAddress.country
                    || countryOptions.find((option) => option.code === countryCode)?.name
                    || '',
                countryCode,
            }))
            setStreetSuggestions(suggestions.slice(1))
            setLookupStatus('success')
            setLookupMessage(
                primarySuggestion
                    ? 'Street address, city, province/state and country were completed.'
                    : 'City, province/state and country were completed. Street address was cleared; enter it manually.',
            )
        } catch (error) {
            setDraft((current) => ({ ...current, streetAddress: '' }))
            setStreetSuggestions([])
            setLookupStatus('error')
            setLookupMessage(`${error.message} Street address was cleared; you can enter it manually.`)
        }
    }

    const saveAddress = (event) => {
        event.preventDefault()
        onSave({
            ...draft,
            countryCode: draft.countryCode.trim().toUpperCase(),
        })
        setIsEditing(false)
        setLookupStatus('idle')
        setLookupMessage('')
        setStreetSuggestions([])
    }

    const cancelEditing = () => {
        setDraft(createDraft(address))
        setIsEditing(false)
        setLookupStatus('idle')
        setLookupMessage('')
        setStreetSuggestions([])
    }

    return (
        <section className="contacts__address" aria-labelledby="contact-address-title">
            <div className="contacts__address-header">
                <div>
                    <span>Address</span>
                    <h3 id="contact-address-title">Contact location</h3>
                </div>
                {!isEditing && (
                    <button
                        className="contacts__address-edit"
                        type="button"
                        aria-label="Edit contact address"
                        onClick={() => {
                            setDraft(createDraft(address))
                            setIsEditing(true)
                        }}
                    >
                        <EditIcon />
                    </button>
                )}
            </div>

            {isEditing ? (
                <form className="contacts__address-form" onSubmit={saveAddress}>
                    <div className="contacts__postal-row">
                        <label className="contacts__country-code-field">
                            <span>Country code</span>
                            <select
                                aria-label="Country code"
                                className="contacts__country-select"
                                value={draft.countryCode}
                                onChange={(event) => updateCountry(event.target.value)}
                            >
                                {countryOptions.map((option) => (
                                    <option key={option.code} value={option.code}>
                                        {option.code} — {option.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span>Postal code</span>
                            <div className="contacts__postal-control">
                                <input
                                    placeholder="Enter postal code"
                                    value={draft.postalCode}
                                    onChange={(event) => updateDraft('postalCode', event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault()
                                            lookupPostalCode()
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    disabled={lookupStatus === 'loading'}
                                    aria-label="Find postal code"
                                    onClick={lookupPostalCode}
                                >
                                    <SearchIcon />
                                </button>
                            </div>
                        </label>
                    </div>

                    {lookupStatus !== 'idle' && (
                        <p className={`contacts__lookup-message contacts__lookup-message--${lookupStatus}`}>
                            {lookupStatus === 'loading' && <span aria-hidden="true" />}
                            {lookupMessage}
                        </p>
                    )}

                    <label>
                        <span>Street address</span>
                        <input
                            placeholder="Enter street address manually"
                            value={draft.streetAddress}
                            onChange={(event) => updateDraft('streetAddress', event.target.value)}
                        />
                    </label>

                    {streetSuggestions.length > 0 && (
                        <div className="contacts__street-suggestions">
                            <span>Alternative street address</span>
                            {streetSuggestions.map((suggestion) => (
                                <button
                                    type="button"
                                    key={suggestion.label}
                                    onClick={() => {
                                        setDraft((current) => ({
                                            ...current,
                                            streetAddress: suggestion.streetAddress,
                                            city: suggestion.city || current.city,
                                            provinceState: suggestion.provinceState || current.provinceState,
                                            country: suggestion.country || current.country,
                                        }))
                                        setStreetSuggestions([])
                                    }}
                                >
                                    <strong>{suggestion.streetAddress}</strong>
                                    <small>{suggestion.label}</small>
                                </button>
                            ))}
                        </div>
                    )}

                    <label>
                        <span>City</span>
                        <input value={draft.city} onChange={(event) => updateDraft('city', event.target.value)} />
                    </label>

                    <label>
                        <span>Province / State</span>
                        <input
                            value={draft.provinceState}
                            onChange={(event) => updateDraft('provinceState', event.target.value)}
                        />
                    </label>

                    <label>
                        <span>Country</span>
                        <input value={draft.country} onChange={(event) => updateDraft('country', event.target.value)} />
                    </label>

                    <div className="contacts__address-actions">
                        <button className="contacts__address-cancel" type="button" onClick={cancelEditing}>Cancel</button>
                        <button className="contacts__address-save" type="submit">
                            <SaveIcon />
                            Save address
                        </button>
                    </div>
                </form>
            ) : (
                <address className="contacts__address-summary">
                    <strong>{address.streetAddress || 'No street address'}</strong>
                    <span>
            {[address.city, address.provinceState, address.postalCode].filter(Boolean).join(', ') || 'No city or postal code'}
          </span>
                    <span>{address.country || 'No country'}</span>
                </address>
            )}
        </section>
    )
}
