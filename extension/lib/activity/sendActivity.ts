import { browser } from 'wxt/browser'
import { getConfig } from '../../utils/config'
import { ActivityEvent } from '../../utils/types'
import { getId } from '../clientId'

interface ActivityPayload extends ActivityEvent {
  psk: string
  clientId: string
}

interface UnsentActivity {
  activity: ActivityPayload
  tries: number
}

export async function getUnsentActivities(): Promise<UnsentActivity[]> {
  const data = (await browser.storage.local.get('unsentActivities')) as {
    unsentActivities?: UnsentActivity[]
  }
  return data.unsentActivities || []
}

async function saveUnsentActivity(activity: ActivityPayload) {
  const unsentActivities = await getUnsentActivities()
  unsentActivities.push({ activity, tries: 1 })
  await browser.storage.local.set({ unsentActivities })
}

export async function sendActivityToServer(activity: ActivityPayload): Promise<boolean> {
  const config = await getConfig()
  const url = `${config.phishcatch_server}/activity`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity),
    })
    return response.status === 200
  } catch {
    return false
  }
}

export async function sendActivity(event: ActivityEvent): Promise<boolean> {
  const config = await getConfig()
  if (!config.phishcatch_server) return false

  const payload: ActivityPayload = {
    ...event,
    psk: config.psk,
    clientId: await getId(),
  }

  const sent = await sendActivityToServer(payload)
  if (!sent) {
    await saveUnsentActivity(payload)
  }
  return sent
}
