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
import { PasswordHash, Username } from '../types'
import { generateSaltAndHashPassword, hashPasswordWithSalt } from './generateHash'

export async function getUsernames(): Promise<Username[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get('usernames', (data) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const usernames: Username[] = data.usernames || []
      resolve(usernames)
    })
  })
}

export async function saveUsername(username: string): Promise<boolean> {
  const config = await getConfig()

  // Don't save usernames that are also saved passwords
  if ((await checkStoredHashes(username)).hashExists) {
    return false
  }

  // If there are configured username patterns, return if the provided username doesn't match any of them
  // This is to prevent users who enter their password as a username from saving their passwords
  if (config.username_regexes.length > 0) {
    if (
      !config.username_regexes.some((regex) => {
        const usernameRegex = new RegExp(regex)
        return usernameRegex.exec(username)
      })
    ) {
      return false
    }
  }

  if (username.length < 2) {
    return false
  }

  let currentUsernames = await getUsernames()
  const usernameExists = currentUsernames.some((currentUsername) => {
    return currentUsername.username === username
  })

  const newUserName = {
    username,
    dateAdded: new Date().getTime(),
  }

  if (usernameExists) {
    // refresh date on username
    currentUsernames = currentUsernames.map((currentUsername) => {
      if (currentUsername.username === username) {
        currentUsername.dateAdded = new Date().getTime()
      }
      return currentUsername
    })
  } else {
    currentUsernames.push(newUserName)
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ usernames: currentUsernames }, () => {
      resolve(true)
    })
  })
}

// TODO: Cache password hashes
export async function getPasswordHashes(): Promise<PasswordHash[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get('passwordHashes', (data) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const hashes: PasswordHash[] = data.passwordHashes || []
      resolve(hashes)
    })
  })
}

export async function checkStoredHashes(password: string) {
  const currentHashes = await getPasswordHashes()

  const mappedHashes = await Promise.all(
    currentHashes.map(async (currentHash) => {
      const newHash = await hashPasswordWithSalt(password, currentHash.salt)
      return currentHash.hash === newHash.hash
    }),
  )

  const hashIndex = mappedHashes.indexOf(true)

  return { hashExists: hashIndex > -1, hashIndex, hash: currentHashes[hashIndex] }
}

export async function getHashDataIfItExists(password: string): Promise<PasswordHash | null> {
  const hashDetails = await checkStoredHashes(password)
  if (hashDetails.hashExists) {
    const currentHashes = await getPasswordHashes()
    return currentHashes[hashDetails.hashIndex]
  }

  return null
}

export async function removeHash(hashToRemove: string) {
  let currentHashes = await getPasswordHashes()

  currentHashes = currentHashes.filter((hash) => {
    return hash.hash !== hashToRemove
  })

  return new Promise((resolve) => {
    chrome.storage.local.set({ passwordHashes: currentHashes }, () => {
      resolve(true)
    })
  })
}

function sanitizeHash(hash: PasswordHash) {
  if (typeof hash.dateAdded !== 'number') {
    hash.dateAdded = new Date().getTime()
  }

  if (!hash.hostname || hash.hostname === 'unknown') {
    hash.hostname = undefined
  }

  if (!hash.username || hash.username === 'unknown') {
    hash.username = undefined
  }

  return hash
}

export function checkForExistingAccount(currentHashes: PasswordHash[], username?: string, hostname?: string) {
  let hashIndex = -1
  if (!username || !hostname) {
    return hashIndex
  }

  currentHashes.forEach((hash, index) => {
    if (hash.username === username && hash.hostname === hostname) {
      hashIndex = index
    }
  })

  return hashIndex
}

export async function hashAndSavePassword(password: string, username?: string, hostname?: string) {
  const currentHashes = (await getPasswordHashes()).map(sanitizeHash)
  const hashDetails = await checkStoredHashes(password)

  if (hashDetails.hashExists) {
    let newUsername = username
    if (!username || username.length < 1) {
      newUsername = currentHashes[hashDetails.hashIndex].username
    }

    currentHashes[hashDetails.hashIndex] = {
      ...currentHashes[hashDetails.hashIndex],
      username: newUsername,
      hostname,
      dateAdded: new Date().getTime(),
    }
  } else {
    const existingAccountIndex = checkForExistingAccount(currentHashes, username, hostname)
    if (existingAccountIndex > -1) {
      currentHashes[existingAccountIndex] = {
        ...currentHashes[existingAccountIndex],
        ...(await generateSaltAndHashPassword(password)),
        dateAdded: new Date().getTime(),
      }
    } else {
      const newHash = await generateSaltAndHashPassword(password)
      const newStoredHashObject: PasswordHash = { ...newHash, dateAdded: new Date().getTime(), username, hostname }
      currentHashes.push(newStoredHashObject)
    }
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ passwordHashes: currentHashes }, () => {
      resolve(true)
    })
  })
}
