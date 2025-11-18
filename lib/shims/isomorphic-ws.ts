let WebSocketImpl: any

if (typeof window !== "undefined") {
  WebSocketImpl = window.WebSocket
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ws = require("ws")
    WebSocketImpl = ws.WebSocket || ws
  } catch (error) {
    WebSocketImpl = undefined
  }
}

export { WebSocketImpl as WebSocket }
export default WebSocketImpl
