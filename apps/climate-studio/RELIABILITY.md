# Climate Layer Reliability System

This document describes the comprehensive reliability system implemented to ensure climate layers always work reliably.

## Overview

The reliability system provides multiple layers of protection against failures:

1. **Automatic Retry Logic** - Retries failed requests with exponential backoff
2. **Circuit Breaker Pattern** - Prevents cascading failures when services are down
3. **Health Monitoring** - Continuously monitors backend service health
4. **Graceful Degradation** - Falls back to cached data when services are unavailable
5. **Automatic Recovery** - Automatically retries failed layers at intervals

## Components

### 1. ClimateLayerReliabilityService

Located in `src/services/climateLayerReliability.ts`, this service provides:

- **Retry Logic**: Automatically retries failed requests up to 3 times with exponential backoff
- **Circuit Breaker**: Opens circuit after 5 failures, attempts recovery after 60 seconds
- **Health Checks**: Monitors backend health every 30 seconds
- **Configurable**: Custom retry configs per layer type

**Key Features:**
- Exponential backoff with jitter to prevent thundering herd
- Retryable status codes: 408, 429, 500, 502, 503, 504
- Retryable errors: ECONNREFUSED, ETIMEDOUT, ENOTFOUND, NetworkError
- Circuit breaker states: closed → open → half-open → closed

### 2. Integration with useClimateLayerData

The `useClimateLayerData` hook now uses the reliability service for all layer fetches:

- All fetch requests go through `fetchWithReliability()`
- Automatic retries on transient failures
- Circuit breaker protection prevents overwhelming failing services
- Health check before attempting fetches

### 3. BackendHealthIndicator Component

Visual indicator showing backend health status:

- Green: Backend healthy (< 1000ms latency)
- Yellow: Backend slow (≥ 1000ms latency)
- Red: Backend unavailable
- Auto-hides when healthy
- Manual refresh button
- Updates every 30 seconds

### 4. Graceful Degradation

When a fetch fails:

1. **First**: Attempts to use cached data if available
2. **Second**: Shows error but preserves previous layer data
3. **Third**: Schedules automatic retry (30s, 1m, 5m intervals)

## Configuration

### Retry Configuration

Default retry config:
```typescript
{
  maxRetries: 3,
  initialDelay: 1000ms,
  maxDelay: 10000ms,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'NetworkError']
}
```

### Circuit Breaker Configuration

```typescript
{
  failureThreshold: 5,      // Open after 5 failures
  successThreshold: 2,      // Close after 2 successes in half-open
  timeout: 60000,            // 60s before attempting half-open
  resetTimeout: 300000       // 5 minutes before full reset
}
```

### Custom Retry Configs Per Layer

You can set custom retry configs for specific layers:

```typescript
climateLayerReliability.setRetryConfig('temperature_projection', {
  maxRetries: 5,
  initialDelay: 2000
});
```

## Usage

### Manual Layer Refresh

When a user manually refreshes a layer, the circuit breaker is reset:

```typescript
refreshLayer(layerId); // Resets circuit breaker and forces fresh fetch
```

### Health Check

Check backend health programmatically:

```typescript
const isHealthy = climateLayerReliability.isBackendHealthy();
const healthStatus = climateLayerReliability.getHealthStatus();
```

### Circuit Breaker State

Check circuit breaker state:

```typescript
const state = climateLayerReliability.getCircuitBreakerState(layerId, url);
// Returns: { state: 'closed' | 'open' | 'half-open', ... }
```

### Reset Circuit Breaker

Manually reset circuit breaker:

```typescript
climateLayerReliability.resetCircuitBreaker(layerId, url);
climateLayerReliability.resetAllCircuitBreakers();
```

## Error Handling Flow

1. **Request Initiated**: Layer fetch starts
2. **Health Check**: Backend health verified (non-blocking)
3. **Circuit Breaker Check**: Verify circuit is not open
4. **Fetch Attempt**: Execute fetch with timeout (60s)
5. **On Failure**:
   - Check if retryable
   - If retryable and retries remaining: wait with exponential backoff, retry
   - If not retryable or retries exhausted: check for cached data
   - If cached data available: use it and schedule retry
   - If no cached data: show error, preserve previous data, schedule automatic retry
6. **On Success**: Record success, close circuit if needed, cache result

## Automatic Recovery

Failed layers automatically retry at increasing intervals:

- **First retry**: 30 seconds
- **Second retry**: 1 minute
- **Third retry**: 5 minutes

After 3 automatic retries, manual refresh is required.

## Monitoring

### Health Checks

- Backend health checked every 30 seconds
- Health status displayed in UI indicator
- Health checks run on window focus

### Logging

All reliability actions are logged:
- `✅` Success indicators
- `⚠️` Warning indicators (retries, slow responses)
- `❌` Error indicators
- `🔄` Retry/Recovery indicators
- `🔴` Circuit breaker opened
- `✅` Circuit breaker closed

## Best Practices

1. **Don't disable circuit breakers** - They prevent cascading failures
2. **Monitor health indicators** - Watch for persistent issues
3. **Use cached data gracefully** - It's better than showing nothing
4. **Let automatic retries work** - Don't manually retry too quickly
5. **Check logs** - Reliability system logs all important events

## Troubleshooting

### Circuit Breaker Stuck Open

If a circuit breaker is stuck open:
```typescript
climateLayerReliability.resetCircuitBreaker(layerId, url);
```

### Backend Health Check Failing

Check:
1. Backend server is running
2. `/health` endpoint is accessible
3. Network connectivity
4. CORS configuration

### Layers Not Retrying

Check:
1. Circuit breaker state
2. Error type (must be retryable)
3. Max retries not exceeded
4. Layer is still active

## Future Enhancements

Potential improvements:
- [ ] Service worker for offline caching
- [ ] Predictive prefetching
- [ ] Adaptive retry delays based on success rate
- [ ] Multi-backend failover
- [ ] Request queuing for rate limiting
- [ ] Metrics and analytics dashboard



