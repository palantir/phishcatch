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
const isCaptureDomainData = function (value: any): value is CaptureDomainData {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.requestURL === 'string' &&
    (value.requestObjectPath === undefined || typeof value.requestObjectPath === 'string') &&
    (value.responseObjectPath === undefined || typeof value.responseObjectPath === 'string')
  )
}

/**
 * Type guard that validates whether a value matches the CaptureConfiguration shape.
 * @param value - The value to validate.
 * @returns True if the value is a valid CaptureConfiguration object; otherwise false.
 */
const isCaptureConfiguration = function (value: any): value is CaptureConfiguration {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.randomEventMessageUUID === 'string' &&
    isCaptureDomainData(value.captureInformation)
  )
}

/**
 * Retrieves a nested value from an object using a dot-delimited path.
 * @param obj - The source object to traverse.
 * @param path - Dot-separated path (e.g., "a.b.c").
 * @returns The nested value if present; otherwise `undefined`.
 */
const getNestedValue = function (obj: any, path: string) {
  return path.split('.').reduce((acc, part) => {
    return acc && acc[part] !== undefined ? acc[part] : undefined
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
  if (!Array.isArray(params) || params.length < 2) {
    return
  }
  const requestURLToMatch = captureConfig.captureInformation.requestURL
  const requestURL = params[0]
  const requestDetails = params[1]
  if (typeof requestURL !== 'string' || typeof requestDetails !== 'object') {
    return
  }
  if (!requestURL.startsWith(requestURLToMatch)) {
    return
  }
  const body = requestDetails.body
  if (typeof body !== 'string' || body.length > 10_000) {
    return
  }
  try {
    const requestBody = JSON.parse(body)
    const userEnteredText = getNestedValue(requestBody, captureConfig.captureInformation.requestObjectPath)
    if (userEnteredText) {
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
  const wrapped = function theFetch(...args) {
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
    const scriptElement = document.querySelector('script[data-name="capture-requests"]') as HTMLElement
    if (!scriptElement) {
      console.log('PhistCatch:: No Script element found')
      return
    }
    const { params } = scriptElement.dataset
    if (!params) {
      console.log('PhistCatch:: No parameters found on Script element')
      return
    }
    const configuration = JSON.parse(params)
    if (!isCaptureConfiguration(configuration)) {
      console.log('PhistCatch:: invalid parameters found on Script element', configuration)
      return
    }
    wrapFetch(configuration)
  } catch (err) {
    console.error('PhistCatch:: Error ')
    console.error(err)
  }
}
start()
