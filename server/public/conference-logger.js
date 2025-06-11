/**
 * Conference Room Controls Logger
 * Provides comprehensive logging for all conference room activities
 * to monitor and debug how conference room controls are working
 */

class ConferenceLogger {
    constructor() {
        this.logs = [];
        this.logLevel = 'INFO'; // INFO, DEBUG, WARN, ERROR
        this.maxLogs = 1000; // Maximum number of logs to keep in memory
        this.enableConsoleOutput = true;
        this.enableLocalStorage = true;
        this.logCategories = {
            CONNECTION: 'Connection',
            MEDIA: 'Media',
            PARTICIPANT: 'Participant',
            CONTROL: 'Control',
            ERROR: 'Error',
            PERFORMANCE: 'Performance'
        };
        
        this.init();
    }

    init() {
        this.log('INFO', 'SYSTEM', 'Conference Logger initialized', {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            webRTCSupport: this.checkWebRTCSupport()
        });
        
        // Load existing logs from localStorage if available
        this.loadLogsFromStorage();
        
        // Set up periodic log cleanup
        setInterval(() => this.cleanupLogs(), 60000); // Cleanup every minute
    }

    checkWebRTCSupport() {
        return {
            getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            RTCPeerConnection: !!window.RTCPeerConnection,
            RTCDataChannel: !!(window.RTCPeerConnection && window.RTCPeerConnection.prototype.createDataChannel),
            liveKit: !!window.LiveKit
        };
    }

    log(level, category, message, data = {}) {
        const logEntry = {
            id: this.generateLogId(),
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            category: category.toUpperCase(),
            message,
            data: this.sanitizeData(data),
            stackTrace: level === 'ERROR' ? new Error().stack : null
        };

        this.logs.push(logEntry);
        
        if (this.enableConsoleOutput) {
            this.outputToConsole(logEntry);
        }
        
        if (this.enableLocalStorage) {
            this.saveToLocalStorage();
        }

        // Emit custom event for external listeners
        this.emitLogEvent(logEntry);
    }

    // Convenience methods for different log levels
    info(category, message, data) {
        this.log('INFO', category, message, data);
    }

    debug(category, message, data) {
        this.log('DEBUG', category, message, data);
    }

    warn(category, message, data) {
        this.log('WARN', category, message, data);
    }

    error(category, message, data) {
        this.log('ERROR', category, message, data);
    }

    // Specific logging methods for conference room controls
    logConnectionEvent(event, details = {}) {
        this.info('CONNECTION', `Connection ${event}`, {
            event,
            wsURL: details.wsURL || 'Unknown',
            roomName: details.roomName || 'Unknown',
            username: details.username || 'Unknown',
            timestamp: Date.now(),
            ...details
        });
    }

    logMediaControl(controlType, action, details = {}) {
        this.info('MEDIA', `${controlType} ${action}`, {
            controlType, // 'microphone', 'camera', 'screen'
            action, // 'enabled', 'disabled', 'toggle'
            previousState: details.previousState,
            newState: details.newState,
            trackId: details.trackId,
            deviceId: details.deviceId,
            error: details.error,
            timestamp: Date.now(),
            ...details
        });
    }

    logParticipantEvent(event, participantData = {}) {
        this.info('PARTICIPANT', `Participant ${event}`, {
            event, // 'joined', 'left', 'muted', 'unmuted'
            participantId: participantData.identity || participantData.id,
            participantName: participantData.name || participantData.identity,
            participantCount: participantData.totalCount,
            trackKind: participantData.trackKind,
            timestamp: Date.now(),
            ...participantData
        });
    }

    logControlInteraction(controlElement, action, details = {}) {
        this.info('CONTROL', `Control ${action}`, {
            controlElement, // 'mic-btn', 'video-btn', 'screen-btn', etc.
            action, // 'clicked', 'toggled', 'disabled', 'enabled'
            previousValue: details.previousValue,
            newValue: details.newValue,
            timestamp: Date.now(),
            ...details
        });
    }

    logPerformanceMetric(metric, value, details = {}) {
        this.info('PERFORMANCE', `Performance: ${metric}`, {
            metric, // 'latency', 'bandwidth', 'frame_rate', 'resolution'
            value,
            unit: details.unit,
            threshold: details.threshold,
            isWarning: details.isWarning || false,
            timestamp: Date.now(),
            ...details
        });
    }

    logError(category, error, context = {}) {
        this.error(category, error.message || error, {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
            context,
            timestamp: Date.now()
        });
    }

