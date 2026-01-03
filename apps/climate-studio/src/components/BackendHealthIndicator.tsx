/**
 * Backend Health Indicator Component
 * 
 * Shows the health status of backend services and provides
 * automatic recovery mechanisms.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import { climateLayerReliability } from '../services/climateLayerReliability';

interface HealthStatus {
  healthy: boolean;
  latency: number;
  timestamp: number;
  error?: string;
}

export function BackendHealthIndicator() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const result = await climateLayerReliability.checkBackendHealth();
      setHealth(result);
      
      // Show indicator if unhealthy or if latency is high
      if (!result.healthy || result.latency > 2000) {
        setIsVisible(true);
      } else {
        // Auto-hide after 3 seconds if healthy
        setTimeout(() => setIsVisible(false), 3000);
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth({
        healthy: false,
        latency: 0,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setIsVisible(true);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    // Also check when window regains focus
    const handleFocus = () => {
      checkHealth();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Get current health from service
  useEffect(() => {
    const currentHealth = climateLayerReliability.getHealthStatus();
    if (currentHealth) {
      setHealth(currentHealth);
      if (!currentHealth.healthy || currentHealth.latency > 2000) {
        setIsVisible(true);
      }
    }
  }, []);

  if (!health || !isVisible) {
    return null;
  }

  const getStatusIcon = () => {
    if (health.healthy && health.latency < 1000) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    } else if (health.healthy && health.latency >= 1000) {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusText = () => {
    if (health.healthy && health.latency < 1000) {
      return 'Backend healthy';
    } else if (health.healthy && health.latency >= 1000) {
      return `Backend slow (${health.latency}ms)`;
    } else {
      return 'Backend unavailable';
    }
  };

  const getStatusColor = () => {
    if (health.healthy && health.latency < 1000) {
      return 'bg-green-500/10 border-green-500/50 text-green-400';
    } else if (health.healthy && health.latency >= 1000) {
      return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400';
    } else {
      return 'bg-red-500/10 border-red-500/50 text-red-400';
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${getStatusColor()} border rounded-lg p-3 shadow-lg backdrop-blur-sm min-w-[200px]`}>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <div className="flex-1">
          <div className="text-sm font-medium">{getStatusText()}</div>
          {health.latency > 0 && (
            <div className="text-xs opacity-75">
              Latency: {health.latency}ms
            </div>
          )}
          {health.error && (
            <div className="text-xs opacity-75 mt-1">
              {health.error}
            </div>
          )}
        </div>
        <button
          onClick={checkHealth}
          disabled={isChecking}
          className="p-1 hover:opacity-75 transition-opacity disabled:opacity-50"
          title="Refresh health check"
        >
          <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}



