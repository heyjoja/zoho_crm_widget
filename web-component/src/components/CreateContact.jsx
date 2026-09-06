import { useState } from 'react'
import { createPortal } from 'react-dom'
import AddressEditor from './AddressEditor.jsx'
import ContactMap from './ContactMap.jsx'
import { createContact } from '../utils/zohoSDK.js'
import { useLanguage } from '../language/LanguageContext.jsx'

// Field definitions — labels resolved from translations at render time
const FIELD_DEFS = [
    { key: 'firstName', tKey: 'firstName', type: 'text'  },
    { key: 'lastName',  tKey: 'lastName',  type: 'text'  },
    { key: 'phone',     tKey: 'phone',     type: 'tel'   },
    { key: 'email',     tKey: 'email',     type: 'email' },
]

const emptyAddress = {
    streetAddress: '',
    postalCode: '',
    city: '',
    provinceState: '',
    country: '',
}

// Status values: 'idle' | 'saving' | 'success' | 'error'

export default function CreateContact({ onClose, onCreated }) {
    const { t } = useLanguage()

    // Translated field list — re-derived on every render so language changes apply immediately
    const contactFields = FIELD_DEFS.map((f) => ({ ...f, label: t[f.tKey] ?? f.tKey }))

    const [formValues, setFormValues] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
    })

    // Address & map state
    const [address, setAddress] = useState(emptyAddress)
    const [location, setLocation] = useState('')
    const [coordinates, setCoordinates] = useState(null)
    const [previewCoordinates, setPreviewCoordinates] = useState(null)
    const [draggedCoordinates, setDraggedCoordinates] = useState(null)
    const [isAddressEditing, setIsAddressEditing] = useState(false)

    // Save state
    const [saveStatus, setSaveStatus] = useState('idle')
    const [saveError, setSaveError] = useState('')

    const isSaving = saveStatus === 'saving'

    const handleFieldChange = (key, value) => {
        setFormValues((prev) => ({ ...prev, [key]: value }))
    }

    const handleMarkerDrag = (coords) => {
        setPreviewCoordinates(coords)
        setDraggedCoordinates(coords)
    }

    const handleAddressSave = (savedAddress) => {
        const coordsToSave = previewCoordinates
        setPreviewCoordinates(null)
        setDraggedCoordinates(null)
        setIsAddressEditing(false)

        const builtLocation = [
            savedAddress.streetAddress,
            savedAddress.city,
            savedAddress.provinceState,
            savedAddress.postalCode,
            savedAddress.country,
        ].filter(Boolean).join(', ')

        setAddress(savedAddress)
        setLocation(builtLocation)
        if (coordsToSave) {
            setCoordinates(coordsToSave)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formValues.firstName.trim() || !formValues.lastName.trim()) {
            setSaveStatus('error')
            setSaveError(t.firstLastNameRequired ?? 'First name and last name are required.')
            return
        }

        setSaveStatus('saving')
        setSaveError('')

        try {
            const result = await createContact({
                firstName: formValues.firstName.trim(),
                lastName: formValues.lastName.trim(),
                phone: formValues.phone.trim(),
                email: formValues.email.trim(),
                streetAddress: address.streetAddress,
                city: address.city,
                provinceState: address.provinceState,
                postalCode: address.postalCode,
                country: address.country,
                coordinatesLng: coordinates?.[0] ?? null,
                coordinatesLat: coordinates?.[1] ?? null,
            })

            setSaveStatus('success')
            onCreated?.(result)

            // Close the modal after a short delay so the user can see the success message
            setTimeout(() => onClose(), 1800)
        } catch (err) {
            console.error('[CreateContact] Failed to create contact:', err)
            setSaveStatus('error')
            setSaveError(err.message ?? 'An unexpected error occurred.')
        }
    }

    return createPortal(
        <>
            {/* ── Backdrop ───────────────────────────────────────────────── */}
            <div
                className="create-contact__backdrop"
                aria-hidden="true"
                onClick={isSaving ? undefined : onClose}
            />

            {/* ── Modal ──────────────────────────────────────────────────── */}
            <div
                className="create-contact__modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-contact-title"
            >
                {/* Header */}
                <div className="create-contact__header">
                    <h2 id="create-contact-title" className="create-contact__title">
                        {t.addContact ?? 'Add contact'}
                    </h2>
                    <button
                        className="create-contact__close"
                        type="button"
                        aria-label={t.cancel ?? 'Close'}
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        ×
                    </button>
                </div>

                {/* ── Save feedback banner ───────────────────────────────── */}
                {saveStatus === 'success' && (
                    <div className="create-contact__banner create-contact__banner--success" role="status">
                        ✅ {t.contactSavedSuccess ?? 'Contact saved successfully!'}
                    </div>
                )}
                {saveStatus === 'error' && (
                    <div className="create-contact__banner create-contact__banner--error" role="alert">
                        ⚠️ {saveError}
                    </div>
                )}

                {/* Scrollable body */}
                <div className="create-contact__body">
                    <form id="create-contact-form" className="create-contact__form" onSubmit={handleSubmit}>
                        {/* ── Basic fields ───────────────────────────────── */}
                        <div className="create-contact__fields">
                            {contactFields.map((field) => (
                                <div className="create-contact__field" key={field.key}>
                                    <label
                                        className="create-contact__label"
                                        htmlFor={`create-contact-${field.key}`}
                                    >
                                        {field.label}
                                    </label>
                                    <input
                                        className="create-contact__input"
                                        id={`create-contact-${field.key}`}
                                        type={field.type}
                                        placeholder={field.label}
                                        value={formValues[field.key]}
                                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                        disabled={isSaving}
                                    />
                                </div>
                            ))}
                        </div>
                    </form>

                    {/* ── Address editor ─────────────────────────────────── */}
                    <AddressEditor
                        contactId="new"
                        address={address}
                        onEditingChange={setIsAddressEditing}
                        onPreviewLocation={setPreviewCoordinates}
                        draggedCoordinates={draggedCoordinates}
                        onSave={handleAddressSave}
                    />

                    {/* ── Map ────────────────────────────────────────────── */}
                    <ContactMap
                        location={location}
                        savedCoordinates={coordinates}
                        previewCoordinates={previewCoordinates}
                        onMarkerDrag={isAddressEditing ? handleMarkerDrag : undefined}
                    />
                </div>

                {/* ── Sticky footer actions ──────────────────────────────── */}
                <div className="create-contact__footer">
                    <button
                        className="create-contact__btn-cancel"
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        {t.cancel ?? 'Cancel'}
                    </button>
                    <button
                        className="create-contact__btn-save"
                        type="submit"
                        form="create-contact-form"
                        disabled={isSaving}
                    >
                        {isSaving ? (t.saving ?? 'Saving…') : (t.save ?? 'Save')}
                    </button>
                </div>
            </div>
        </>,
        document.body
    )
}