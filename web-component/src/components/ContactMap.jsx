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

const geocodeCache = new Map()
let nextRequestAt = 0

const geocodeLocation = async (location, signal) => {
    const normalizedLocation = location.trim().toLowerCase()
    const cachedCoordinates = geocodeCache.get(normalizedLocation)

    if (cachedCoordinates) return cachedCoordinates

    const delay = Math.max(0, nextRequestAt - Date.now())
    if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
    }

    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError')
    nextRequestAt = Date.now() + 1000

    const query = new URLSearchParams({
        q: location,
        format: 'jsonv2',
        limit: '1',
    })
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

export default function ContactMap({ location }) {
    const mapContainer = useRef(null)
    const [coordinates, setCoordinates] = useState(null)
    const [mapStatus, setMapStatus] = useState('idle')
    const [mapError, setMapError] = useState('')

    useEffect(() => {
        const address = location?.trim()
        if (!address) {
            setCoordinates(null)
            setMapStatus('empty')
            return undefined
        }

        const controller = new AbortController()
        setCoordinates(null)
        setMapError('')
        setMapStatus('loading')

        geocodeLocation(address, controller.signal)
            .then((result) => {
                setCoordinates(result)
                setMapStatus('ready')
            })
            .catch((error) => {
                if (error.name === 'AbortError') return
                setMapError(error.message)
                setMapStatus('error')
            })

        return () => controller.abort()
    }, [location])

    useEffect(() => {
        if (!mapContainer.current || mapStatus !== 'ready' || !coordinates) return undefined

        const [longitude, latitude] = coordinates

        const map = new MapLibreMap({
            container: mapContainer.current,
            style: openStreetMapStyle,
            center: [longitude, latitude],
            zoom: 11,
            cooperativeGestures: true,
            attributionControl: { compact: false },
        })

        map.addControl(
            new NavigationControl({ showCompass: false }),
            'top-right',
        )

        new Marker({ color: '#0A4F7C' })
            .setLngLat([longitude, latitude])
            .setPopup(new Popup({ offset: 24 }).setText(location))
            .addTo(map)

        return () => map.remove()
    }, [coordinates, location, mapStatus])

    return (
        <section className="contacts__map-card" aria-label="Contact location map">
            <div className="contacts__map-header">
                <div>
                    <span>Location</span>
                    <h3>Contact map</h3>
                </div>
                {coordinates && (
                    <small>{coordinates[1].toFixed(4)}, {coordinates[0].toFixed(4)}</small>
                )}
            </div>

            {mapStatus === 'ready' && coordinates ? (
                <div className="contacts__map" ref={mapContainer} />
            ) : (
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
