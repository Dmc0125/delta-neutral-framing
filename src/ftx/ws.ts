import WebSocket from 'ws'
import crypto from 'node:crypto'

import { FTX_API_KEY, FTX_API_SECRET, FTX_SUBACCOUNT } from '../env.js'

const ws = new WebSocket('wss://ftx.com/ws/')

enum Channel {
  Ticker = 'ticker',
  Fills = 'fills',
}

type WsMessage = {
  channel: Channel
  type: string
}

type WsTickerMessage = WsMessage & {
  market: string
  data: {
    bid: number
    ask: number
    bidSize: number
    askSize: number
    last: number
    time: number
  }
}

type WsFillsMessage = WsMessage & {
  data: {
    fee: number
    feeRate: number
    future: string
    id: number
    liquidity: string
    market: string
    orderId: number
    tradeId: number
    price: number
    side: string
    size: number
    time: string
    type: string
  }
}

type WsMessages = {
  ticker: WsTickerMessage
  fills: WsFillsMessage
}

type Handlers = {
  ticker: ((data: WsMessages['ticker']) => void) | null
  fills: ((data: WsMessages['fills']) => void) | null
}

const handlers: Handlers = {
  ticker: null,
  fills: null,
}

// Handle message
ws.on('message', (data) => {
  try {
    const parsed = JSON.parse(data.toString()) as WsMessage
    if (parsed.type === 'update') {
      switch (parsed.channel) {
        case 'ticker': {
          if (handlers.ticker) {
            handlers.ticker(parsed as WsTickerMessage)
          }
          break
        }
        case 'fills': {
          if (handlers.fills) {
            handlers.fills(parsed as WsFillsMessage)
          }
        }
      }
      return
    }
  
    if (parsed.type === 'error' && 'code' in parsed) {
      const _msg = parsed as (typeof parsed & { code: number; msg: string })
      if (_msg.code === 400) {
        console.error('[WEBSOCKET ERROR]:', _msg.msg)
        process.exit(0)
      }
    }
  } catch (error) {
    console.error(error)
  }
})

// Authenticate
ws.on('open', () => {
  const ts = new Date().getTime()
  const signature = crypto.createHmac('sha256', FTX_API_SECRET).update(`${ts}websocket_login`).digest('hex')
  ws.send(JSON.stringify({
    args: {
      key: FTX_API_KEY,
      time: ts,
      sign: signature,
      subaccount: FTX_SUBACCOUNT,
    },
    op: 'login',
  }))
})

type SubscribeMessageData<C extends Channel> = {
  channel: C
} | {
  channel: C
  market: string
}

const subscribeToChannel = <C extends Channel>(
  subscribeMessageData: SubscribeMessageData<C>,
  onMsg: Handlers[C],
) => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      op: 'subscribe',
      ...subscribeMessageData,
    }))
  } else {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        op: 'subscribe',
        ...subscribeMessageData,
      }))
    })
  }

  handlers[subscribeMessageData.channel] = onMsg

  const unsub = () => {
    ws.send(JSON.stringify({
      op: 'unsubscribe',
      ...subscribeMessageData,
    }))
  }

  return unsub
}

export const subscribeToTicker = (symbol: string) => {
  const highestAsk = { value: 0 }
  const unsub = subscribeToChannel({
    channel: Channel.Ticker,
    market: `${symbol.toUpperCase()}-PERP`,
  }, (msg) => {
    highestAsk.value = msg.data.ask
  })
  return {
    unsub,
    highestAsk,
  }
}

export const subscribeToFills = () => {
  const filledSize = { value: 0 }
  const unsub = subscribeToChannel({
    channel: Channel.Fills,
  }, (msg) => {
    filledSize.value += msg.data.size
  })
  return {
    unsub,
    filledSize,
  }
}
