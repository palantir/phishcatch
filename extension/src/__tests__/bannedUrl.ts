import { setConfigOverride } from "../config"
import { isBannedUrl } from "../content-lib/bannedMessage"

beforeAll(async () => {
    await setConfigOverride({
        enterprise_domains: [],
        phishcatch_server: '',
        psk: '',
        data_expiry: 90,
        display_reuse_alerts: true,
        ignored_domains: [],
        banned_urls: ["http://www.google.com/search"]
    })
})

afterAll((done) => {
    chrome.storage.local.clear(done)
})

const bannedUrl = "https://www.google.com/search?q=ejfef&source=hp&ei=1dxHY4HKCsqG0PEP-c6Z0AI&iflsig=AJiK0e8AAAAAY0fq5QFfK3cBvHWekSPp8Vsr91xUnho_&ved=0ahUKEwjBiI_L9Nz6AhVKAzQIHXlnBioQ4dUDCAk&uact=5&oq=ejfef&gs_lcp=Cgdnd3Mtd2l6EAMyEAguEIAEELEDEIMBENQCEA0yEAguEIAEELEDEIMBENQCEA0yCgguEIAEELEDEA0yDQguEIAEELEDEIMBEA0yCgguEIAEELEDEA0yDQguEIAEEMcBEK8BEA0yBwgAEIAEEA0yDQguEIAEELEDENQCEA0yDQguEIAEELEDEIMBEA0yBwgAEIAEEA1QAFgAYPwDaABwAHgAgAFFiAFFkgEBMZgBAKABAqABAQ&sclient=gws-wiz"
const anotherBannedUrl = "https://www.google.com/search"

const nonBannedUrl = "https://www.bing.com/search"
const anotherNonBannedUrl = "https://www.google.com/preferences?hl=en&fg=1"

describe('Banned Urls should be banned', () => {
    it('Banned urls should be banned', async () => {
        expect(await isBannedUrl(bannedUrl)).toBe(true)
        expect(await isBannedUrl(anotherBannedUrl)).toBe(true)
    })

    it('Non-banned urls should not be banned', async () => {
        expect(await isBannedUrl(nonBannedUrl)).toBe(false)
        expect(await isBannedUrl(anotherNonBannedUrl)).toBe(false)
    })
})
