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

import { getConfig } from '../config'
import { DomainType } from '../types'
import { escapeRegExp } from './escapeRegExp'

// https://stackoverflow.com/questions/2814002/private-ip-address-identifier-in-regular-expression/2814102#2814102
const ipRegexp = new RegExp(
  `^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$`,
)
const RFC1918 = new RegExp(`(^127\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^192\.168\.)`)
const localhostRegexp = new RegExp(`^localhost(:\\d*)?$`)
const starRegexp = new RegExp(`^\\*\\..*`)

function isLocal(host: string) {
  if (ipRegexp.test(host)) {
    return RFC1918.test(host)
  } else {
    return localhostRegexp.test(host)
  }
}

function hostMatches(host: string, domainList: string[]) {
  return domainList.some((domain) => {
    if (domain === host) {
      return true
    }
    if (starRegexp.test(domain)) {
      const domainWithoutStar = domain.replace('*.', '')
      if (host === domainWithoutStar) {
        return true
      }

      const escapedDomainWithoutStar = escapeRegExp(domainWithoutStar)
      const mainDomainRegex = new RegExp(`.*?\\.${escapedDomainWithoutStar}$`)
      return mainDomainRegex.test(host)
    }

    return false
  })
}

async function isIgnoredDomain(host: string): Promise<boolean> {
  const config = await getConfig()
  return hostMatches(host, config.ignored_domains) || isLocal(host)
}

async function isEnterpriseDomain(host: string): Promise<boolean> {
  const config = await getConfig()
  return hostMatches(host, config.enterprise_domains)
}

export async function getDomainType(host: string) {
  if (await isEnterpriseDomain(host)) {
    return DomainType.ENTERPRISE
  } else if (await isIgnoredDomain(host)) {
    return DomainType.IGNORED
  } else {
    return DomainType.DANGEROUS
  }
}
