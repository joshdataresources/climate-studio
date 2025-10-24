"use client"

import { useClimate } from "../contexts/ClimateContext"
import { useClimateLayerData } from "../hooks/useClimateLayerData"

export function LayerDiagnostics({ bounds }: { bounds: any }) {
  const { activeLayerIds } = useClimate()
  const { layers } = useClimateLayerData(bounds)

  const tempData = layers.temperature_projection

  if (!activeLayerIds.includes('temperature_projection')) {
    return null
  }

  return (
    <div className="w-80 rounded-lg border border-border/60 bg-card/95 backdrop-blur-lg p-4 text-xs">
      <h3 className="font-semibold mb-3 text-sm">🔍 Temperature Layer Diagnostics</h3>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status:</span>
          <span className="font-medium text-foreground">{tempData?.status || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Has Data:</span>
          <span className="font-medium text-foreground">{tempData?.data ? 'YES' : 'NO'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Features:</span>
          <span className="font-medium text-foreground">{tempData?.data?.features?.length || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Error:</span>
          <span className="font-medium text-red-500">{tempData?.error || 'None'}</span>
        </div>

        {tempData?.data?.metadata && (
          <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
            <div className="font-semibold text-foreground">Metadata:</div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-medium text-green-600">{tempData.data.metadata.source}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Is Real:</span>
              <span className="font-medium text-green-600">{String(tempData.data.metadata.isRealData)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data Type:</span>
              <span className="font-medium text-green-600">{tempData.data.metadata.dataType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Count:</span>
              <span className="font-medium text-green-600">{tempData.data.metadata.count}</span>
            </div>
          </div>
        )}

        {tempData?.updatedAt && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated:</span>
              <span className="font-medium text-blue-600">{new Date(tempData.updatedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border/60 text-[10px] text-muted-foreground">
        Check browser console for detailed fetch logs
      </div>
    </div>
  )
}
