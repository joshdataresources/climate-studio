export type SspScenario = 'ssp245' | 'ssp585'

const RCP_TO_SSP: Record<string, SspScenario> = {
  rcp26: 'ssp245',
  rcp45: 'ssp245',
  rcp60: 'ssp585',
  rcp85: 'ssp585',
  ssp126: 'ssp245',
  ssp245: 'ssp245',
  ssp370: 'ssp585',
  ssp585: 'ssp585',
}

const SSP_TO_RCP: Record<SspScenario, string> = {
  ssp245: 'rcp45',
  ssp585: 'rcp85',
}

/** Map ClimateContext scenario (RCP-style) to JSON projection keys (SSP). */
export function scenarioToSsp(scenario: string): SspScenario {
  return RCP_TO_SSP[scenario] ?? 'ssp245'
}

/** Map SSP dashboard selection back to ClimateContext scenario. */
export function sspToRcp(ssp: SspScenario): string {
  return SSP_TO_RCP[ssp]
}

export const SSP_LABELS: Record<SspScenario, string> = {
  ssp245: 'SSP2-4.5',
  ssp585: 'SSP5-8.5',
}
