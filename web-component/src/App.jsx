import './assets/style/index.css'
import './assets/style/App.css'
import './assets/style/Contacts.css'
import Contact from './components/Contact.jsx'
import { LanguageProvider } from './language/LanguageContext.jsx'

export default function App() {
    return (
        <LanguageProvider>
            <Contact />
        </LanguageProvider>
    )
}