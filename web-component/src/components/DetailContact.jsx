import { useEffect, useState } from 'react'
import AddressEditor from './AddressEditor.jsx'
import ContactMap from './ContactMap.jsx'
import { updateContact as updateContactCRM, getContact } from '../utils/zohoSDK.js'
import { useLanguage } from '../language/LanguageContext.jsx'

const getInitials = ({ firstName, lastName }) => (
    `${firstName.charAt(0)}${lastName.charAt(0)}`
)

// Static field definitions — labels are resolved from translations at render time
const FIELD_DEFS = [
    { key: 'firstName', tKey: 'firstName', type: 'text' },
    { key: 'lastName',  tKey: 'lastName',  type: 'text' },
    { key: 'phone',     tKey: 'phone',     type: 'tel'  },
    { key: 'email',     tKey: 'email',     type: 'email' },
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
    // ── Hooks must come before any early return ───────────────────────────────
    const { t } = useLanguage()

    const [editingField, setEditingField] = useState(null)
    const [draftValue, setDraftValue] = useState('')
    const [previewCoordinates, setPreviewCoordinates] = useState(null)
    const [draggedCoordinates, setDraggedCoordinates] = useState(null)
    const [isAddressEditing, setIsAddressEditing] = useState(false)

    // Full contact data fetched fresh from Zoho CRM (includes coordinates)
    const [freshContact, setFreshContact] = useState(null)
    const [fetchingContact, setFetchingContact] = useState(false)

    // Accumulated pending changes (not yet sent to the CRM module)
    const [pendingChanges, setPendingChanges] = useState({})
    // Whether the unsaved-changes confirmation dialog is open
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

    // Fetch the full contact record from Zoho CRM when the selected contact changes
    useEffect(() => {
        if (!contact?.id) return

        setFreshContact(null)
        setEditingField(null)
        setDraftValue('')
        setPreviewCoordinates(null)
        setDraggedCoordinates(null)
        setIsAddressEditing(false)
        setPendingChanges({})
        setShowUnsavedDialog(false)
        setFetchingContact(true)

        getContact(contact.id)
            .then((data) => {
                setFreshContact(data)
            })
            .catch((err) => {
                console.error('[DetailContact] Failed to fetch fresh contact:', err)
                // Keep using list data as fallback — freshContact stays null
            })
            .finally(() => setFetchingContact(false))
    }, [contact?.id])

    // Early return after all hooks
    if (!contact) return null

    // ── Derived state ────────────────────────────────────────────────────────

    const hasPendingChanges = Object.keys(pendingChanges).length > 0

    // Base contact: prefer freshly fetched data, fall back to list data
    const baseContact = freshContact ?? contact

    // Merged view: base contact + any pending edits
    const displayContact = { ...baseContact, ...pendingChanges }

    // Translated field list — re-derived on every render so language changes apply immediately
    const fields = FIELD_DEFS.map((f) => ({ ...f, label: t[f.tKey] ?? f.tKey }))

    // ── Field editing ────────────────────────────────────────────────────────

    const startEditing = (field) => {
        setEditingField(field.key)
        setDraftValue(displayContact[field.key] ?? '')
    }

    const saveField = () => {
        if (!editingField) return
        setPendingChanges((prev) => ({ ...prev, [editingField]: draftValue.trim() }))
        setEditingField(null)
        setDraftValue('')
    }

    const cancelEditing = () => {
        setEditingField(null)
        setDraftValue('')
    }

    // ── Unsaved-changes save / discard ────────────────────────────────────────

    const mapToZohoFields = (changes) => {
        const fieldMap = {
            firstName: 'First_Name',
            lastName: 'Last_Name',
            phone: 'Phone',
            email: 'Email',
            streetAddress: 'Mailing_Street',
            city: 'Mailing_City',
            provinceState: 'Mailing_State',
            postalCode: 'Mailing_Zip',
            country: 'Mailing_Country',
            coordinatesLng: 'Mailing_Longitude',
            coordinatesLat: 'Mailing_Latitude',
        }

        const zohoFields = {}
        for (const [internalKey, zohoKey] of Object.entries(fieldMap)) {
            if (Object.prototype.hasOwnProperty.call(changes, internalKey)) {
                zohoFields[zohoKey] = changes[internalKey]
            }
        }
        return zohoFields
    }

    const commitSave = async () => {
        const zohoFields = mapToZohoFields(pendingChanges)

        try {
            if (Object.keys(zohoFields).length > 0) {
                await updateContactCRM(baseContact.id, zohoFields)
                console.log('[DetailContact] Contact updated in Zoho CRM successfully.')
            }
            const merged = { ...baseContact, ...pendingChanges }
            setFreshContact(merged)
            onUpdate(merged)
            setPendingChanges({})
            setShowUnsavedDialog(false)
        } catch (err) {
            console.error('[DetailContact] Failed to update contact in Zoho CRM:', err)
            alert(`${t.failedToSave ?? 'Failed to save changes'}: ${err.message}`)
        }
    }

    const commitDiscard = () => {
        setPendingChanges({})
        setShowUnsavedDialog(false)
        onClose()
    }

    // ── Close button ─────────────────────────────────────────────────────────

    const handleClose = () => {
        cancelEditing()
        if (hasPendingChanges) {
            setShowUnsavedDialog(true)
        } else {
            onClose()
        }
    }

    // ── Map drag ─────────────────────────────────────────────────────────────

    const handleMarkerDrag = (coords) => {
        setPreviewCoordinates(coords)
        setDraggedCoordinates(coords)
    }

    // ── Address save (still accumulated as pending) ───────────────────────────

    const handleAddressSave = (address) => {
        const coordsToSave = previewCoordinates
        setPreviewCoordinates(null)
        setDraggedCoordinates(null)
        setIsAddressEditing(false)

        const location = [
            address.streetAddress,
            address.city,
            address.provinceState,
            address.postalCode,
            address.country,
        ].filter(Boolean).join(', ')

        setPendingChanges((prev) => ({
            ...prev,
            ...address,
            location,
            ...(coordsToSave && {
                coordinatesLng: coordsToSave[0],
                coordinatesLat: coordsToSave[1],
            }),
        }))
    }

    return (
        <aside className="contacts__details" aria-label="Contact details">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="contacts__details-header">
                <span className="contacts__details-avatar">{getInitials(displayContact)}</span>
                <div>
                    <span className="contacts__details-label">
                        {t.contactProfile ?? 'Contact profile'}{fetchingContact ? ` — ${t.loading ?? 'loading…'}` : ''}
                    </span>
                    <h2>{displayContact.firstName} {displayContact.lastName}</h2>
                    <p>{t.contactNumber ?? 'Contact #'}{baseContact.id}</p>
                </div>
                <button
                    className="contacts__details-close"
                    type="button"
                    aria-label={t.closeDetails ?? 'Close contact details'}
                    onClick={handleClose}
                >
                    ×
                </button>
            </div>

            {/* ── Unsaved-changes banner ──────────────────────────────────── */}
            {hasPendingChanges && (
                <div className="contacts__unsaved-banner" role="status">
                    <span className="contacts__unsaved-banner-text">
                        {t.unsavedChanges ?? '⚠️ You have unsaved changes'}
                    </span>
                    <div className="contacts__unsaved-banner-actions">
                        <button
                            className="contacts__unsaved-discard"
                            type="button"
                            onClick={() => {
                                setPendingChanges({})
                                cancelEditing()
                            }}
                        >
                            {t.discard ?? 'Discard'}
                        </button>
                        <button
                            className="contacts__unsaved-save"
                            type="button"
                            onClick={commitSave}
                        >
                            {t.save ?? 'Save'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Field list ─────────────────────────────────────────────── */}
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
                                            aria-label={`${t.editField ?? 'Edit'} ${field.label}`}
                                            onChange={(event) => setDraftValue(event.target.value)}
                                            onKeyDown={(event) => { if (event.key === 'Escape') cancelEditing() }}
                                        />
                                        <div className="contacts__field-editor-actions">
                                            <button
                                                className="contacts__field-cancel"
                                                type="button"
                                                aria-label={`${t.cancelEdit ?? 'Cancel editing'} ${field.label}`}
                                                onClick={cancelEditing}
                                            >
                                                <CancelIcon />
                                            </button>
                                            <button
                                                className="contacts__field-save"
                                                type="submit"
                                                aria-label={`${t.saveField ?? 'Save'} ${field.label}`}
                                            >
                                                <SaveIcon />
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="contacts__field-value">
                                        <span>{renderValue(displayContact, field)}</span>
                                        <button
                                            className="contacts__field-edit"
                                            type="button"
                                            aria-label={`${t.editField ?? 'Edit'} ${field.label}`}
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

            {/* ── Address editor ─────────────────────────────────────────── */}
            <AddressEditor
                contactId={contact.id}
                address={{
                    streetAddress: displayContact.streetAddress ?? '',
                    postalCode: displayContact.postalCode ?? '',
                    city: displayContact.city ?? '',
                    provinceState: displayContact.provinceState ?? '',
                    country: displayContact.country ?? '',
                }}
                onEditingChange={setIsAddressEditing}
                onPreviewLocation={setPreviewCoordinates}
                draggedCoordinates={draggedCoordinates}
                onSave={handleAddressSave}
            />

            <ContactMap
                location={displayContact.location}
                savedCoordinates={
                    displayContact.coordinatesLng != null && displayContact.coordinatesLat != null
                        ? [displayContact.coordinatesLng, displayContact.coordinatesLat]
                        : null
                }
                previewCoordinates={previewCoordinates}
                onMarkerDrag={isAddressEditing ? handleMarkerDrag : undefined}
            />

            {/* ── Unsaved-changes confirmation dialog ────────────────────── */}
            {showUnsavedDialog && (
                <div className="contacts__dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="unsaved-dialog-title">
                    <div className="contacts__dialog">
                        <h3 id="unsaved-dialog-title">{t.unsavedDialogTitle ?? 'Unsaved changes'}</h3>
                        <p>{t.unsavedDialogMessage ?? 'You have unsaved changes. What would you like to do?'}</p>
                        <div className="contacts__dialog-actions">
                            <button
                                className="contacts__dialog-discard"
                                type="button"
                                onClick={commitDiscard}
                            >
                                {t.discardAndClose ?? 'Discard & close'}
                            </button>
                            <button
                                className="contacts__dialog-save"
                                type="button"
                                onClick={commitSave}
                            >
                                {t.saveAndClose ?? 'Save & close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    )
}