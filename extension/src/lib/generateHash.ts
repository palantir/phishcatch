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

import * as pbkdf2 from 'pbkdf2'
import { getConfig } from '../config'
import { byteToHex } from './byteToHex'

export interface ContextlessPasswordHash {
  hash: string
  salt: string
}

export async function hashPasswordWithSalt(key: string, salt: string): Promise<ContextlessPasswordHash> {
  const config = await getConfig()

  const iterations = config.pbkdf2_iterations
  const keylen = 64
  const hashType = 'sha512'

  return new Promise((resolve, reject) => {
    if (!salt || salt.length < 32) {
      reject(`No/bad salt! This is unsafe.`)
    }

    pbkdf2.pbkdf2(key, salt, iterations, keylen, hashType, (err, derivedKey) => {
      if (err) {
        reject(err)
      } else {
        const hash = derivedKey.toString('hex')

        const passwordHash = {
          hash,
          salt,
        }
        resolve(passwordHash)
      }
    })
  })
}

export async function generateSaltAndHashPassword(key: string): Promise<ContextlessPasswordHash> {
  const salt = getSalt()
  return hashPasswordWithSalt(key, salt)
}

export function getSalt(): string {
  return byteToHex(window.crypto.getRandomValues(new Uint8Array(16)))
}
