/**
 * Climate Layer Reliability Service
 * 
 * Provides robust error handling, retry logic, circuit breakers, and health checks
 * to ensure climate layers always work reliably.
 */

import { ClimateLayerId } from "@climate-studio/core/config";

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
  retryableErrors: string[];
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number | null;
  successCount: number;
  nextAttemptTime: number | null;
}

export interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  timestamp: number;
  error?: string;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5, // Increased for Earth Engine (can be slow)
  initialDelay: 2000, // Longer initial delay for Earth Engine
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'NetworkError', 'Failed to fetch', 'Earth Engine', 'earthengine']
};

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5, // Open circuit after 5 failures
  successThreshold: 2, // Close circuit after 2 successes in half-open
  timeout: 60000, // 60 seconds before attempting half-open
  resetTimeout: 300000 // 5 minutes before full reset
};

export class ClimateLayerReliabilityService {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private retryConfigs: Map<ClimateLayerId, RetryConfig> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private backendBaseUrl: string;

  constructor(backendBaseUrl: string = 'http://localhost:3001') {
    this.backendBaseUrl = backendBaseUrl;
    this.startHealthMonitoring();
  }

  /**
   * Fetch with automatic retry and circuit breaker protection
   */
  async fetchWithReliability(
    layerId: ClimateLayerId,
    url: string,
    options: RequestInit = {},
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<Response> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...customRetryConfig };
    const circuitKey = this.getCircuitKey(layerId, url);

