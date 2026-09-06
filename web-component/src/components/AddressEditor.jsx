import { useCallback, useEffect, useRef, useState } from 'react'

const postalCodeCache = new Map()
const addressSuggestionCache = new Map()
const reverseGeocodeCache = new Map()
let nextNominatimRequestAt = 0

const countryOptions = [
    { code: 'CA', name: 'Canada' },
    { code: 'US', name: 'United States' },
]

const MIN_POSTAL_CODE_LENGTH = { US: 5, CA: 3 }

const normalizeCountryCode = (value = '') => {
    const normalized = String(value).trim().toUpperCase()
    if (normalized === 'US' || normalized === 'USA' || normalized.includes('UNITED STATES')) return 'US'
    if (normalized === 'CA' || normalized === 'CAN' || normalized.includes('CANADA')) return 'CA'
    return ''
}

const normalizePostalCode = (value = '') => String(value).replace(/[\s-]/g, '').toUpperCase()

const getCity = (address = {}) =>
    address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? ''

const createDraft = (address) => ({
    streetAddress: address.streetAddress ?? '',
    postalCode: address.postalCode ?? '',
    city: address.city ?? '',
    provinceState: address.provinceState ?? '',
    country: address.country ?? '',
    countryCode: normalizeCountryCode(address.countryCode ?? address.country) || 'US',
})

const nominatimFetch = async (url) => {
    const delay = Math.max(0, nextNominatimRequestAt - Date.now())
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    nextNominatimRequestAt = Date.now() + 1000
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('Address service unavailable.')
    return response.json()
}

const lookupWithZippopotam = async (countryCode, postalCode) => {
    const requestPostalCode = countryCode === 'CA'
        ? postalCode.replace(/\s+/g, '').slice(0, 3)
        : postalCode
    const cacheKey = `${countryCode}:${requestPostalCode.toUpperCase()}`
    const cached = postalCodeCache.get(cacheKey)
    if (cached) return cached
    const response = await fetch(
        `https://api.zippopotam.us/${encodeURIComponent(countryCode)}/${encodeURIComponent(requestPostalCode)}`,
    )
    if (!response.ok) throw new Error('Postal code not found.')
    const result = await response.json()
    postalCodeCache.set(cacheKey, result)
    return result
}

const lookupWithNominatim = async ({ postalCode, countryCode }) => {
    const cacheKey = [countryCode, postalCode].join(':').toLowerCase()
    const cached = addressSuggestionCache.get(cacheKey)
    if (cached) return cached
    const query = new URLSearchParams({
        postalcode: postalCode,
        format: 'jsonv2',
        addressdetails: '1',
        limit: '2',
        countrycodes: countryCode.toLowerCase(),
    })
    const result = await nominatimFetch(`https://nominatim.openstreetmap.org/search?${query}`)
    addressSuggestionCache.set(cacheKey, result)
    return result
}

const reverseGeocode = async ([lng, lat]) => {
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`
    const cached = reverseGeocodeCache.get(cacheKey)
    if (cached) return cached
    const query = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: 'jsonv2',
        addressdetails: '1',
    })
    const result = await nominatimFetch(`https://nominatim.openstreetmap.org/reverse?${query}`)
    reverseGeocodeCache.set(cacheKey, result)
    return result
}

