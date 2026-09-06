import { useLanguage } from '../language/LanguageContext.jsx'

const LABELS = {
    es: '🇪🇸 ES',
    en: '🇺🇸 EN',
    fr: '🇨🇦 FR',
}

export default function LanguagePicker() {
    const { language, setLanguage, supported } = useLanguage()

    return (
        <div className="contacts__language-picker">
            <label htmlFor="language-select" className="contacts__language-label">
                🌐
            </label>
            <select
                id="language-select"
                className="contacts__language-select"
                value={language}
                aria-label="Select language"
                onChange={(e) => setLanguage(e.target.value)}
            >
                {supported.map((lang) => (
                    <option key={lang} value={lang}>
                        {LABELS[lang]}
                    </option>
                ))}
            </select>
        </div>
    )
}
