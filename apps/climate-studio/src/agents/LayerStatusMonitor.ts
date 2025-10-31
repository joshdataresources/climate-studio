/**
 * LayerStatusMonitor Agent
 *
 * Monitors climate layer loading status, detects fallback bugs, and verifies real data loading.
 * Emits events for layer status changes to enable proactive debugging and monitoring.
 */

export type LayerDataSource = 'real' | 'fallback' | 'unknown';

export interface LayerStatusEvent {
  layerId: string;
  status: 'loading' | 'success' | 'error' | 'fallback';
  timestamp: number;
  dataSource: LayerDataSource;
  metadata?: {
    featureCount?: number;
    source?: string;
    model?: string;
    scenario?: string;
    year?: number;
    isRealData?: boolean;
    errorMessage?: string;
    fallbackReason?: string;
  };
}

export type LayerStatusListener = (event: LayerStatusEvent) => void;

class LayerStatusMonitorAgent {
  private listeners: Set<LayerStatusListener> = new Set();
  private statusHistory: Map<string, LayerStatusEvent[]> = new Map();
  private fallbackDetected: Map<string, boolean> = new Map();

  /**
   * Subscribe to layer status events
   */
  subscribe(listener: LayerStatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit a layer status event
   */
  emit(event: LayerStatusEvent): void {
    // Store in history
    if (!this.statusHistory.has(event.layerId)) {
      this.statusHistory.set(event.layerId, []);
    }
    this.statusHistory.get(event.layerId)!.push(event);

    // Detect fallback bugs
    if (event.dataSource === 'fallback') {
      this.fallbackDetected.set(event.layerId, true);
      console.warn(
        `🚨 FALLBACK DETECTED for layer "${event.layerId}"`,
        event.metadata?.fallbackReason || 'Unknown reason'
      );
    }

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in layer status listener:', error);
      }
    });
  }

  /**
   * Check if a layer response contains real NASA data or fallback
   */
  analyzeLayerData(layerId: string, data: any): LayerDataSource {
    if (!data) return 'unknown';

    // Check metadata for explicit isRealData flag (most reliable)
    const metadata = data.metadata || data.properties;
    if (metadata) {
      if (metadata.isRealData === true || metadata.dataType === 'real') {
        return 'real';
      }
      if (metadata.isRealData === false || metadata.dataType === 'fallback') {
        return 'fallback';
      }

      // Real NASA data indicators
      if (metadata.source?.includes('NASA NEX-GDDP-CMIP6 via Earth Engine')) {
        return 'real';
      }
      if (metadata.source?.includes('NASA NEX-GDDP-CMIP6') && metadata.model) {
        return 'real';
      }

      // Fallback data indicators
      if (metadata.source?.includes('Simulated') || metadata.source?.includes('Fallback')) {
        return 'fallback';
      }
    }

    // Check features for data quality indicators
    const features = data.features || [];
    if (features.length > 0) {
      const firstFeature = features[0];
      const props = firstFeature.properties || {};

      // Real data has model and source attribution
      if (props.model && props.sspScenario) {
        return 'real';
      }
    }

    return 'unknown';
  }

  /**
   * Create a status event from layer fetch state
   */
  createStatusEvent(
    layerId: string,
    status: 'loading' | 'success' | 'error' | 'fallback',
    data?: any,
    error?: string
  ): LayerStatusEvent {
    const event: LayerStatusEvent = {
      layerId,
      status,
      timestamp: Date.now(),
      dataSource: 'unknown',
      metadata: {}
    };

    if (status === 'error') {
      event.metadata!.errorMessage = error;
      event.dataSource = 'unknown';
    } else if (status === 'success' && data) {
      event.dataSource = this.analyzeLayerData(layerId, data);

      // Extract metadata
      const metadata = data.metadata || data.properties || {};
      event.metadata = {
        featureCount: data.features?.length || 0,
        source: metadata.source,
        model: metadata.model,
        scenario: metadata.scenario,
        year: metadata.year,
        isRealData: event.dataSource === 'real'
      };

      // If we detected fallback, update status
      if (event.dataSource === 'fallback') {
        event.status = 'fallback';
        event.metadata.fallbackReason = 'Server returned fallback data instead of real NASA data';
      }
    }

    return event;
  }

  /**
   * Get status history for a layer
   */
  getHistory(layerId: string): LayerStatusEvent[] {
    return this.statusHistory.get(layerId) || [];
  }

  /**
   * Check if fallback was detected for a layer
   */
  hasFallback(layerId: string): boolean {
    return this.fallbackDetected.get(layerId) || false;
  }

  /**
   * Get the latest status for a layer
   */
  getLatestStatus(layerId: string): LayerStatusEvent | null {
    const history = this.getHistory(layerId);
    return history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Clear history and reset monitoring for a layer
   */
  reset(layerId?: string): void {
    if (layerId) {
      this.statusHistory.delete(layerId);
      this.fallbackDetected.delete(layerId);
    } else {
      this.statusHistory.clear();
      this.fallbackDetected.clear();
    }
  }

  /**
   * Get a summary report of all monitored layers
   */
  getSummary(): {
    totalLayers: number;
    layersWithFallback: number;
    layersWithErrors: number;
    layersWithRealData: number;
  } {
    const layerIds = Array.from(this.statusHistory.keys());
    const summary = {
      totalLayers: layerIds.length,
      layersWithFallback: 0,
      layersWithErrors: 0,
      layersWithRealData: 0
    };

    layerIds.forEach(layerId => {
      const latest = this.getLatestStatus(layerId);
      if (latest) {
        if (latest.status === 'fallback' || latest.dataSource === 'fallback') {
          summary.layersWithFallback++;
        }
        if (latest.status === 'error') {
          summary.layersWithErrors++;
        }
        if (latest.dataSource === 'real') {
          summary.layersWithRealData++;
        }
      }
    });

    return summary;
  }

  /**
   * Enable console logging for debugging
   */
  enableDebugLogging(): () => void {
    const unsubscribe = this.subscribe((event) => {
      const icon = {
        loading: '⏳',
        success: '✅',
        error: '❌',
        fallback: '⚠️'
      }[event.status];

      console.log(
        `${icon} Layer Status: ${event.layerId}`,
        `\n  Status: ${event.status}`,
        `\n  Data Source: ${event.dataSource}`,
        event.metadata ? `\n  Metadata:` : '',
        event.metadata || ''
      );
    });

    console.log('🔍 LayerStatusMonitor: Debug logging enabled');
    return unsubscribe;
  }
}

// Export singleton instance
export const layerStatusMonitor = new LayerStatusMonitorAgent();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).layerStatusMonitor = layerStatusMonitor;
}
