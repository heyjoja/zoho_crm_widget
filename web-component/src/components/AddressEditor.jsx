import { useCallback, useEffect, useRef, useState } from 'react'

const postalCodeCache = new Map()
const addressSuggestionCache = new Map()
const reverseGeocodeCache = new Map()
let nextNominatimRequestAt = 0

const normalizeCountryCode = (value = '') => {
    const normalized = String(value).trim().toUpperCase()
    if (normalized === 'US' || normalized === 'USA' || normalized.includes('UNITED STATES')) return 'US'
    if (normalized === 'CA' || normalized === 'CAN' || normalized.includes('CANADA')) return 'CA'
    return normalized
}

/**
 * Maps a raw countryCode to one of the three supported selector values:
 * 'US', 'CA', or 'OTHER'.
 */
const toSelectorCountryCode = (value = '') => {
    const normalized = normalizeCountryCode(value)
    if (normalized === 'US') return 'US'
    if (normalized === 'CA') return 'CA'
    return 'OTHER'
}

const normalizePostalCode = (value = '') => String(value).replace(/[\s-]/g, '').toUpperCase()

const getCity = (address = {}) =>
    address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? ''

const createDraft = (address) => {
    const rawCode = address.countryCode ?? address.country ?? ''
    return {
        streetAddress: address.streetAddress ?? '',
        postalCode: address.postalCode ?? '',
        city: address.city ?? '',
        provinceState: address.provinceState ?? '',
        country: address.country ?? '',
        countryCode: toSelectorCountryCode(rawCode),
    }
}

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
        ...(countryCode && countryCode !== 'OTHER' ? { countrycodes: countryCode.toLowerCase() } : {}),
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
        countryCode: toSelectorCountryCode(normalizeCountryCode(a.country_code ?? '') || ''),
    }
}

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

const PencilIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
)

const CancelIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M18 6 6 18M6 6l12 12" />
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
    const reverseDebouncerRef = useRef(null)
    const abortControllerRef = useRef(null)

    // Search is only available for US and CA
    const isSupportedCountry = draft.countryCode === 'US' || draft.countryCode === 'CA'

    useEffect(() => { onEditingChange?.(isEditing) }, [isEditing, onEditingChange])

    useEffect(() => {
        setDraft(createDraft(address))
        setIsEditing(false)
        setLookupStatus('idle')
        setLookupMessage('')
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
                // Always replace all fields with what the marker found — no fallback to old values
                setDraft((current) => ({
                    ...current,
                    streetAddress: extracted.streetAddress,
                    city: extracted.city,
                    provinceState: extracted.provinceState,
                    postalCode: extracted.postalCode,
                    country: extracted.country,
                    countryCode: extracted.countryCode,
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
        if (field === 'postalCode' || field === 'countryCode' || field === 'country') {
            setLookupStatus('idle')
            setLookupMessage('')
        }
    }

    const handleCountryCodeChange = (value) => {
        updateDraft('countryCode', value)
        if (value === 'OTHER') {
            setLookupStatus('idle')
            setLookupMessage('')
        }
    }

    const performLookup = useCallback(async () => {
        if (!isSupportedCountry) return

        const { postalCode, countryCode } = draft
        const trimmedPostal = postalCode.trim()

        if (!trimmedPostal) {
            setLookupStatus('error')
            setLookupMessage('Please enter a postal code first.')
            return
        }

        if (abortControllerRef.current) abortControllerRef.current.abort()
        abortControllerRef.current = new AbortController()

        setLookupStatus('loading')
        setLookupMessage('Looking up postal code...')

        try {
            const lookupPromises = [
                lookupWithZippopotam(countryCode, trimmedPostal),
                lookupWithNominatim({ postalCode: trimmedPostal, countryCode }),
            ]

            const [postalResult, nominatimResult] = await Promise.allSettled(lookupPromises)

            if (abortControllerRef.current?.signal.aborted) return

            const postalData = postalResult.status === 'fulfilled' ? postalResult.value : null
            const rawNominatimData = nominatimResult.status === 'fulfilled' ? nominatimResult.value : []

            const requestedPostalCode = normalizePostalCode(trimmedPostal)
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
                throw new Error('Postal code not found. Please fill in the address manually.')
            }

            const previewCoords = nominatimData[0]
                ? [Number(nominatimData[0].lon), Number(nominatimData[0].lat)]
                : place?.longitude && place?.latitude
                    ? [Number(place.longitude), Number(place.latitude)]
                    : null

            if (previewCoords) onPreviewLocation?.(previewCoords)

            // Build street from Nominatim data
            const road = osmAddress.road ?? osmAddress.pedestrian ?? osmAddress.residential ?? osmAddress.neighbourhood ?? ''
            const streetAddress = [osmAddress.house_number, road].filter(Boolean).join(' ')

            // Always overwrite all address fields — never fall back to old values
            setDraft((current) => ({
                ...current,
                streetAddress,
                city: getCity(osmAddress) || place?.['place name'] || '',
                provinceState: osmAddress.state ?? place?.['state abbreviation'] ?? place?.state ?? '',
                country: osmAddress.country ?? (countryCode === 'US' ? 'United States' : 'Canada'),
            }))

            setLookupStatus('success')
            setLookupMessage('Address details filled in.')
        } catch (err) {
            if (!abortControllerRef.current?.signal.aborted) {
                setLookupStatus('error')
                setLookupMessage(err.message ?? 'Lookup failed.')
            }
        }
    }, [draft, isSupportedCountry, onPreviewLocation])

    const handleSave = () => {
        onSave?.({ ...draft })
        setIsEditing(false)
        setLookupStatus('idle')
        setLookupMessage('')
    }

    const handleCancel = () => {
        setDraft(createDraft(address))
        setIsEditing(false)
        setLookupStatus('idle')
        setLookupMessage('')
    }

    if (!isEditing) {
        const displayParts = [
            address.streetAddress,
            address.city,
            address.provinceState,
            address.postalCode,
            address.country,
        ].filter(Boolean)
        return (
            <div className="contacts__detail-field">
                <dt>Address</dt>
                <dd>
                    <div className="contacts__field-value">
                        <span>{displayParts.join(', ') || '—'}</span>
                        <button
                            className="contacts__field-edit"
                            type="button"
                            aria-label="Edit address"
                            onClick={() => setIsEditing(true)}
                        >
                            <PencilIcon />
                        </button>
                    </div>
                </dd>
            </div>
        )
    }

    return (
        <div className="contacts__detail-field contacts__detail-field--editing">
            <dt>Address</dt>
            <dd>
                {isEditing && (
                    <form className="address-editor__form" onSubmit={(e) => e.preventDefault()}>

                        {/* ── Postal Code + Country + Search button (TOP of form) ── */}
                        <div className="address-editor__row address-editor__row--inline">
                            <div className="address-editor__field address-editor__field--postal">
                                <label htmlFor="postalCode">Postal Code</label>
                                <input
                                    id="postalCode"
                                    type="text"
                                    value={draft.postalCode}
                                    onChange={(e) => updateDraft('postalCode', e.target.value)}
                                    placeholder="Postal code"
                                />
                            </div>

                            <div className="address-editor__field address-editor__field--country-code">
                                <label htmlFor="countryCode">Country</label>
                                <select
                                    id="countryCode"
                                    value={draft.countryCode}
                                    onChange={(e) => handleCountryCodeChange(e.target.value)}
                                >
                                    <option value="US">US</option>
                                    <option value="CA">CA</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>

                            {isSupportedCountry && (
                                <button
                                    type="button"
                                    className="address-editor__search-btn"
                                    onClick={performLookup}
                                    aria-label="Search postal code"
                                    disabled={lookupStatus === 'loading'}
                                >
                                    <SearchIcon />
                                </button>
                            )}
                        </div>

                        {/* Lookup status message */}
                        {lookupMessage && (
                            <p className={`address-editor__lookup-msg address-editor__lookup-msg--${lookupStatus}`}>
                                {lookupMessage}
                            </p>
                        )}

                        {/* ── Rest of the address fields ── */}
                        <div className="address-editor__field">
                            <label htmlFor="streetAddress">Street Address</label>
                            <input
                                id="streetAddress"
                                type="text"
                                value={draft.streetAddress}
                                onChange={(e) => updateDraft('streetAddress', e.target.value)}
                                placeholder="Street address"
                            />
                        </div>

                        <div className="address-editor__row address-editor__row--inline">
                            <div className="address-editor__field">
                                <label htmlFor="city">City</label>
                                <input
                                    id="city"
                                    type="text"
                                    value={draft.city}
                                    onChange={(e) => updateDraft('city', e.target.value)}
                                    placeholder="City"
                                />
                            </div>

                            <div className="address-editor__field">
                                <label htmlFor="provinceState">State / Province</label>
                                <input
                                    id="provinceState"
                                    type="text"
                                    value={draft.provinceState}
                                    onChange={(e) => updateDraft('provinceState', e.target.value)}
                                    placeholder="State / Province"
                                />
                            </div>
                        </div>

                        <div className="address-editor__field">
                            <label htmlFor="country">Country Name</label>
                            <input
                                id="country"
                                type="text"
                                value={draft.country}
                                onChange={(e) => updateDraft('country', e.target.value)}
                                placeholder="Country name"
                            />
                        </div>

                        {/* ── Form actions ── */}
                        <div className="address-editor__actions">
                            <button type="button" className="address-editor__btn address-editor__btn--save" onClick={handleSave}>
                                <SaveIcon /> Save
                            </button>
                            <button type="button" className="address-editor__btn address-editor__btn--cancel" onClick={handleCancel}>
                                <CancelIcon /> Cancel
                            </button>
                        </div>
                    </form>
                )}
            </dd>
        </div>
    )
}