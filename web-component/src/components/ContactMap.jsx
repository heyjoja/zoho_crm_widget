import { useEffect, useRef, useState } from 'react'
import {
    Map as MapLibreMap,
    Marker,
    NavigationControl,
    Popup,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const openStreetMapStyle = {
    version: 8,
    sources: {
        openStreetMap: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
        },
    },
    layers: [
        {
            id: 'openStreetMap',
            type: 'raster',
            source: 'openStreetMap',
        },
    ],
}

const BUILDING_ZOOM = 17

const geocodeCache = new Map()
let nextRequestAt = 0

const geocodeLocation = async (location, signal) => {
    const normalizedLocation = location.trim().toLowerCase()
    const cached = geocodeCache.get(normalizedLocation)
    if (cached) return cached

    const delay = Math.max(0, nextRequestAt - Date.now())
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))

    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError')
    nextRequestAt = Date.now() + 1000

    const query = new URLSearchParams({ q: location, format: 'jsonv2', limit: '1' })
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
        headers: { Accept: 'application/json' },
        signal,
    })
    if (!response.ok) throw new Error('The location service is unavailable.')

    const [result] = await response.json()
    if (!result) throw new Error('No map result was found for this address.')

    const coordinates = [Number(result.lon), Number(result.lat)]
    geocodeCache.set(normalizedLocation, coordinates)
    return coordinates
}

const createMap = (container, [lng, lat], location) => {
    const map = new MapLibreMap({
        container,
        style: openStreetMapStyle,
        center: [lng, lat],
        zoom: BUILDING_ZOOM,
        cooperativeGestures: true,
        attributionControl: { compact: false },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

    const marker = new Marker({ color: '#0A4F7C', draggable: false })
        .setLngLat([lng, lat])
        .setPopup(new Popup({ offset: 24 }).setText(location ?? ''))
        .addTo(map)

    return { map, marker }
}

// onMarkerDrag: ([lng, lat]) => void  — provided only when address editor is open
export default function ContactMap({ location, previewCoordinates, onMarkerDrag }) {
    const mapContainer = useRef(null)
    const mapRef = useRef(null)
    const markerRef = useRef(null)
    const [savedCoordinates, setSavedCoordinates] = useState(null)
    const [mapStatus, setMapStatus] = useState('idle')
    const [mapError, setMapError] = useState('')

    // ── Step 1: geocode saved location string ─────────────────────────────────
    useEffect(() => {
        const address = location?.trim()
        if (!address) {
            setSavedCoordinates(null)
            setMapStatus('empty')
            return
        }

        const controller = new AbortController()
        setSavedCoordinates(null)
        setMapError('')
        setMapStatus('loading')

        geocodeLocation(address, controller.signal)
            .then((coords) => {
                setSavedCoordinates(coords)
                setMapStatus('ready')
            })
            .catch((error) => {
                if (error.name === 'AbortError') return
                setMapError(error.message)
                setMapStatus('error')
            })

        return () => controller.abort()
    }, [location])

    // ── Step 2: create the map once saved coordinates are available ───────────
    useEffect(() => {
        if (!mapContainer.current || !savedCoordinates || mapRef.current) return

        const { map, marker } = createMap(mapContainer.current, savedCoordinates, location)
        mapRef.current = map
        markerRef.current = marker

        return () => {
            map.remove()
            mapRef.current = null
            markerRef.current = null
        }
    }, [savedCoordinates]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Step 3: sync draggable + dragend listener with edit mode ──────────────
    useEffect(() => {
        const marker = markerRef.current
        if (!marker) return

        if (onMarkerDrag) {
            marker.setDraggable(true)
            marker.off('dragend', marker._dragendHandler)
            marker._dragendHandler = () => {
                const { lng, lat } = marker.getLngLat()
                onMarkerDrag([lng, lat])
            }
            marker.on('dragend', marker._dragendHandler)
        } else {
            marker.setDraggable(false)
            if (marker._dragendHandler) {
                marker.off('dragend', marker._dragendHandler)
                delete marker._dragendHandler
            }
        }
    }, [onMarkerDrag])

    // ── Step 4: react to previewCoordinates (postal code lookup OR drag) ──────
    useEffect(() => {
        if (!previewCoordinates) return

        const [lng, lat] = previewCoordinates

        // No map yet (contact had no saved location) — build it now
        if (!mapRef.current && mapContainer.current) {
            const { map, marker } = createMap(mapContainer.current, [lng, lat], 'Preview')
            mapRef.current = map
            markerRef.current = marker

            if (onMarkerDrag) {
                marker.setDraggable(true)
                marker._dragendHandler = () => {
                    const pos = marker.getLngLat()
                    onMarkerDrag([pos.lng, pos.lat])
                }
                marker.on('dragend', marker._dragendHandler)
            }
            return
        }

        // Map exists — move marker and fly to building level
        if (mapRef.current) {
            markerRef.current?.setLngLat([lng, lat])
            mapRef.current.flyTo({ center: [lng, lat], zoom: BUILDING_ZOOM, duration: 1800, essential: true })
        }
    }, [previewCoordinates]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Step 5: when preview is cleared (cancel), fly back to saved location ──
    useEffect(() => {
        if (previewCoordinates || !savedCoordinates || !mapRef.current) return

        const [lng, lat] = savedCoordinates
        markerRef.current?.setLngLat([lng, lat])
        mapRef.current.flyTo({ center: [lng, lat], zoom: BUILDING_ZOOM, duration: 1800, essential: true })
    }, [previewCoordinates, savedCoordinates])

    const displayCoordinates = previewCoordinates ?? savedCoordinates
    const showMap = displayCoordinates !== null && (mapStatus === 'ready' || previewCoordinates !== null)

    return (
        <section className="contacts__map-card" aria-label="Contact location map">
            <div className="contacts__map-header">
                <div>
                    <span>Location</span>
                    <h3>Contact map</h3>
                </div>
                {displayCoordinates && (
                    <small>
                        {displayCoordinates[1].toFixed(4)}, {displayCoordinates[0].toFixed(4)}
                        {previewCoordinates && <em> — preview</em>}
                    </small>
                )}
            </div>

            {/* Always mounted so MapLibre always has a DOM node to attach to */}
            <div
                className="contacts__map"
                ref={mapContainer}
                style={{ display: showMap ? undefined : 'none' }}
            />

            {!showMap && (
                <div className={`contacts__map-state contacts__map-state--${mapStatus}`}>
                    {mapStatus === 'loading' && <span className="contacts__map-loader" aria-hidden="true" />}
                    <p>
                        {mapStatus === 'loading' && 'Finding this address on the map...'}
                        {mapStatus === 'error' && mapError}
                        {mapStatus === 'empty' && 'Add a location to display this contact on the map.'}
                    </p>
                </div>
            )}
        </section>
    )
}