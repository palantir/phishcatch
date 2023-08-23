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

export interface Prefs {
  data_expiry: number
  display_reuse_alerts: boolean
  enable_debug_gui: boolean
  enterprise_domains: string[]
  expire_hash_on_use: boolean
  faq_link: string | null
  hash_truncation_amount: number
  ignored_domains: string[]
  manual_password_entry: boolean
  pbkdf2_iterations: number
  phishcatch_server: string
  psk: string
  repo_link: string | null
  url_sanitization_level: UrlSanitizationEnum
  username_selectors: string[]
  username_regexes: string[]
  banned_urls: string[]
}

export enum UrlSanitizationEnum {
  host = 'host',
  path = 'path',
  none = 'none',
}

export interface PageMessage {
  msgtype: 'username' | 'password' | 'debug' | 'domstring'
  content: PasswordContent | UsernameContent | DomstringContent | string
}

export interface PasswordContent {
  password: string
  save: boolean
  url: string
  referrer: string
  timestamp: number
  username?: string
}

export enum AlertTypes {
  REUSE = 'reuse',
  DOMHASH = 'domhash',
  USERREPORT = 'userreport',
  FALSEPOSITIVE = 'falsepositive',
  PERSONALPASSWORD = 'personalpassword',
}

export interface AlertContent {
  url: string
  referrer: string
  timestamp: number
  alertType: AlertTypes
  associatedUsername?: string
  associatedHostname?: string
}

export interface UsernameContent {
  username: string
  url: string
  dom: string
}

export interface DomstringContent {
  dom: string
  url: string
}

export type DebugContent = string

export interface TLSHInstance {
  update(str: string, length?: number): any
  finale(str?: string, length?: number): any
  hash(): string
  reset(): undefined
  totalDiff(instance: TLSHInstance, len_diff?: number): number
  fromTlshStr(str: string): undefined

  checksum: Uint8Array
  slide_window: Uint8Array
  a_bucket: Uint32Array
  data_len: number
  tmp_code: Uint8Array
  Lvalue: number
  Q: number
  lsh_code: string
  lsh_code_valid: boolean
}

export interface TLSHQuartile {
  q1: number
  q2: number
  q3: number
}

export interface Username {
  username: string
  dateAdded: number
}

export interface PasswordHash {
  hash: string
  salt: string
  dateAdded: number
  username?: string
  hostname?: string
}

export enum PasswordHandlingReturnValue {
  EnterpriseNoSave,
  EnterpriseSave,
  IgnoredDomain,
  NoReuse,
  ReuseAlert,
}

export enum DomainType {
  ENTERPRISE = 'ENTERPRISE',
  IGNORED = 'IGNORED',
  DANGEROUS = 'DANGEROUS',
}

export enum ProtectedRoutes {
  'login.microsoftonline.com' = 'login.microsoftonline.com'
}

export interface DatedDomHash {
  hash: string
  dateAdded: number
  source: string
}

export interface NotificationData {
  id: string
  hash: string
  url: string
}
