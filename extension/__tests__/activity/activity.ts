import * as crypto from 'crypto'
import { setConfigOverride } from '../../utils/config'
import { sendActivity } from '../../lib/activity/sendActivity'
import { getUnsentActivities } from '../../lib/activity/sendActivity'
import { refreshMonitoringRules, getMonitoringRules } from '../../lib/activity/monitoringRules'
import { tryToSendFailedActivities } from '../../lib/timedCleanup'
import { ActivityEvent } from '../../utils/types'

Object.defineProperty(global.self, 'crypto', {
  value: {
    getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
  },
})

const testActivity: ActivityEvent = {
  eventType: 'user_input',
  source: 'chatgpt',
  content: 'Hello, how are you?',
  url: 'https://chatgpt.com',
  timestamp: new Date().getTime(),
}

beforeAll(async () => {
  await setConfigOverride({
    enterprise_domains: [],
    phishcatch_server: `http://localhost:9999`,
    psk: 'testpsk',
    data_expiry: 90,
    display_reuse_alerts: false,
    ignored_domains: [],
  })
})

afterAll(async () => {
  await chrome.storage.local.clear()
})

describe('extractByPath should work correctly', () => {
  // Test the extraction logic used by the MAIN world interceptor
  function extractByPath(obj: any, path: (string | number)[]): any {
    let current = obj
    for (const key of path) {
      if (current == null) return undefined
      if (typeof key === 'number') {
        current = key < 0 ? current[current.length + key] : current[key]
      } else {
        current = current[key]
      }
    }
    return current
  }

  const chatgptBody = {
    messages: [
      { role: 'system', content: { parts: ['System prompt'] } },
      { role: 'user', content: { parts: ['Hello world'] } },
    ],
    model: 'gpt-4o',
  }

  it('Should extract nested values', () => {
    const result = extractByPath(chatgptBody, ['messages', -1, 'content', 'parts'])
    expect(result).toEqual(['Hello world'])
  })

  it('Should extract with negative indices', () => {
    const result = extractByPath(chatgptBody, ['messages', -1, 'role'])
    expect(result).toEqual('user')
  })

  it('Should extract with positive indices', () => {
    const result = extractByPath(chatgptBody, ['messages', 0, 'role'])
    expect(result).toEqual('system')
  })

  it('Should return undefined for missing paths', () => {
    expect(extractByPath(chatgptBody, ['nonexistent'])).toBeUndefined()
    expect(extractByPath(chatgptBody, ['messages', 99])).toBeUndefined()
    expect(extractByPath(chatgptBody, ['messages', -1, 'missing', 'path'])).toBeUndefined()
  })

  it('Should handle null/undefined objects', () => {
    expect(extractByPath(null, ['foo'])).toBeUndefined()
    expect(extractByPath(undefined, ['foo'])).toBeUndefined()
  })

  it('Should extract top-level fields', () => {
    expect(extractByPath(chatgptBody, ['model'])).toEqual('gpt-4o')
  })

  it('Should handle filter paths correctly', () => {
    const filterResult = extractByPath(chatgptBody, ['messages', -1, 'role'])
    expect(filterResult).toEqual('user')
    expect(filterResult === 'user').toBe(true)

    const systemResult = extractByPath(chatgptBody, ['messages', 0, 'role'])
    expect(systemResult === 'user').toBe(false)
  })
})

describe('Activity sending should work', () => {
  it('Activity should be saved to unsent queue on network failure', async () => {
    await sendActivity(testActivity)
    const unsent = await getUnsentActivities()
    expect(unsent.length).toEqual(1)
    expect(unsent[0].activity.content).toEqual('Hello, how are you?')
    expect(unsent[0].activity.source).toEqual('chatgpt')
    expect(unsent[0].activity.psk).toEqual('testpsk')
    expect(unsent[0].tries).toEqual(1)
  })

  it('Retrying failed activities should increment tries', async () => {
    const result = await tryToSendFailedActivities()
    expect(result[0].tries).toEqual(2)
  })

  it('Activity should not be sent when no server is configured', async () => {
    await setConfigOverride({
      enterprise_domains: [],
      phishcatch_server: '',
      psk: '',
      data_expiry: 90,
      display_reuse_alerts: false,
      ignored_domains: [],
    })

    const sent = await sendActivity(testActivity)
    expect(sent).toEqual(false)

    // Restore config
    await setConfigOverride({
      enterprise_domains: [],
      phishcatch_server: 'http://localhost:9999',
      psk: 'testpsk',
      data_expiry: 90,
      display_reuse_alerts: false,
      ignored_domains: [],
    })
  })
})

describe('Monitoring rules should work', () => {
  it('Rules should default to empty array', async () => {
    const rules = await getMonitoringRules()
    expect(Array.isArray(rules)).toBe(true)
    expect(rules.length).toEqual(0)
  })

  it('Rules should be retrievable after storage', async () => {
    const testRules = [
      {
        id: 'chatgpt',
        source: 'chatgpt',
        domains: ['chatgpt.com', 'chat.openai.com'],
        strategy: 'fetch_intercept' as const,
        eventType: 'user_input',
        fetchConfig: {
          urlPattern: '/backend-api/conversation',
          method: 'POST',
          extractPath: ['messages', -1, 'content', 'parts'],
          filterPath: ['messages', -1, 'role'],
          filterValue: 'user',
          join: '\n',
        },
      },
    ]

    await chrome.storage.local.set({ monitoringRules: testRules })
    const rules = await getMonitoringRules()
    expect(rules.length).toEqual(1)
    expect(rules[0].id).toEqual('chatgpt')
    expect(rules[0].domains).toContain('chatgpt.com')
    expect(rules[0].fetchConfig.extractPath).toEqual(['messages', -1, 'content', 'parts'])
  })

  it('Refreshing rules should fail gracefully when server is unreachable', async () => {
    const result = await refreshMonitoringRules()
    expect(result).toEqual(false)
  })
})
