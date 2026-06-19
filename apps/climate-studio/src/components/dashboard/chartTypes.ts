export interface ChartSeries {
  key: string
  label: string
  color: string
  dashed?: boolean
}

export interface ChartDataPoint {
  year: number
  [key: string]: number | string
}
