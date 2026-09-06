import { useEffect, useState } from 'react'
import AddressEditor from './AddressEditor.jsx'
import ContactMap from './ContactMap.jsx'

const getInitials = ({ firstName, lastName }) => (
    `${firstName.charAt(0)}${lastName.charAt(0)}`
)

const fields = [
    { key: 'firstName', label: 'First name', type: 'text' },
    { key: 'lastName', label: 'Last name', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'email', label: 'Email', type: 'email' },
]

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

const CancelIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M18 6 6 18M6 6l12 12" />
    </svg>
)

const renderValue = (contact, field) => {
    const value = contact[field.key]
    if (field.key === 'phone') return <a href={`tel:${value}`}>{value}</a>
    if (field.key === 'email') return <a href={`mailto:${value}`}>{value}</a>
    return value
}

export default function DetailContact({ contact, onUpdate, onClose }) {
    const [editingField, setEditingField] = useState(null)
    const [draftValue, setDraftValue] = useState('')
    const [previewCoordinates, setPreviewCoordinates] = useState(null)
    const [draggedCoordinates, setDraggedCoordinates] = useState(null)
    const [isAddressEditing, setIsAddressEditing] = useState(false)

    useEffect(() => {
        setEditingField(null)
        setDraftValue('')
        setPreviewCoordinates(null)
        setDraggedCoordinates(null)
        setIsAddressEditing(false)
    }, [contact?.id])

    if (!contact) return null

    const startEditing = (field) => {
        setEditingField(field.key)
        setDraftValue(contact[field.key] ?? '')
    }

    const saveField = () => {
        if (!editingField) return
        onUpdate({ ...contact, [editingField]: draftValue.trim() })
        setEditingField(null)
        setDraftValue('')
    }

    const cancelEditing = () => {
        setEditingField(null)
        setDraftValue('')
    }

    const handleMarkerDrag = (coords) => {
        setPreviewCoordinates(coords)
        setDraggedCoordinates(coords)
    }

    return (
        <aside className="contacts__details" aria-label="Contact details">
            <div className="contacts__details-header">
                <span className="contacts__details-avatar">{getInitials(contact)}</span>
                <div>
                    <span className="contacts__details-label">Contact profile</span>
                    <h2>{contact.firstName} {contact.lastName}</h2>
                    <p>Contact #{contact.id}</p>
                </div>
                <button
                    className="contacts__details-close"
                    type="button"
                    aria-label="Close contact details"
                    onClick={() => { cancelEditing(); onClose() }}
                >
                    ×
                </button>
            </div>

            <dl className="contacts__details-list">
                {fields.map((field) => {
                    const isEditing = editingField === field.key
                    return (
                        <div
                            className={isEditing ? 'contacts__detail-field contacts__detail-field--editing' : 'contacts__detail-field'}
                            key={field.key}
                        >
                            <dt>{field.label}</dt>
                            <dd>
                                {isEditing ? (
                                    <form
                                        className="contacts__field-editor"
                                        onSubmit={(event) => { event.preventDefault(); saveField() }}
                                    >
                                        <input
                                            autoFocus
                                            type={field.type}
                                            value={draftValue}
                                            aria-label={`Edit ${field.label}`}
                                            onChange={(event) => setDraftValue(event.target.value)}
                                            onKeyDown={(event) => { if (event.key === 'Escape') cancelEditing() }}
                                        />
                                        <div className="contacts__field-editor-actions">
                                            <button
                                                className="contacts__field-cancel"
                                                type="button"
                                                aria-label={`Cancel editing ${field.label}`}
                                                onClick={cancelEditing}
                                            >
                                                <CancelIcon />
                                            </button>
                                            <button className="contacts__field-save" type="submit" aria-label={`Save ${field.label}`}>
                                                <SaveIcon />
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="contacts__field-value">
                                        <span>{renderValue(contact, field)}</span>
                                        <button
                                            className="contacts__field-edit"
                                            type="button"
                                            aria-label={`Edit ${field.label}`}
                                            onClick={() => startEditing(field)}
                                        >
                                            <EditIcon />
                                        </button>
                                    </div>
                                )}
                            </dd>
                        </div>
                    )
                })}
            </dl>

            <AddressEditor
                contactId={contact.id}
                address={{
                    streetAddress: contact.streetAddress ?? '',
                    postalCode: contact.postalCode ?? '',
                    city: contact.city ?? '',
                    provinceState: contact.provinceState ?? '',
                    country: contact.country ?? '',
                }}
                onEditingChange={setIsAddressEditing}
                onPreviewLocation={setPreviewCoordinates}
                draggedCoordinates={draggedCoordinates}
                onSave={(address) => {
                    const coordsToSave = previewCoordinates
                    setPreviewCoordinates(null)
                    setDraggedCoordinates(null)
                    setIsAddressEditing(false)

                    // Rebuild the display location string from the saved address parts
                    const location = [
                        address.streetAddress,
                        address.city,
                        address.provinceState,
                        address.postalCode,
                        address.country,
                    ].filter(Boolean).join(', ')

                    onUpdate({
                        ...contact,
                        ...address,
                        location,
                        ...(coordsToSave && {
                            coordinatesLng: coordsToSave[0],
                            coordinatesLat: coordsToSave[1],
                        }),
                    })
                }}
            />

            <ContactMap
                location={contact.location}
                previewCoordinates={previewCoordinates}
                onMarkerDrag={isAddressEditing ? handleMarkerDrag : undefined}
            />
        </aside>
    )
}