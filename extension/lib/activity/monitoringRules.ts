import { browser } from 'wxt/browser'
import { getConfig } from '../../utils/config'
import { MonitoringRule } from '../../utils/types'

export async function getMonitoringRules(): Promise<MonitoringRule[]> {
  const data = (await browser.storage.local.get('monitoringRules')) as {
    monitoringRules?: MonitoringRule[]
  }
  return data.monitoringRules || []
}

export async function refreshMonitoringRules(): Promise<boolean> {
  const config = await getConfig()
  if (!config.phishcatch_server) return false

  const url = `${config.phishcatch_server}/monitoring-rules`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (response.status !== 200) return false

    const rules: MonitoringRule[] = await response.json()
    if (!Array.isArray(rules)) return false

    await browser.storage.local.set({ monitoringRules: rules })
    return true
  } catch {
    // Backend unreachable — keep using cached rules
    return false
  }
}
