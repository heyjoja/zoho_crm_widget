import React, { createContext, useContext, useEffect, useState } from 'react'
const ZohoContext = createContext(null)
export function ZohoProvider({ children }) {
    const [pageData, setPageData] = useState(null)
    const [sdkReady, setSdkReady] = useState(false)
    const [sdkError, setSdkError] = useState(null)
    useEffect(() => {
        const ready = window.__zohoReady
        if (!ready) {
            setSdkError(new Error('window.__zohoReady is not defined. Check public/index.html.'))
            return
        }
        ready
            .then((data) => {
                setPageData(data)
                setSdkReady(true)
            })
            .catch((err) => {
                console.error('[ZohoContext] SDK failed to initialize:', err.message)
                setSdkError(err)
            })
    }, [])
    return (
        <ZohoContext.Provider value={{ pageData, sdkReady, sdkError }}>
            {children}
        </ZohoContext.Provider>
    )
}
export function useZoho() {
    const ctx = useContext(ZohoContext)
    if (ctx === null) {
        throw new Error(
            '[useZoho] returned null — <ZohoProvider> must wrap this component. ' +
            'Check that ZohoProvider is in main.jsx above <App />.'
        )
    }
    return ctx
}
export function getZohoSDK() {
    if (!window.ZOHO?.CRM) {
        console.warn('[Zoho] ZOHO.CRM not available on window.')
        return null
    }
    return window.ZOHO
}
