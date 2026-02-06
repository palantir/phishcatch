import { ActivityEvent, MonitoringRule } from '../utils/types'

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  main() {
    function domainMatchesPattern(hostname: string, pattern: string): boolean {
      if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(2)
        return hostname === suffix || hostname.endsWith('.' + suffix)
      }
      return hostname === pattern
    }

    function getMatchingRules(rules: MonitoringRule[], hostname: string): MonitoringRule[] {
      return rules.filter((rule) =>
        rule.domains.some((domain) => domainMatchesPattern(hostname, domain)),
      )
    }

    async function init() {
      const data = (await browser.storage.local.get('monitoringRules')) as {
        monitoringRules?: MonitoringRule[]
      }
      const rules = data.monitoringRules || []
      if (rules.length === 0) return

      const matchingRules = getMatchingRules(rules, window.location.hostname)
      if (matchingRules.length === 0) return

      const fetchRules = matchingRules.filter((r) => r.strategy === 'fetch_intercept')
      if (fetchRules.length === 0) return

      // Inject the MAIN world fetch interceptor
      const script = document.createElement('script')
      script.src = browser.runtime.getURL('/activity-interceptor.js' as any)
      script.onload = () => script.remove()
      document.documentElement.appendChild(script)

      // Configure the interceptor with matching rules
      window.postMessage(
        {
          type: 'PHISHCATCH_CONFIGURE',
          rules: fetchRules.map((r) => ({
            source: r.source,
            eventType: r.eventType,
            fetchConfig: r.fetchConfig,
          })),
        },
        '*',
      )

      // Listen for intercepted activity from the MAIN world
      window.addEventListener('message', (event) => {
        if (event.source !== window) return
        if (event.data?.type !== 'PHISHCATCH_ACTIVITY') return

        const activity: ActivityEvent = {
          eventType: event.data.eventType,
          source: event.data.source,
          content: event.data.content,
          url: window.location.origin,
          timestamp: Date.now(),
          metadata: event.data.metadata,
        }

        browser.runtime.sendMessage({
          msgtype: 'activity',
          content: activity,
        })
      })
    }

    void init()
  },
})
