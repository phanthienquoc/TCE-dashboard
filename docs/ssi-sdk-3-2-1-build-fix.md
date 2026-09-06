# SSI SDK 3.2.1 build fix

The order-status stream now follows the APIs exposed by `@ssi.developer/ssi-sdk` 3.2.1.

- `onTrading` messages are consumed directly; no unsupported `message.data` access.
- Streaming connects directly; no unsupported `isConnected()` probe.
- Trading authentication and token refresh flow remain unchanged.
