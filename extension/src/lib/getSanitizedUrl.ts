// Copyright 2020 Palantir Technologies
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

import { getConfig } from '../config'
import { UrlSanitizationEnum } from '../types'

export async function getSanitizedUrl(url: string) {
  const config = await getConfig()

  const parsedUrl = new URL(url)

  try {
    if (config.url_sanitization_level === UrlSanitizationEnum.none) {
      return url
    } else if (config.url_sanitization_level === UrlSanitizationEnum.path) {
      return parsedUrl.protocol + '//' + parsedUrl.host + parsedUrl.pathname
    } else {
      return parsedUrl.protocol + '//' + parsedUrl.host
    }
  } catch (e) {
    return ''
  }
}
