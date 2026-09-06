import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/style/index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { error: null }
    }
    static getDerivedStateFromError(error) {
        return { error }
    }
    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: '2rem', fontFamily: 'monospace', color: 'red' }}>
                    <h2>⚠️ Runtime Error</h2>
                    <pre>{this.state.error.message}</pre>
                    <pre>{this.state.error.stack}</pre>
                </div>
            )
        }
        return this.props.children
    }
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>
)