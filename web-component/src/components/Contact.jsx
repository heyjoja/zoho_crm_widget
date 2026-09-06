import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import DetailContact from './DetailContact.jsx'
import LanguagePicker from './LanguagePicker.jsx'
import { useLanguage } from '../language/LanguageContext.jsx'
import { useZoho } from '../context/ZohoContext.jsx'
import { getAllContacts, searchContacts } from '../utils/zohoSDK.js'
import CreateContact from './CreateContact.jsx'

const DefaultAvatarIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="contacts__avatar-icon">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
)

const getInitials = ({ firstName, lastName }) => {
  const f = firstName?.charAt(0) ?? ''
  const l = lastName?.charAt(0) ?? ''
  return (f + l).toUpperCase() || null
}

function ContactAvatar({ contact }) {
  const [imgError, setImgError] = useState(false)
  const initials = getInitials(contact)
  const hasImage = contact.recordImage && !imgError

  if (hasImage) {
    return (
        <span className="contacts__row-avatar contacts__row-avatar--photo" aria-hidden="true">
          <img
              src={contact.recordImage}
              alt=""
              className="contacts__row-avatar-img"
              onError={() => setImgError(true)}
          />
        </span>
    )
  }

  return (
      <span className="contacts__row-avatar" aria-hidden="true">
        {initials ? initials : <DefaultAvatarIcon />}
      </span>
  )
}

const SEARCH_MIN_LENGTH = 2
const DEBOUNCE_MS = 300

