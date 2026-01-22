import { useState, useEffect, useRef } from 'react'
import { useAIInference } from '@/context/AIInferenceContext'

interface LogEntry {
  id: number
  timestamp: string
  type: 'info' | 'success' | 'error' | 'warning' | 'websocket' | 'api'
  message: string
  details?: any
}

interface NetworkRequest {
  id: number
  timestamp: string
  method: string
  url: string
  status: number | null
  duration: number | null
  pending: boolean
  error?: string
}

export default function DebugConsolePage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [requests, setRequests] = useState<NetworkRequest[]>([])
  const [activeTab, setActiveTab] = useState<'logs' | 'network' | 'websocket'>('logs')
  const [autoScroll, setAutoScroll] = useState(true)
  const [filter, setFilter] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logIdRef = useRef(0)
  const requestIdRef = useRef(0)

  // WebSocket (from Context)
  const { lastMessage, isConnected } = useAIInference()
  const connectionState = isConnected ? 'connected' : 'disconnected'

  // Add log entry
  const addLog = (type: LogEntry['type'], message: string, details?: any) => {
    const entry: LogEntry = {
      id: logIdRef.current++,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false, fractionalSecondDigits: 3 }),
      type,
      message,
      details,
    }
    setLogs(prev => [...prev.slice(-500), entry]) // Keep last 500 logs
  }

  // Intercept fetch for network monitoring
  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      const [url, options] = args
      const method = (options?.method || 'GET').toUpperCase()
      const requestId = requestIdRef.current++
      const startTime = Date.now()

      const request: NetworkRequest = {
        id: requestId,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        method,
        url: typeof url === 'string' ? url : url.toString(),
        status: null,
        duration: null,
        pending: true,
      }

      setRequests(prev => [...prev.slice(-100), request])
      addLog('api', `[${method}] ${request.url}`, { requestId })

      try {
        const response = await originalFetch(...args)
        const duration = Date.now() - startTime

        setRequests(prev => prev.map(r =>
          r.id === requestId
            ? { ...r, status: response.status, duration, pending: false }
            : r
        ))

        const logType = response.ok ? 'success' : 'error'
        addLog(logType, `[${method}] ${request.url} - ${response.status} (${duration}ms)`)

        return response
      } catch (error: any) {
        const duration = Date.now() - startTime

        setRequests(prev => prev.map(r =>
          r.id === requestId
            ? { ...r, status: 0, duration, pending: false, error: error.message }
            : r
        ))

        addLog('error', `[${method}] ${request.url} - FAILED: ${error.message}`)
        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  // WebSocket message logging
  useEffect(() => {
    if (lastMessage) {
      addLog('websocket', `WS Message: ${lastMessage.type}`, lastMessage)
    }
  }, [lastMessage])

  // WebSocket connection state logging
  useEffect(() => {
    addLog('websocket', `WebSocket: ${connectionState}`)
  }, [connectionState])

  // Auto scroll
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // Filter logs
  const filteredLogs = logs.filter(log =>
    !filter || log.message.toLowerCase().includes(filter.toLowerCase())
  )

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400'
      case 'error': return 'text-red-400'
      case 'warning': return 'text-yellow-400'
      case 'websocket': return 'text-purple-400'
      case 'api': return 'text-blue-400'
      default: return 'text-gray-300'
    }
  }

  const getStatusColor = (status: number | null) => {
    if (status === null) return 'text-gray-400'
    if (status >= 200 && status < 300) return 'text-green-400'
    if (status >= 400) return 'text-red-400'
    return 'text-yellow-400'
  }

  const clearLogs = () => {
    setLogs([])
    addLog('info', 'Console cleared')
  }

  const clearRequests = () => {
    setRequests([])
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-bold text-green-400">Debug Console</h1>

          {/* Connection Status */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded bg-gray-700">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm">
              WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Server Status */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded bg-gray-700">
            <span className="text-sm text-gray-400">Django: localhost:8000</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1 rounded bg-gray-700">
            <span className="text-sm text-gray-400">modAI: localhost:9000</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            <span>Auto-scroll</span>
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 flex space-x-1">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-sm font-medium rounded-t ${
            activeTab === 'logs'
              ? 'bg-gray-900 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Console ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab('network')}
          className={`px-4 py-2 text-sm font-medium rounded-t ${
            activeTab === 'network'
              ? 'bg-gray-900 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Network ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('websocket')}
          className={`px-4 py-2 text-sm font-medium rounded-t ${
            activeTab === 'websocket'
              ? 'bg-gray-900 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          WebSocket
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-gray-850 border-b border-gray-700 px-4 py-2 flex items-center space-x-4" style={{ backgroundColor: '#1a1a2e' }}>
        <input
          type="text"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1 bg-gray-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
        />
        <button
          onClick={activeTab === 'network' ? clearRequests : clearLogs}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
        >
          Clear
        </button>
        <button
          onClick={() => addLog('info', 'Test log message')}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          Test Log
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'logs' && (
          <div className="h-full overflow-auto font-mono text-sm p-4 space-y-1">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex hover:bg-gray-800 px-2 py-0.5 rounded">
                <span className="text-gray-500 w-24 flex-shrink-0">{log.timestamp}</span>
                <span className={`w-20 flex-shrink-0 ${getLogColor(log.type)}`}>
                  [{log.type.toUpperCase()}]
                </span>
                <span className="text-gray-200 flex-1">{log.message}</span>
                {log.details && (
                  <button
                    onClick={() => console.log(log.details)}
                    className="text-gray-500 hover:text-white ml-2"
                    title="Log details to browser console"
                  >
                    [...]
                  </button>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}

        {activeTab === 'network' && (
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-400">Time</th>
                  <th className="text-left px-4 py-2 text-gray-400">Method</th>
                  <th className="text-left px-4 py-2 text-gray-400">URL</th>
                  <th className="text-left px-4 py-2 text-gray-400">Status</th>
                  <th className="text-left px-4 py-2 text-gray-400">Duration</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-gray-800 hover:bg-gray-800">
                    <td className="px-4 py-2 text-gray-500">{req.timestamp}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        req.method === 'GET' ? 'bg-green-900 text-green-300' :
                        req.method === 'POST' ? 'bg-blue-900 text-blue-300' :
                        req.method === 'PUT' ? 'bg-yellow-900 text-yellow-300' :
                        req.method === 'DELETE' ? 'bg-red-900 text-red-300' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {req.method}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-300 truncate max-w-md" title={req.url}>
                      {req.url}
                    </td>
                    <td className={`px-4 py-2 ${getStatusColor(req.status)}`}>
                      {req.pending ? (
                        <span className="text-yellow-400 animate-pulse">pending...</span>
                      ) : req.error ? (
                        <span className="text-red-400" title={req.error}>error</span>
                      ) : (
                        req.status
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-400">
                      {req.duration !== null ? `${req.duration}ms` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'websocket' && (
          <div className="h-full p-4 space-y-4">
            {/* WebSocket Status Card */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-medium mb-4">WebSocket Status</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400">Connection State:</span>
                  <span className={`ml-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                    {connectionState}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">URL:</span>
                  <span className="ml-2 text-gray-300">ws://localhost:8000/ws/ai-inference/</span>
                </div>
              </div>
            </div>

            {/* Last Message */}
            {lastMessage && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-2">Last Message</h3>
                <pre className="bg-gray-900 p-3 rounded text-sm overflow-auto max-h-64">
                  {JSON.stringify(lastMessage, null, 2)}
                </pre>
              </div>
            )}

            {/* WebSocket Logs */}
            <div className="bg-gray-800 rounded-lg p-4 flex-1">
              <h3 className="text-lg font-medium mb-2">WebSocket Events</h3>
              <div className="space-y-1 max-h-96 overflow-auto font-mono text-sm">
                {logs
                  .filter(log => log.type === 'websocket')
                  .slice(-50)
                  .map((log) => (
                    <div key={log.id} className="flex text-purple-300">
                      <span className="text-gray-500 w-24">{log.timestamp}</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-xs text-gray-500 flex justify-between">
        <span>Debug Console v1.0</span>
        <span>Logs: {logs.length} | Requests: {requests.length}</span>
      </div>
    </div>
  )
}
