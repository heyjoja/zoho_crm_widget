import { useState } from 'react'
import DetailContact from './DetailContact.jsx'

const initialContacts = [
    { id: '001', firstName: 'Roger', lastName: 'Kinnaird', phone: '+1 416 555 0134', email: 'roger.kinnaird@example.com', streetAddress: '123 King St W', postalCode: 'M5H 1J9', city: 'Toronto', provinceState: 'Ontario', country: 'Canada', countryCode: 'CA', location: '123 King St W, Toronto, Ontario, M5H 1J9, Canada' },
    { id: '002', firstName: 'Santino', lastName: 'Marsh', phone: '+1 647 555 0187', email: 'santino.marsh@example.com', streetAddress: '1055 Canada Pl', postalCode: 'V6C 0C3', city: 'Vancouver', provinceState: 'British Columbia', country: 'Canada', countryCode: 'CA', location: '1055 Canada Pl, Vancouver, British Columbia, V6C 0C3, Canada' },
    { id: '003', firstName: 'Curry', lastName: 'Marie', phone: '+1 905 555 0112', email: 'curry.marie@example.com', streetAddress: '233 S Wacker Dr', postalCode: '60606', city: 'Chicago', provinceState: 'Illinois', country: 'United States', countryCode: 'US', location: '233 S Wacker Dr, Chicago, Illinois, 60606, United States' },
    { id: '004', firstName: 'Veronica', lastName: 'Benedetto', phone: '+1 514 555 0173', email: 'veronica.benedetto@example.com', streetAddress: '1001 Place Jean-Paul-Riopelle', postalCode: 'H2Z 1H5', city: 'Montreal', provinceState: 'Quebec', country: 'Canada', countryCode: 'CA', location: '1001 Place Jean-Paul-Riopelle, Montreal, Quebec, H2Z 1H5, Canada' },
    { id: '005', firstName: 'Cameron', lastName: 'Williamson', phone: '+1 613 555 0191', email: 'cameron.williamson@example.com', streetAddress: '1500 Market St', postalCode: '19102', city: 'Philadelphia', provinceState: 'Pennsylvania', country: 'United States', countryCode: 'US', location: '1500 Market St, Philadelphia, Pennsylvania, 19102, United States' },
    { id: '006', firstName: 'Annette', lastName: 'Black', phone: '+1 780 555 0165', email: 'annette.black@example.com', streetAddress: '225 6 Ave SW', postalCode: 'T2P 1N2', city: 'Calgary', provinceState: 'Alberta', country: 'Canada', countryCode: 'CA', location: '225 6 Ave SW, Calgary, Alberta, T2P 1N2, Canada' },
    { id: '007', firstName: 'Guy', lastName: 'Hawkins', phone: '+1 289 555 0146', email: 'guy.hawkins@example.com', streetAddress: '20 Civic Center Plaza', postalCode: '92701', city: 'Santa Ana', provinceState: 'California', country: 'United States', countryCode: 'US', location: '20 Civic Center Plaza, Santa Ana, California, 92701, United States' },
    { id: '008', firstName: 'Savannah', lastName: 'Nguyen', phone: '+1 438 555 0120', email: 'savannah.nguyen@example.com', streetAddress: '30 Montgomery St', postalCode: '07302', city: 'Jersey City', provinceState: 'New Jersey', country: 'United States', countryCode: 'US', location: '30 Montgomery St, Jersey City, New Jersey, 07302, United States' },
    { id: '009', firstName: 'Jenny', lastName: 'Wilson', phone: '+1 403 555 0182', email: 'jenny.wilson@example.com', streetAddress: '100 Queen St', postalCode: 'K1P 1J9', city: 'Ottawa', provinceState: 'Ontario', country: 'Canada', countryCode: 'CA', location: '100 Queen St, Ottawa, Ontario, K1P 1J9, Canada' },
    { id: '010', firstName: 'Ralph', lastName: 'Edwards', phone: '+1 226 555 0158', email: 'ralph.edwards@example.com', streetAddress: '601 S Buchanan St', postalCode: '79101', city: 'Amarillo', provinceState: 'Texas', country: 'United States', countryCode: 'US', location: '601 S Buchanan St, Amarillo, Texas, 79101, United States' },
]

