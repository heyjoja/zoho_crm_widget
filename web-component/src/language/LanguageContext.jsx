import { createContext, useCallback, useContext, useState } from 'react'
import translations from './index.js'

const SUPPORTED = ['es', 'en', 'fr']
const COOKIE_NAME = 'app_language'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const getCookie = (name) => {
    const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`))
    return match ? match.split('=')[1] : null
}

const setCookie = (name, value) => {
    document.cookie = `${name}=${value}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`
}

const detectLanguage = () => {
    const cookie = getCookie(COOKIE_NAME)
    if (cookie && SUPPORTED.includes(cookie)) return cookie

    const browser = (navigator.language || navigator.languages?.[0] || 'en')
        .split('-')[0]
        .toLowerCase()

    return SUPPORTED.includes(browser) ? browser : 'en'
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState(detectLanguage)

    const setLanguage = useCallback((lang) => {
        if (!SUPPORTED.includes(lang)) return
        setCookie(COOKIE_NAME, lang)
        setLanguageState(lang)
    }, [])

    const t = translations[language] ?? translations['en']

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, supported: SUPPORTED }}>
            {children}
        </LanguageContext.Provider>
    )
}

export const useLanguage = () => {
    const context = useContext(LanguageContext)
    if (!context) throw new Error('useLanguage must be used inside <LanguageProvider>')
    return context
}