export default function Contact({ onGoToModuleRecord }) {
  const { t } = useLanguage()
  const { sdkReady, sdkError } = useZoho()

  const [contactList, setContactList] = useState([])
  const [selectedContactId, setSelectedContactId] = useState(null)
  const [openActionsId, setOpenActionsId] = useState(null)
  const [openActionsRect, setOpenActionsRect] = useState(null)   // ← nuevo
  const [contactPendingDeletion, setContactPendingDeletion] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchError, setSearchError] = useState(null)
  const [searching, setSearching] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const debounceTimer = useRef(null)
  const selectedContact = contactList.find((c) => c.id === selectedContactId) ?? null

  // Load initial contact list when SDK is ready
  useEffect(() => {
    if (!sdkReady) return

    setInitialLoading(true)
    getAllContacts()
        .then((contacts) => {
          setContactList(contacts)
          setSearchError(null)
        })
        .catch((err) => {
          console.error('[Contact] Error loading initial contacts:', err)
          setSearchError(err.message)
        })
        .finally(() => setInitialLoading(false))
  }, [sdkReady])

  // Debounced search
  useEffect(() => {
    const trimmed = searchTerm.trim()

    if (trimmed.length === 0) {
      if (sdkReady) {
        setInitialLoading(true)
        getAllContacts()
            .then((contacts) => {
              setContactList(contacts)
              setSearchError(null)
            })
            .catch((err) => setSearchError(err.message))
            .finally(() => setInitialLoading(false))
      }
      setSearching(false)
      clearTimeout(debounceTimer.current)
      return
    }

    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setSearching(false)
      clearTimeout(debounceTimer.current)
      return
    }

    setSearching(true)
    clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      try {
        const contacts = await searchContacts(searchTerm)
        setContactList(contacts)
        setSearchError(null)
      } catch (error) {
        console.error('[Contact] Error searching contacts in Zoho:', error)
        setSearchError(error.message)
        setContactList([])
      } finally {
        setSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceTimer.current)
  }, [searchTerm, sdkReady])

  const handleInputChange = (e) => setSearchTerm(e.target.value)

  const updateContact = (updatedContact) =>
      setContactList((list) => list.map((c) => (c.id === updatedContact.id ? updatedContact : c)))

  const openDetails = (contact) => {
    setOpenActionsId(null)
    setOpenActionsRect(null)
    setSelectedContactId(contact.id)
  }

  const goToModuleRecord = (contact) => {
    setOpenActionsId(null)
    setOpenActionsRect(null)
    const url = `https://crm.zoho.com/crm/org938042819/tab/Contacts/${contact.id}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const requestContactDeletion = (contact) => {
    setOpenActionsId(null)
    setOpenActionsRect(null)
    setContactPendingDeletion(contact)
  }

  const confirmContactDeletion = () => {
    if (!contactPendingDeletion) return
    setContactList((list) => list.filter((c) => c.id !== contactPendingDeletion.id))
    setSelectedContactId((id) => (id === contactPendingDeletion.id ? null : id))
    setContactPendingDeletion(null)
  }

  // ← captura la posición del botón y la guarda para el portal
  const handleTriggerClick = (e, contactId) => {
    if (openActionsId === contactId) {
      setOpenActionsId(null)
      setOpenActionsRect(null)
    } else {
      setOpenActionsId(contactId)
      setOpenActionsRect(e.currentTarget.getBoundingClientRect())
    }
  }

  const isLoading = initialLoading || searching

  const searchHint =
      searchTerm.length > 0 && searchTerm.trim().length < SEARCH_MIN_LENGTH
          ? `Type at least ${SEARCH_MIN_LENGTH} characters to search`
          : null

  const openContact = openActionsId ? contactList.find((c) => c.id === openActionsId) : null

  return (
      <main className="contacts">
        <header className="contacts__page-header">
          <div>
            <h1>{t.contacts ?? 'Contacts'}</h1>
          </div>
          <div className="contacts__header-actions">
            <LanguagePicker />
            <button className="contacts__button contacts__button--primary" type="button" onClick={() => setShowCreate(true)}>
              <span aria-hidden="true">＋</span>
              {t.addContact ?? 'Add contact'}
            </button>
          </div>
        </header>

        {sdkError && (
            <div className="contacts__sdk-error" role="alert" style={{ padding: '0.75rem 1rem', background: '#fff0f0', color: '#c00', borderBottom: '1px solid #f5c2c2' }}>
              ⚠️ Zoho SDK error: {sdkError.message}
            </div>
        )}

        <section className="contacts__workspace">
          <div className="contacts__toolbar">
            <label className="contacts__search">
              <span aria-hidden="true">⌕</span>
              <input
                  type="search"
                  value={searchTerm}
                  onChange={handleInputChange}
                  placeholder={sdkReady ? (t.searchContact ?? 'Search contact...') : 'Waiting for Zoho SDK...'}
                  aria-label={t.searchContact ?? 'Search contacts'}
                  disabled={!sdkReady}
              />
            </label>
            {isLoading && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                  {searching ? 'Searching…' : 'Loading…'}
                </span>
            )}
          </div>

          {searchHint && (
              <p style={{ margin: '0.25rem 0 0 0', padding: '0 1rem', fontSize: '0.8rem', color: '#888' }}>
                {searchHint}
              </p>
          )}

          {searchError && (
              <div role="alert" style={{ padding: '0.5rem 1rem', color: '#c00', fontSize: '0.875rem' }}>
                ⚠️ {searchError}
              </div>
          )}

          <div className={`contacts__content${selectedContact ? ' contacts__content--details' : ''}`}>
            <div className="contacts__list">
              <div className="contacts__table-scroll">
                <table className="contacts__table">
                  <thead>
                  <tr>
                    <th className="contacts__check-cell">
                      <input type="checkbox" aria-label={t.selectAll ?? 'Select all contacts'} />
                    </th>
                    <th className="contacts__qid-cell">{t.qid ?? '#'}</th>
                    <th>{t.name ?? 'Name'}</th>
                    <th>{t.phone ?? 'Phone'}</th>
                    <th>{t.email ?? 'Email'}</th>
                    <th>{t.location ?? 'Location'}</th>
                    <th>{t.action ?? 'Action'}</th>
                  </tr>
                  </thead>
                  <tbody>
                  {contactList.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>
                          {searchError
                              ? 'Load failed. See error above.'
                              : searchTerm.trim().length >= SEARCH_MIN_LENGTH
                                  ? 'No contacts found.'
                                  : 'No contacts available.'}
                        </td>
                      </tr>
                  )}
                  {contactList.map((contact) => (
                      <tr
                          key={contact.id}
                          className={openActionsId === contact.id ? 'contacts__row--menu-open' : undefined}
                      >
                        <td className="contacts__check-cell">
                          <input
                              type="checkbox"
                              aria-label={`${t.select ?? 'Select'} ${contact.firstName} ${contact.lastName}`}
                          />
                        </td>
                        <td className="contacts__qid-cell">
                          {contact.qid != null
                              ? <span className="contacts__qid-badge">{contact.qid}</span>
                              : <span className="contacts__qid-empty">—</span>}
                        </td>
                        <td>
                          <div className="contacts__name-cell">
                            <ContactAvatar contact={contact} />
                            <button
                                type="button"
                                className="contacts__name-link"
                                onClick={() => openDetails(contact)}
                            >
                              {contact.firstName} {contact.lastName}
                            </button>
                          </div>
                        </td>
                        <td>{contact.phone}</td>
                        <td>{contact.email}</td>
                        <td>{contact.location}</td>
                        <td className="contacts__actions-cell">
                          {/* Solo queda el trigger; el menú se monta en <body> vía portal */}
                          <div className="contacts__actions-wrapper">
                            <button
                                className="contacts__action-trigger"
                                type="button"
                                aria-label={`${t.actions ?? 'Actions for'} ${contact.firstName} ${contact.lastName}`}
                                aria-haspopup="menu"
                                aria-expanded={openActionsId === contact.id}
                                onClick={(e) => handleTriggerClick(e, contact.id)}
                            >
                              ⋯
                            </button>
                          </div>
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedContact && (
                <DetailContact
                    contact={selectedContact}
                    onUpdate={updateContact}
                    onClose={() => setSelectedContactId(null)}
                />
            )}
          </div>
        </section>

        {/* Portal: el menú se pinta directamente en <body>, encima de todo */}
        {openContact && openActionsRect && createPortal(
            <div
                className="contacts__actions-menu"
                role="menu"
                style={{
                  position: 'fixed',
                  top: openActionsRect.bottom + 4,
                  right: window.innerWidth - openActionsRect.right,
                  zIndex: 99999,
                }}
            >
              <button type="button" role="menuitem" onClick={() => goToModuleRecord(openContact)}>
                {t.goToRecord ?? 'Go to module record'}
              </button>
              <button
                  type="button"
                  role="menuitem"
                  className="contacts__action--danger"
                  onClick={() => requestContactDeletion(openContact)}
              >
                {t.delete ?? 'Delete'}
              </button>
            </div>,
            document.body
        )}

        {contactPendingDeletion && (
            <div className="contacts__modal-overlay" role="dialog" aria-modal="true">
              <div className="contacts__modal">
                <p>
                  {t.deleteConfirm ?? 'Are you sure you want to delete'}{' '}
                  <strong>{contactPendingDeletion.firstName} {contactPendingDeletion.lastName}</strong>?
                </p>
                <p className="contacts__modal-warning">
                  {t.deleteWarning ?? 'This action cannot be undone.'}
                </p>
                <div className="contacts__modal-actions">
                  <button type="button" onClick={() => setContactPendingDeletion(null)}>
                    {t.cancel ?? 'Cancel'}
                  </button>
                  <button
                      type="button"
                      className="contacts__action--danger"
                      onClick={confirmContactDeletion}
                  >
                    {t.delete ?? 'Delete'}
                  </button>
                </div>
              </div>
            </div>
        )}

        {showCreate && (
            <CreateContact
                onClose={() => setShowCreate(false)}
                onCreated={() => {
                    setShowCreate(false)
                    // Reload the contact list so the new entry appears
                    setInitialLoading(true)
                    getAllContacts()
                        .then((contacts) => {
                            setContactList(contacts)
                            setSearchError(null)
                        })
                        .catch((err) => setSearchError(err.message))
                        .finally(() => setInitialLoading(false))
                }}
            />
        )}
      </main>
  )
}