    // Utility methods
    generateLogId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    sanitizeData(data) {
        // Remove circular references and sensitive data
        const sanitized = {};
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const value = data[key];
                if (typeof value === 'object' && value !== null) {
                    if (value instanceof Error) {
                        sanitized[key] = {
                            name: value.name,
                            message: value.message,
                            stack: value.stack
                        };
                    } else if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key')) {
                        sanitized[key] = '[REDACTED]';
                    } else {
                        try {
                            sanitized[key] = JSON.parse(JSON.stringify(value));
                        } catch (e) {
                            sanitized[key] = '[CIRCULAR REFERENCE]';
                        }
                    }
                } else {
                    sanitized[key] = value;
                }
            }
        }
        return sanitized;
    }

    outputToConsole(logEntry) {
        const style = this.getConsoleStyle(logEntry.level);
        const prefix = `[${logEntry.timestamp.split('T')[1].split('.')[0]}] [${logEntry.category}]`;
        
        switch (logEntry.level) {
            case 'ERROR':
                console.error(`%c${prefix} ${logEntry.message}`, style, logEntry.data);
                break;
            case 'WARN':
                console.warn(`%c${prefix} ${logEntry.message}`, style, logEntry.data);
                break;
            case 'DEBUG':
                console.debug(`%c${prefix} ${logEntry.message}`, style, logEntry.data);
                break;
            default:
                //console.log(`%c${prefix} ${logEntry.message}`, style, logEntry.data);
        }
    }

    getConsoleStyle(level) {
        const styles = {
            'ERROR': 'color: #ff6b6b; font-weight: bold;',
            'WARN': 'color: #ffa500; font-weight: bold;',
            'INFO': 'color: #6c63ff; font-weight: bold;',
            'DEBUG': 'color: #888; font-weight: normal;'
        };
        return styles[level] || styles['INFO'];
    }

    emitLogEvent(logEntry) {
        const event = new CustomEvent('conferenceLog', {
            detail: logEntry
        });
        window.dispatchEvent(event);
    }

    // Storage methods
    saveToLocalStorage() {
        try {
            const recentLogs = this.logs.slice(-100); // Save only last 100 logs
            localStorage.setItem('conference_logs', JSON.stringify(recentLogs));
        } catch (e) {
            console.warn('Failed to save logs to localStorage:', e);
        }
    }

    loadLogsFromStorage() {
        try {
            const saved = localStorage.getItem('conference_logs');
            if (saved) {
                const savedLogs = JSON.parse(saved);
                this.logs = Array.isArray(savedLogs) ? savedLogs : [];
            }
        } catch (e) {
            console.warn('Failed to load logs from localStorage:', e);
        }
    }

    cleanupLogs() {
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
            this.saveToLocalStorage();
        }
    }

    // Export methods
    exportLogs(format = 'json') {
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(this.logs, null, 2);
            case 'csv':
                return this.logsToCSV();
            case 'text':
                return this.logsToText();
            default:
                return this.logs;
        }
    }

    logsToCSV() {
        if (this.logs.length === 0) return '';
        
        const headers = ['Timestamp', 'Level', 'Category', 'Message', 'Data'];
        const csvLines = [headers.join(',')];
        
        this.logs.forEach(log => {
            const row = [
                log.timestamp,
                log.level,
                log.category,
                `"${log.message.replace(/"/g, '""')}"`,
                `"${JSON.stringify(log.data).replace(/"/g, '""')}"`
            ];
            csvLines.push(row.join(','));
        });
        
        return csvLines.join('\n');
    }

    logsToText() {
        return this.logs.map(log => {
            return `[${log.timestamp}] [${log.level}] [${log.category}] ${log.message}\n` +
                   `Data: ${JSON.stringify(log.data, null, 2)}\n` +
                   '---\n';
        }).join('');
    }

    // Analysis methods
    getLogsByCategory(category) {
        return this.logs.filter(log => log.category === category.toUpperCase());
    }

    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level.toUpperCase());
    }

    getLogsByTimeRange(startTime, endTime) {
        return this.logs.filter(log => {
            const logTime = new Date(log.timestamp);
            return logTime >= new Date(startTime) && logTime <= new Date(endTime);
        });
    }

    getErrorSummary() {
        const errors = this.getLogsByLevel('ERROR');
        const summary = {};
        
        errors.forEach(error => {
            const key = `${error.category}: ${error.message}`;
            summary[key] = (summary[key] || 0) + 1;
        });
        
        return summary;
    }

    getPerformanceMetrics() {
        const perfLogs = this.getLogsByCategory('PERFORMANCE');
        const metrics = {};
        
        perfLogs.forEach(log => {
            const metric = log.data.metric;
            if (!metrics[metric]) {
                metrics[metric] = {
                    values: [],
                    average: 0,
                    min: Infinity,
                    max: -Infinity
                };
            }
            
            const value = parseFloat(log.data.value);
            if (!isNaN(value)) {
                metrics[metric].values.push(value);
                metrics[metric].min = Math.min(metrics[metric].min, value);
                metrics[metric].max = Math.max(metrics[metric].max, value);
            }
        });
        
        // Calculate averages
        Object.keys(metrics).forEach(metric => {
            const values = metrics[metric].values;
            if (values.length > 0) {
                metrics[metric].average = values.reduce((a, b) => a + b, 0) / values.length;
            }
        });
        
        return metrics;
    }

    // Clear methods
    clearLogs() {
        this.logs = [];
        localStorage.removeItem('conference_logs');
        this.log('INFO', 'SYSTEM', 'Logs cleared manually');
    }

    // Configuration methods
    setLogLevel(level) {
        this.logLevel = level.toUpperCase();
        this.log('INFO', 'SYSTEM', `Log level changed to ${level}`);
    }

    setConsoleOutput(enabled) {
        this.enableConsoleOutput = enabled;
        this.log('INFO', 'SYSTEM', `Console output ${enabled ? 'enabled' : 'disabled'}`);
    }

    setLocalStorage(enabled) {
        this.enableLocalStorage = enabled;
        this.log('INFO', 'SYSTEM', `Local storage ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Get current status
    getStatus() {
        return {
            totalLogs: this.logs.length,
            logLevel: this.logLevel,
            consoleOutput: this.enableConsoleOutput,
            localStorage: this.enableLocalStorage,
            categories: Object.values(this.logCategories),
            recentErrors: this.getLogsByLevel('ERROR').slice(-5),
            performanceMetrics: this.getPerformanceMetrics()
        };
    }
}

// Create global instance
window.ConferenceLogger = window.ConferenceLogger || new ConferenceLogger();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConferenceLogger;
}

// Auto-start logging when the script loads
window.ConferenceLogger.info('SYSTEM', 'Conference Logger ready', {
    version: '1.0.0',
    timestamp: Date.now()
});
