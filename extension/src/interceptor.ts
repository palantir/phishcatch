import { RequestObserver } from './lib/requestObserver'
import { HttpMethod, PageMessage } from './types';

const chatGPTRequestObserver = new RequestObserver(url => url.pathname.endsWith("conversation") && url.host === "chatgpt.com");

type ChatGPTRole = "user";
type ChatGPTContentType = "text";

type ChatGPTAuthor = {
    role: ChatGPTRole;
}

type ChatGPTMessageContent = {
    content_type: ChatGPTContentType;
    parts: string[];
}

type ChatGPTMessage = {
    author: ChatGPTAuthor;
    content: ChatGPTMessageContent;

}
type ChatGPTConversationRequest = {
    messages: ChatGPTMessage[]
}

chatGPTRequestObserver.addEventListener(async (request) => {
    try {
        // Request body can only be read once, clone to avoid issues
        const clonedRequest = request.clone();

        // Be nice to do schema validation with Zod or simliar vs just casting
        const conversationRequest = await clonedRequest.json() as ChatGPTConversationRequest;

        // Not sure if there can be more than one mesasge from the user here.  Defensively filter by
        // user in case there can be multiple
        // Assuming if images are attached the content type will be different
        const userInputs = conversationRequest.messages.filter(m => m.author.role === "user" && m.content.content_type === "text").flatMap(m => m.content.parts);

        // Do we need to do any sanitization on user inputs?  For example, if the user inputs a full SSN, should it be masked to send over XXX-XXX-1234?
        const message: PageMessage = {
            msgtype: "conversation",
            content: {
                request: {
                    url: clonedRequest.url,
                    method: clonedRequest.method as HttpMethod,
                },
                userInputs
            }
        }

        // Would be nice to use something like webext messenger for typesafe messages across boundaries
        // For now use discriminated union
        // NOTE: MAIN world content scripts don't have access to chrome.runtime APIs
        // Use window.postMessage to proxy request to: isolated world content script -> service worker
        window.postMessage({
            source: 'phishcatch-proxy-request',
            message
        }, '*');
    } catch (error) {
        // It would be nice to send back errors here so we can proactively 
        // monitor/change any logic.  ChatGPT could change their response object which could cause 
        // this listener to throw.  
        throw error;
    }
});