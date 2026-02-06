// Copyright 2021 Palantir Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// MAIN world fetch interceptor. Runs in the page's JavaScript context.
// Configured by monitoring rules received via postMessage from the content script.
// This file is generic — it never contains app-specific code.

(function () {
  'use strict'

  var rules = []

  function extractByPath(obj, path) {
    var current = obj
    for (var i = 0; i < path.length; i++) {
      if (current == null) return undefined
      var key = path[i]
      if (typeof key === 'number') {
        current = key < 0 ? current[current.length + key] : current[key]
      } else {
        current = current[key]
      }
    }
    return current
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return
    if (event.data && event.data.type === 'PHISHCATCH_CONFIGURE') {
      rules = event.data.rules || []
    }
  })

  var originalFetch = window.fetch
  window.fetch = function () {
    var args = arguments
    var input = args[0]
    var init = args.length > 1 ? args[1] : undefined

    if (rules.length > 0) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || ''

        for (var i = 0; i < rules.length; i++) {
          var rule = rules[i]
          var config = rule.fetchConfig
          var method = (config.method || 'POST').toUpperCase()

          if (
            url.indexOf(config.urlPattern) !== -1 &&
            init &&
            (init.method || 'GET').toUpperCase() === method &&
            typeof init.body === 'string'
          ) {
            var body = JSON.parse(init.body)

            // Apply filter if configured
            if (config.filterPath && config.filterValue) {
              var filterResult = extractByPath(body, config.filterPath)
              if (filterResult !== config.filterValue) continue
            }

            // Extract content
            var extracted = extractByPath(body, config.extractPath)
            if (extracted == null) continue

            // Join arrays if configured
            var content =
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
        }
      } catch (e) {
        // Never break the host page
      }
    }

    return originalFetch.apply(this, args)
  }
})()
