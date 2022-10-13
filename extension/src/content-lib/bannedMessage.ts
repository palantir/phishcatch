import { getConfig } from "../config"

const bannedUrlMessage = `
<div>
    <h2>
        This URL has been blocked by Phishcatch.
    </h2>
    <p>
        This page has been determined to be likely to be abused by attackers.
    </p>
    <p>
        Please reach out to infosec with any questions. Do not attempt to circumvent this block without approval.
    </p>
</div>
`

export function setBannedMessage() {
    document.querySelector("html")!.innerHTML = bannedUrlMessage
}

export async function isBannedUrl(url: string) {
    const config = await getConfig()

    const parsedUrl = new URL(url)
    const cleanUrl = parsedUrl.host + parsedUrl.pathname
  
    const isUrlBanned = config.banned_urls.some((bannedUrl) => {
      try {
        const parsedBannedUrl = new URL(bannedUrl)
        const cleanBannedUrl = parsedBannedUrl.host + parsedBannedUrl.pathname
        return cleanUrl === cleanBannedUrl
      }
      catch (e) {
        console.error(e)
        return false
      }
    })
  
    return isUrlBanned
}