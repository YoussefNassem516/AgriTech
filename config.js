/* Field Shift — chat configuration.
   Leave chatEndpoint EMPTY to use the local assistant (rule-based, not generative AI).
   To enable real AI: deploy worker/chat-proxy.js (Cloudflare Workers), then put its URL here, e.g.
     window.FS_CONFIG={chatEndpoint:"https://field-shift-chat.YOUR-NAME.workers.dev"};
   NEVER put an API key in this file: it is public to every visitor. The key lives only in the Worker's secrets. */
window.FS_CONFIG={chatEndpoint:""};
