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

import * as pbkdf2 from 'pbkdf2'
import { getConfig } from '../config'
import { PasswordHash } from '../types'
import { byteToHex } from './byteToHex'

export async function hashPasswordWithSalt(key: string, salt: string): Promise<PasswordHash> {
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
          dateAdded: new Date(),
        }
        resolve(passwordHash)
      }
    })
  })
}

export async function generateSaltAndHashPassword(key: string): Promise<PasswordHash> {
  const salt = getSalt()
  return hashPasswordWithSalt(key, salt)
}

export function getSalt(): string {
  return byteToHex(window.crypto.getRandomValues(new Uint8Array(16)))
}