    // Check circuit breaker
    if (!this.canAttemptRequest(circuitKey)) {
      throw new Error(`Circuit breaker is open for ${layerId}. Service may be down.`);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.executeFetch(url, options, circuitKey);

        // Record success
        this.recordSuccess(circuitKey);

        // Check if response is actually successful
        if (!response.ok && this.shouldRetry(response.status, retryConfig)) {
          if (attempt < retryConfig.maxRetries) {
            const delay = this.calculateDelay(attempt, retryConfig);
            console.warn(`⚠️ Retrying ${layerId} (attempt ${attempt + 1}/${retryConfig.maxRetries}) after ${delay}ms`);
            await this.sleep(delay);
            continue;
          }
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;

        // Check if error is retryable
        if (this.isRetryableError(errorMessage, retryConfig) && attempt < retryConfig.maxRetries) {
          const delay = this.calculateDelay(attempt, retryConfig);
          console.warn(`⚠️ Retrying ${layerId} after error (attempt ${attempt + 1}/${retryConfig.maxRetries}): ${errorMessage}`);
          await this.sleep(delay);
          continue;
        }

        // Record failure
        this.recordFailure(circuitKey);

        // If this was the last attempt, throw
        if (attempt === retryConfig.maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error(`Failed to fetch ${layerId} after ${retryConfig.maxRetries} retries`);
  }

  /**
   * Execute a fetch request with timeout
   */
  private async executeFetch(
    url: string,
    options: RequestInit,
    circuitKey: string
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check if we can attempt a request (circuit breaker check)
   */
  private canAttemptRequest(circuitKey: string): boolean {
    const breaker = this.circuitBreakers.get(circuitKey);
    if (!breaker) {
      // Initialize circuit breaker as closed
      this.circuitBreakers.set(circuitKey, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        successCount: 0,
        nextAttemptTime: null
      });
      return true;
    }

    const now = Date.now();

    // If circuit is open, check if we should attempt half-open
    if (breaker.state === 'open') {
      if (breaker.nextAttemptTime && now >= breaker.nextAttemptTime) {
        breaker.state = 'half-open';
        breaker.successCount = 0;
        console.log(`🔄 Circuit breaker for ${circuitKey} entering half-open state`);
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Record a successful request
   */
  private recordSuccess(circuitKey: string): void {
    const breaker = this.circuitBreakers.get(circuitKey);
    if (!breaker) return;

    if (breaker.state === 'half-open') {
      breaker.successCount++;
      if (breaker.successCount >= CIRCUIT_BREAKER_CONFIG.successThreshold) {
        breaker.state = 'closed';
        breaker.failureCount = 0;
        console.log(`✅ Circuit breaker for ${circuitKey} closed - service recovered`);
      }
    } else {
      // Reset failure count on success
      breaker.failureCount = Math.max(0, breaker.failureCount - 1);
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(circuitKey: string): void {
    let breaker = this.circuitBreakers.get(circuitKey);
    if (!breaker) {
      breaker = {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        successCount: 0,
        nextAttemptTime: null
      };
      this.circuitBreakers.set(circuitKey, breaker);
    }

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.state === 'half-open') {
      // Failed in half-open, go back to open
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + CIRCUIT_BREAKER_CONFIG.timeout;
      console.warn(`⚠️ Circuit breaker for ${circuitKey} reopened after failure in half-open state`);
    } else if (breaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      // Too many failures, open circuit
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + CIRCUIT_BREAKER_CONFIG.timeout;
      console.error(`🔴 Circuit breaker for ${circuitKey} opened after ${breaker.failureCount} failures`);
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(errorMessage: string, config: RetryConfig): boolean {
    // Earth Engine specific errors that are retryable
    const earthEngineRetryableErrors = [
      'Earth Engine',
      'earthengine',
      'authentication',
      'quota',
      'rate limit',
      'timeout',
      'temporarily unavailable'
    ];

    const isEarthEngineError = earthEngineRetryableErrors.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isEarthEngineError) {
      return true; // Earth Engine errors are always retryable
    }

    return config.retryableErrors.some(pattern => 
      errorMessage.includes(pattern) || errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if a status code is retryable
   */
  private shouldRetry(status: number, config: RetryConfig): boolean {
    return config.retryableStatuses.includes(status);
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = Math.min(
      config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelay
    );
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker key
   */
  private getCircuitKey(layerId: ClimateLayerId, url: string): string {
    // Use base URL for circuit breaker (not full URL with params)
    const baseUrl = url.split('?')[0];
    return `${layerId}:${baseUrl}`;
  }

  /**
   * Start health monitoring for backend services
   */
  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkBackendHealth();
    }, 30000);

    // Initial health check
    this.checkBackendHealth();
  }

  /**
   * Check backend health
   */
  async checkBackendHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const healthUrl = `${this.backendBaseUrl}/health`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl, {
        signal: controller.signal,
        method: 'GET'
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      const result: HealthCheckResult = {
        healthy: response.ok,
        latency,
        timestamp: Date.now()
      };

      this.healthChecks.set('backend', result);

      if (response.ok) {
        console.log(`✅ Backend health check passed (${latency}ms)`);
      } else {
        console.warn(`⚠️ Backend health check failed: ${response.status}`);
        result.error = `HTTP ${response.status}`;
      }

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const result: HealthCheckResult = {
        healthy: false,
        latency,
        timestamp: Date.now(),
        error: errorMessage
      };

      this.healthChecks.set('backend', result);
      console.error(`❌ Backend health check failed: ${errorMessage}`);

      return result;
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(service: string = 'backend'): HealthCheckResult | null {
    return this.healthChecks.get(service) || null;
  }

  /**
   * Check if backend is healthy
   */
  isBackendHealthy(): boolean {
    const health = this.healthChecks.get('backend');
    if (!health) return true; // Optimistic if not checked yet

    // Consider unhealthy if check failed or is stale (> 2 minutes old)
    const staleThreshold = 120000; // 2 minutes
    const isStale = Date.now() - health.timestamp > staleThreshold;

    return health.healthy && !isStale;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(layerId: ClimateLayerId, url: string): CircuitBreakerState | null {
    const key = this.getCircuitKey(layerId, url);
    return this.circuitBreakers.get(key) || null;
  }

  /**
   * Reset circuit breaker for a layer
   */
  resetCircuitBreaker(layerId: ClimateLayerId, url: string): void {
    const key = this.getCircuitKey(layerId, url);
    this.circuitBreakers.delete(key);
    console.log(`🔄 Circuit breaker reset for ${layerId}`);
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakers.clear();
    console.log('🔄 All circuit breakers reset');
  }

  /**
   * Set custom retry config for a layer
   */
  setRetryConfig(layerId: ClimateLayerId, config: Partial<RetryConfig>): void {
    const current = this.retryConfigs.get(layerId) || DEFAULT_RETRY_CONFIG;
    this.retryConfigs.set(layerId, { ...current, ...config });
  }

  /**
   * Get retry config for a layer
   */
  getRetryConfig(layerId: ClimateLayerId): RetryConfig {
    return this.retryConfigs.get(layerId) || DEFAULT_RETRY_CONFIG;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Singleton instance
const BACKEND_BASE_URL =
  import.meta.env.VITE_NODE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3001';

export const climateLayerReliability = new ClimateLayerReliabilityService(BACKEND_BASE_URL);

