/**
 *
 * The code in this file is injected into the main world context when
 * a user navigates to a Enterprise domain website and the extension is
 * configured to capture Request data in the capture_enterprise_domains
 * property
 *
 * It performs the following actions:
 * 1) wrap fetch to capture the user enterred text in Fetch Request
 * 2) when the URL in configuration match, and the user entered text is found,
 * 2.a) send a message to the content script
 *
 */

import { CaptureConfiguration, CaptureDomainData } from './types'

/**
 * Type guard that validates whether a value matches the CaptureDomainData shape.
 * @param value - The value to validate.
 * @returns True if the value is a valid CaptureDomainData object; otherwise false.
 */
const isCaptureDomainData = function (value: unknown): value is CaptureDomainData {
  if (!value || typeof value !== 'object') {
    return false
  }
  const v = value as Record<string, unknown>
  return (
    typeof v.requestURL === 'string' &&
    (v.requestObjectPath === undefined || typeof v.requestObjectPath === 'string') &&
    (v.responseObjectPath === undefined || typeof v.responseObjectPath === 'string')
  )
}

/**
 * Type guard that validates whether a value matches the CaptureConfiguration shape.
 * @param value - The value to validate.
 * @returns True if the value is a valid CaptureConfiguration object; otherwise false.
 */
const isCaptureConfiguration = function (value: unknown): value is CaptureConfiguration {
  if (!value || typeof value !== 'object') {
    return false
  }
  const newValue = value as Record<string, unknown>
  return typeof newValue.randomEventMessageUUID === 'string' && isCaptureDomainData(newValue.captureInformation)
}

/**
 * Retrieves a nested value from an object using a dot-delimited path.
 * @param obj - The source object to traverse.
 * @param path - Dot-separated path (e.g., "a.b.c").
 * @returns The nested value if present; otherwise `undefined`.
 */
const getNestedValue = function (obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') {
    return undefined
  }
  return path.split('.').reduce<unknown>((acc, part) => {
    if (!acc || typeof acc !== 'object') {
      return undefined
    }
    const record = acc as Record<string, unknown>
    return record[part] !== undefined ? record[part] : undefined
  }, obj)
}

const sendMessageToContentScript = function (userEnteredText: string, randomEventMessageUUID: string): void {
  window.postMessage(
    {
      randomEventMessageUUID,
      userEnteredText,
    },
    '*',
  )
}

/**
 * Inspects fetch parameters to extract configured user-entered text and forward it to the content script.
 * @param captureConfig - Capture configuration containing URL and request object path.
 * @param params - Arguments passed to `fetch`.
 */
const processRequest = function (captureConfig: CaptureConfiguration, params: any): void {
  if (!captureConfig.captureInformation.requestObjectPath) {
    return
  }
  const [requestURL, requestDetails] = params
  const resolvedURL = typeof requestURL === 'string' ? requestURL : requestURL.url
  if (!resolvedURL) {
    return
  }

  const details = requestDetails ?? (requestURL instanceof Request ? requestURL : undefined)
  if (!details || typeof details !== 'object') {
    return
  }
  const requestURLToMatch = captureConfig.captureInformation.requestURL
  if (!requestURL.startsWith(requestURLToMatch)) {
    return
  }

  const body = (details as RequestInit).body
  if (typeof body !== 'string' || body.length > 10_000) {
    return
  }
  if (body[0] !== '{' && body[0] !== '[') {
    return
  }

  try {
    const requestBody = JSON.parse(body)
    const userEnteredText = getNestedValue(requestBody, captureConfig.captureInformation.requestObjectPath)
    if (typeof userEnteredText === 'string' && userEnteredText.length > 0) {
      sendMessageToContentScript(userEnteredText, captureConfig.randomEventMessageUUID)
    }
  } catch (e) {
    console.error(e)
  }
}

/**
 * Wraps the global `fetch` to inspect outgoing requests and capture configured user-entered text.
 * Ensures the wrapper is applied only once by checking a flag.
 * @param captureConfig - Configuration used to decide which requests to inspect.
 */
const wrapFetch = function (captureConfig: CaptureConfiguration) {
  if ((window.fetch as any).__phishcatchWrapped) {
    return
  }
  const myFetch = window.fetch
  const wrapped = function theFetch(...args: [RequestInfo, RequestInit?]) {
    processRequest(captureConfig, args)
    return myFetch.apply(this, args)
  } as typeof window.fetch

  ;(wrapped as any).__phishcatchWrapped = true
  window.fetch = wrapped
}

/**
 * Initializes request-capture by reading configuration from the injected script element,
 * validating it, and wrapping `fetch` when valid.
 */
const start = function () {
  try {
    const scriptElement = document.querySelector<HTMLScriptElement>('script[data-name="capture-requests"]')
    const params = scriptElement?.dataset?.params
    if (!params) {
      return
    }
    const configuration = JSON.parse(params)
    if (!isCaptureConfiguration(configuration)) {
      return
    }
    wrapFetch(configuration)
  } catch (err) {
    console.error('PhistCatch:: Error ')
    console.error(err)
  }
}
start()
