/**
 *
 * This content script runs in the isloated world and is injected on every site
 * When a user navigates to a Enterprise domain website and the extension is
 * configured to capture Request data in the capture_enterprise_domains
 * property
 *
 */

import { getConfig } from './config'
import { hostMatches } from './lib/getDomainType'
import { getHostFromUrl } from './lib/getHostFromUrl'
import { getSanitizedUrl } from './lib/getSanitizedUrl'
import { UserEnteredTextContent, UserEnteredTextMessage } from './types'

type InjectScriptParams = {
  src: string
  name?: string
  params?: Record<string, unknown>
}

const randomEventMessageUUID = self.crypto.randomUUID()

/**
 * Type guard that validates whether a value matches the UserEnteredTextMessage shape.
 * @param value - The value to validate.
 * @returns True if the value is a valid UserEnteredTextMessage object; otherwise false.
 */
const isUserEnteredTextMessage = (value: any): value is UserEnteredTextMessage => {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.randomEventMessageUUID === 'string' &&
    typeof value.userEnteredText === 'string'
  )
}

/**
 * Handles postMessage events from the injected MAIN-world script.
 * Filters by expected message shape and correlation UUID, then forwards
 * sanitized metadata to the SW.
 * @param event - Window message carrying potential user-entered text data.
 * @returns A promise that resolves once the message is validated and forwarded or skipped.
 */
const messageHandler = async function (event: MessageEvent<unknown>) {
  if (!event) {
    return
  }
  if (!isUserEnteredTextMessage(event.data)) {
    return
  }
  const data = event.data
  if (data.randomEventMessageUUID !== randomEventMessageUUID) {
    return
  }
  const content: UserEnteredTextContent = {
    userEnteredText: data.userEnteredText,
    url: await getSanitizedUrl(location.href),
    referrer: await getSanitizedUrl(document.referrer),
    timestamp: new Date().getTime(),
  }
  chrome.runtime.sendMessage({
    msgtype: 'userenteredtext',
    content,
  })
}

/**
 * Adds a script tag to page to inject an extension script into the main world
 * Passes the provide name and parameters to the injected script.
 * @returns A promise that resolves once injection and listener registration complete.
 */
const injectScriptIntoTabJS = function ({ src, name = '', params = {} }: InjectScriptParams): void {
  const scriptElem = document.createElement('script')
  scriptElem.src = chrome.runtime.getURL(src)
  scriptElem.dataset.params = JSON.stringify(params)
  scriptElem.dataset.name = name

  try {
    ;(document.head || document.documentElement).appendChild(scriptElem)
  } catch (err) {
    console.warn(err)
  }
}

/**
 * Injects the MAIN world fetch-capture script into the page and registers the message handler.
 * Passes the host specifice capture configuration and unique message UUID to the injected script.
 * @returns A promise that resolves once injection and listener registration complete.
 */
const runOnPage = async function (): Promise<void> {
  const host = getHostFromUrl(await getSanitizedUrl(location.href))
  const config = await getConfig()
  const captureInformation = config?.capture_enterprise_domains[host]

  injectScriptIntoTabJS({
    src: 'js/fetchRequestsMain.js',
    name: 'capture-requests',
    params: {
      randomEventMessageUUID,
      captureInformation,
    },
  })

  // process the event messages from the script injected into the Main world
  window.addEventListener('message', messageHandler)
}

/**
 * Determines whether fetch monitoring should run on the current page
 * by checking the sanitized host against configured capture domains.
 * @returns A promise that resolves to true when the host matches a configured domain; otherwise false.
 */
async function shouldCaptureFetchInformation(): Promise<boolean> {
  const host = getHostFromUrl(await getSanitizedUrl(location.href))
  const config = await getConfig()
  const captureDomains = Object.keys(config?.capture_enterprise_domains)
  if (captureDomains.length > 0) {
    return hostMatches(host, captureDomains)
  }
  return false
}

/**
 * Starts fetch monitoring for the current tab when the host matches configured capture domains.
 * Injects the MAIN world page script and registers message handling only when capture is enabled.
 * @returns A promise that resolves once monitoring has been initialized or skipped.
 */
export const startFetchMonitoring = async function (): Promise<void> {
  if (await shouldCaptureFetchInformation()) {
    void runOnPage()
  }
}
