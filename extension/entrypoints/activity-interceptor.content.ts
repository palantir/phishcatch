// MAIN world fetch interceptor. Runs in the page's JavaScript context.
// Registered as a content script with world: 'MAIN' so Chrome injects it
// directly, bypassing the page's CSP (which blocks <script> tag injection).
// Configured by monitoring rules received via postMessage from the ISOLATED
// world content script (activity-monitor.content.ts).

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const rules: any[] = []

    function extractByPath(obj: any, path: (string | number)[]): any {
      let current = obj
      for (let i = 0; i < path.length; i++) {
        if (current == null) return undefined
        const key = path[i]
        if (typeof key === 'number') {
          current = key < 0 ? current[current.length + key] : current[key]
        } else {
          current = current[key]
        }
      }
      return current
    }

    function processBody(body: any, config: any, rule: any) {
      if (config.filterPath && config.filterValue) {
        if (extractByPath(body, config.filterPath) !== config.filterValue) return
      }

      const extracted = extractByPath(body, config.extractPath)
      if (extracted == null) return

      const content =
        Array.isArray(extracted) && config.join != null
          ? extracted.join(config.join)
          : String(extracted)

      window.postMessage(
        {
          type: 'PHISHCATCH_ACTIVITY',
          source: rule.source,
          eventType: rule.eventType,
          content: content,
        },
        '*',
      )
    }

    window.addEventListener('message', (event) => {
      if (event.source !== window) return
      if (event.data && event.data.type === 'PHISHCATCH_CONFIGURE') {
        rules.length = 0
        const incoming = event.data.rules || []
        for (let i = 0; i < incoming.length; i++) {
          rules.push(incoming[i])
        }
      }
    })

    const originalFetch = window.fetch
    window.fetch = function (...args: any[]) {
      const input = args[0]
      const init = args.length > 1 ? args[1] : undefined

      // Handle both fetch(url, init) and fetch(request) calling conventions.
      // When a Request object is passed as the first argument, method/body
      // live on the Request, not in a separate init parameter.
      const isRequest = input instanceof Request
      const url = typeof input === 'string' ? input : (input && input.url) || ''
      const reqMethod = (init?.method || (isRequest ? input.method : null) || 'GET').toUpperCase()

      if (rules.length > 0) {
        try {
          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i]
            const config = rule.fetchConfig
            const method = (config.method || 'POST').toUpperCase()

            if (url.indexOf(config.urlPattern) === -1 || reqMethod !== method) continue

            // Get body from init (fetch(url, {body})) or from Request clone
            if (init && typeof init.body === 'string') {
              processBody(JSON.parse(init.body), config, rule)
            } else if (isRequest) {
              // Body is on the Request object — clone and read asynchronously.
              const cloned = input.clone()
              cloned.text().then((text: string) => {
                try {
                  processBody(JSON.parse(text), config, rule)
                } catch (e) {
                  // Body wasn't JSON — skip
                }
              }).catch(() => {})
            }
          }
        } catch (e) {
          // Never break the host page
        }
      }

      return originalFetch.apply(this, args as any)
    } as typeof fetch
  },
})