const extractAddressFromNominatim = (result) => {
    if (!result?.address) return null
    const a = result.address
    const road = a.road ?? a.pedestrian ?? a.residential ?? a.neighbourhood ?? ''
    return {
        streetAddress: [a.house_number, road].filter(Boolean).join(' '),
        city: getCity(a),
        provinceState: a.state ?? '',
        postalCode: a.postcode ?? '',
        country: a.country ?? '',
        countryCode: normalizeCountryCode(a.country_code ?? '') || '',
    }
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

export default function AddressEditor({
                                          contactId,
                                          address,
                                          onSave,
                                          onPreviewLocation,
                                          onEditingChange,
                                          draggedCoordinates,
                                      }) {
    const [isEditing, setIsEditing] = useState(false)
    const [draft, setDraft] = useState(() => createDraft(address))
    const [lookupStatus, setLookupStatus] = useState('idle')
    const [lookupMessage, setLookupMessage] = useState('')
    const [streetSuggestions, setStreetSuggestions] = useState([])
    const debounceTimerRef = useRef(null)
    const reverseDebouncerRef = useRef(null)
    const abortControllerRef = useRef(null)

    useEffect(() => { onEditingChange?.(isEditing) }, [isEditing, onEditingChange])

    useEffect(() => {
        setDraft(createDraft(address))
        setIsEditing(false)
        setLookupStatus('idle')
        setLookupMessage('')
        setStreetSuggestions([])
    }, [contactId])

    useEffect(() => {
        if (!draggedCoordinates || !isEditing) return
        clearTimeout(reverseDebouncerRef.current)
        reverseDebouncerRef.current = setTimeout(async () => {
            setLookupStatus('loading')
            setLookupMessage('Detecting address from pin position...')
            try {
                const result = await reverseGeocode(draggedCoordinates)
                const extracted = extractAddressFromNominatim(result)
                if (!extracted) throw new Error('No address found at this location.')
                setDraft((current) => ({
                    ...current,
                    streetAddress: extracted.streetAddress || current.streetAddress,
                    city: extracted.city || current.city,
                    provinceState: extracted.provinceState || current.provinceState,
                    postalCode: extracted.postalCode || current.postalCode,
                    country: extracted.country || current.country,
                    countryCode: extracted.countryCode || current.countryCode,
                }))
                setLookupStatus('success')
                setLookupMessage('Address updated from pin position.')
            } catch {
                setLookupStatus('error')
                setLookupMessage('Could not detect address at this location.')
            }
        }, 600)
        return () => clearTimeout(reverseDebouncerRef.current)
    }, [draggedCoordinates, isEditing])

    const updateDraft = (field, value) => {
        setDraft((current) => ({ ...current, [field]: value }))
        if (field === 'postalCode' || field === 'countryCode') {
            setLookupStatus('idle')
            setLookupMessage('')
            setStreetSuggestions([])
        }
    }

    const updateCountry = (countryCode) => {
        const normalizedCode = normalizeCountryCode(countryCode)
        const country = countryOptions.find((o) => o.code === normalizedCode)?.name ?? ''
        setDraft((current) => ({ ...current, countryCode: normalizedCode, country }))
        setLookupStatus('idle')
        setLookupMessage('')
        setStreetSuggestions([])
    }

    const performLookup = useCallback(async (countryCode, postalCode) => {
        if (!countryOptions.some((o) => o.code === countryCode) || !postalCode) return
        if (abortControllerRef.current) abortControllerRef.current.abort()
        abortControllerRef.current = new AbortController()

        setLookupStatus('loading')
        setLookupMessage('Looking up postal code...')
        setStreetSuggestions([])

        try {
            const [postalResult, nominatimResult] = await Promise.allSettled([
                lookupWithZippopotam(countryCode, postalCode),
                lookupWithNominatim({ postalCode, countryCode }),
            ])

            if (abortControllerRef.current?.signal.aborted) return

            const postalData = postalResult.status === 'fulfilled' ? postalResult.value : null
            const rawNominatimData = nominatimResult.status === 'fulfilled' ? nominatimResult.value : []
            const requestedPostalCode = normalizePostalCode(postalCode)

            const nominatimData = rawNominatimData.filter((result) => {
                const ra = result.address ?? {}
                const rcc = normalizeCountryCode(ra.country_code)
                const rpc = normalizePostalCode(ra.postcode)
                const match = countryCode === 'CA' && requestedPostalCode.length === 3
                    ? rpc.startsWith(requestedPostalCode)
                    : rpc === requestedPostalCode || rpc.startsWith(requestedPostalCode)
                return rcc === countryCode && match
            })

            const place = postalData?.places?.[0]
            const osmAddress = nominatimData[0]?.address ?? {}

            if (!place && !nominatimData.length) {
                throw new Error('Postal code not found. Check the country and try again.')
            }

            const previewCoords = nominatimData[0]
                ? [Number(nominatimData[0].lon), Number(nominatimData[0].lat)]
                : place?.longitude && place?.latitude
                    ? [Number(place.longitude), Number(place.latitude)]
                    : null

            let reverseStreet = ''
            if (previewCoords) {
                try {
                    const rev = await reverseGeocode(previewCoords)
                    reverseStreet = extractAddressFromNominatim(rev)?.streetAddress ?? ''
                } catch { /* non-critical */ }
            }

            if (previewCoords) onPreviewLocation?.(previewCoords)

            const suggestions = nominatimData
                .map((result) => {
                    const ra = result.address ?? {}
                    const road = ra.road ?? ra.pedestrian ?? ra.residential ?? ra.neighbourhood
                    const suggestedStreet = [ra.house_number, road].filter(Boolean).join(' ')
                    if (!suggestedStreet) return null
                    return {
                        label: result.display_name,
                        streetAddress: suggestedStreet,
                        city: getCity(ra),
                        provinceState: ra.state ?? '',
                        country: ra.country ?? '',
                    }
                })
                .filter((s, i, all) => s && all.findIndex((x) => x?.streetAddress === s.streetAddress) === i)
                .slice(0, 2)

            const resolvedStreet = reverseStreet || suggestions[0]?.streetAddress || ''

            setDraft((current) => ({
                ...current,
                streetAddress: resolvedStreet,
                city: place?.['place name'] || suggestions[0]?.city || getCity(osmAddress) || current.city,
                provinceState: place?.state || suggestions[0]?.provinceState || osmAddress.state || current.provinceState,
                country: postalData?.country || suggestions[0]?.country || osmAddress.country
                    || countryOptions.find((o) => o.code === countryCode)?.name || current.country,
                countryCode,
            }))

            setStreetSuggestions(suggestions.slice(1))
            setLookupStatus('success')
            setLookupMessage(
                resolvedStreet
                    ? 'Street address, city, province/state and country were completed.'
                    : 'City, province/state and country were completed. Enter street address manually.',
            )
        } catch (error) {
            if (abortControllerRef.current?.signal.aborted) return
            setDraft((current) => ({ ...current, streetAddress: '' }))
            setStreetSuggestions([])
            setLookupStatus('error')
            setLookupMessage(`${error.message} Street address was cleared — enter it manually.`)
        }
    }, [onPreviewLocation])

    useEffect(() => {
        if (!isEditing) return
        const countryCode = normalizeCountryCode(draft.countryCode)
        const postalCode = draft.postalCode.trim()
        const minLength = MIN_POSTAL_CODE_LENGTH[countryCode] ?? 5
        if (!postalCode || postalCode.length < minLength) {
            clearTimeout(debounceTimerRef.current)
            return
        }
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = setTimeout(() => performLookup(countryCode, postalCode), 600)
        return () => clearTimeout(debounceTimerRef.current)
    }, [draft.postalCode, draft.countryCode, isEditing, performLookup])

    const lookupPostalCode = () => {
        clearTimeout(debounceTimerRef.current)
        const countryCode = normalizeCountryCode(draft.countryCode)
        const postalCode = draft.postalCode.trim()
        if (!countryOptions.some((o) => o.code === countryCode) || !postalCode) {
            setLookupStatus('error')
            setLookupMessage('Enter a country code and postal code first.')
            return
        }
        performLookup(countryCode, postalCode)
    }

    const saveAddress = (event) => {
        event.preventDefault()
        clearTimeout(debounceTimerRef.current)
        clearTimeout(reverseDebouncerRef.current)
        onSave({ ...draft, countryCode: draft.countryCode.trim().toUpperCase() })
        setIsEditing(false)
        setLookupStatus('idle')
        setLookupMessage('')
        setStreetSuggestions([])
    }

    const cancelEditing = () => {
        clearTimeout(debounceTimerRef.current)
        clearTimeout(reverseDebouncerRef.current)
        if (abortControllerRef.current) abortControllerRef.current.abort()
        onPreviewLocation?.(null)
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
                        onClick={() => { setDraft(createDraft(address)); setIsEditing(true) }}
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
                                        if (event.key === 'Enter') { event.preventDefault(); lookupPostalCode() }
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
                        <input
                            value={draft.city}
                            onChange={(event) => updateDraft('city', event.target.value)}
                        />
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
                        <input
                            value={draft.country}
                            onChange={(event) => updateDraft('country', event.target.value)}
                        />
                    </label>

                    <div className="contacts__address-actions">
                        <button className="contacts__address-cancel" type="button" onClick={cancelEditing}>
                            Cancel
                        </button>
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