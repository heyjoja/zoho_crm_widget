import { LanguageProvider } from './language/LanguageContext.jsx'
import Contact from './components/Contact.jsx'
import './assets/style/index.css'
import './assets/style/App.css'
import './assets/style/Contacts.css'


export default function App() {
  return (
      <LanguageProvider>
        <Contact />
      </LanguageProvider>
  )
}