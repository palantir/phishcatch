import { Vista, interceptFetch, interceptXHR } from '@rxliuli/vista'

type RequestObserverCallback = (request: Request) => void

export class RequestObserver {

    private readonly callbacks: RequestObserverCallback[] = [];
    private readonly urlFilter: (url: URL) => boolean;

    constructor(urlFilter: (url: URL) => boolean) {
        this.urlFilter = urlFilter;

        // Monkey patch fetch/xhr requests to reliably get the message user submitted
        // onBeforeRequest does not allow POST body content to be read/inspected
        new Vista([interceptFetch, interceptXHR])
            .use(async (c, next) => {
                const url = new URL(c.req.url);

                if (this.urlFilter(url)) {
                    for (const callback of this.callbacks) {
                        callback(c.req);
                    }
                }

                await next()
            })
            .intercept();
    }

    addEventListener(callback: RequestObserverCallback) {
        this.callbacks.push(callback);
    }
}