const getInitials = ({ firstName, lastName }) => (
    `${firstName.charAt(0)}${lastName.charAt(0)}`
)

export default function Contacts() {
    const [contactList, setContactList] = useState(initialContacts)
    const [selectedContactId, setSelectedContactId] = useState(null)
    const selectedContact = contactList.find((contact) => contact.id === selectedContactId) ?? null

    const updateContact = (updatedContact) => {
        setContactList((currentContacts) => currentContacts.map((contact) => (
            contact.id === updatedContact.id ? updatedContact : contact
        )))
    }

    return (
        <main className="contacts">
            <header className="contacts__page-header">
                <div>
                    <h1>Contacts</h1>
                </div>

                <div className="contacts__header-actions">
                    <button className="contacts__button contacts__button--primary" type="button">
                        <span aria-hidden="true">＋</span>
                        Add contact
                    </button>
                </div>
            </header>

            <section className="contacts__workspace">
                <div className="contacts__toolbar">
                    <label className="contacts__search">
                        <span aria-hidden="true">⌕</span>
                        <input type="search" placeholder="Search contact..." aria-label="Search contacts" />
                    </label>
                </div>

                <div className={`contacts__content ${selectedContact ? 'contacts__content--details' : ''}`}>
                    <div className="contacts__list">
                        <div className="contacts__table-scroll">
                            <table className="contacts__table">
                                <thead>
                                <tr>
                                    <th className="contacts__check-cell">
                                        <input type="checkbox" aria-label="Select all contacts" />
                                    </th>
                                    <th>First name</th>
                                    <th>Last name</th>
                                    <th>Phone</th>
                                    <th>Email</th>
                                    <th>Location</th>
                                    <th className="contacts__action-heading">Action</th>
                                </tr>
                                </thead>

                                <tbody>
                                {contactList.map((contact, index) => (
                                    <tr
                                        className={selectedContact?.id === contact.id ? 'contacts__row--selected' : ''}
                                        key={contact.id}
                                    >
                                        <td className="contacts__check-cell">
                                            <input type="checkbox" aria-label={`Select ${contact.firstName} ${contact.lastName}`} />
                                        </td>
                                        <td data-label="First name">
                                            <div className="contacts__person">
                          <span className={`contacts__avatar contacts__avatar--${(index % 5) + 1}`}>
                            {getInitials(contact)}
                          </span>
                                                <span className="contacts__person-copy">
                            <button
                                className="contacts__name-button"
                                type="button"
                                aria-pressed={selectedContact?.id === contact.id}
                                onClick={() => setSelectedContactId(contact.id)}
                            >
                              {contact.firstName}
                            </button>
                            <small>Contact #{contact.id}</small>
                          </span>
                                            </div>
                                        </td>
                                        <td data-label="Last name">{contact.lastName}</td>
                                        <td data-label="Phone">{contact.phone}</td>
                                        <td data-label="Email"><span className="contacts__muted">{contact.email}</span></td>
                                        <td data-label="Location"><span className="contacts__muted">{contact.location}</span></td>
                                        <td className="contacts__row-action">
                                            <button type="button" aria-label={`Actions for ${contact.firstName} ${contact.lastName}`}>
                                                ⋮
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        <footer className="contacts__pagination">
                            <p>Showing 1 to 10 of 97 entries</p>
                            <div className="contacts__pages">
                                <button type="button">← Previous</button>
                                <button type="button">1</button>
                                <button className="contacts__page--active" type="button">2</button>
                                <span>...</span>
                                <button type="button">9</button>
                                <button className="contacts__next" type="button">Next →</button>
                            </div>
                        </footer>
                    </div>

                    <DetailContact
                        contact={selectedContact}
                        onUpdate={updateContact}
                        onClose={() => setSelectedContactId(null)}
                    />
                </div>
            </section>
        </main>
    )
}
