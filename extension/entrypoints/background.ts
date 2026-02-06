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

import { receiveMessage } from '../lib/backgroundLogic'
import { showCheckmarkIfEnterpriseDomain } from '../lib/showCheckmarkIfEnterpriseDomain'
import { timedCleanup } from '../lib/timedCleanup'
import { handleNotificationClick } from '../lib/handleNotificationClick'
import { initConfigListener } from '../utils/config'
import { refreshMonitoringRules } from '../lib/activity/monitoringRules'

export default defineBackground({
  main() {
    initConfigListener()

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    browser.runtime.onMessage.addListener(receiveMessage)
    browser.notifications.onButtonClicked.addListener(handleNotificationClick)

    void showCheckmarkIfEnterpriseDomain()
    timedCleanup()

    void refreshMonitoringRules()
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(refreshMonitoringRules, 30 * 60 * 1000)
  },
})
