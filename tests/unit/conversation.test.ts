import { describe, expect, it } from 'vitest'
import {
  conversationalReply,
  isStructureless,
  matchConversational,
} from '@/server/ai/conversation'
import { parseIntentOffline } from '@/server/ai/intent-offline'
import { OfflineProvider } from '@/server/ai/provider'
import { STARTER_PROMPTS } from '@/components/assistant/starters'

/**
 * The conversational gate sits in front of the search pipeline, so its two
 * failure modes are asymmetric: answering a greeting with twelve products is
 * clumsy, but answering a requirement with small talk loses the buyer. These
 * tests pin both directions.
 */

const provider = new OfflineProvider()

describe('matchConversational — lexicon', () => {
  it('recognizes greetings', () => {
    expect(matchConversational('hi')).toBe('greeting')
    expect(matchConversational('Hello!')).toBe('greeting')
    expect(matchConversational('hey there')).toBe('greeting')
    expect(matchConversational('good morning')).toBe('greeting')
    expect(matchConversational('namaste')).toBe('greeting')
  })

  it('recognizes the other conversational kinds', () => {
    expect(matchConversational('how are you?')).toBe('wellbeing')
    expect(matchConversational('thanks!')).toBe('thanks')
    expect(matchConversational('thank you so much')).toBe('thanks')
    expect(matchConversational('bye')).toBe('farewell')
    expect(matchConversational('what can you do?')).toBe('capability')
    expect(matchConversational('help')).toBe('capability')
    expect(matchConversational('who are you?')).toBe('identity')
  })

  it('never fires inside product words that begin with greeting letters', () => {
    expect(matchConversational('high pressure ball valve')).toBeNull()
    expect(matchConversational('hindustan brand valves')).toBeNull()
    expect(matchConversational('byepass strainer')).toBeNull()
  })

  it('does not treat a request for help finding a product as small talk', () => {
    expect(matchConversational('help me find a pump')).toBeNull()
  })
})

describe('isStructureless', () => {
  it('is true for a bare greeting', () => {
    expect(isStructureless(parseIntentOffline('hi'))).toBe(true)
  })

  it('is false once any product structure appears', () => {
    expect(isStructureless(parseIntentOffline('hi, I need a DN50 stainless valve'))).toBe(false)
    expect(isStructureless(parseIntentOffline('valves under 5000'))).toBe(false)
    expect(isStructureless(parseIntentOffline('need 200 units in stock'))).toBe(false)
  })
})

describe('OfflineProvider.interpret — the gate itself', () => {
  it('chats on a bare greeting and invites a requirement', async () => {
    const result = await provider.interpret('hi')
    expect(result.kind).toBe('chat')
    if (result.kind === 'chat') {
      expect(result.reply.length).toBeGreaterThan(40)
      expect(result.reply).not.toMatch(/[*#_`]/)
    }
  })

  it('chats on meta questions', async () => {
    expect((await provider.interpret('what can you do?')).kind).toBe('chat')
    expect((await provider.interpret('who are you')).kind).toBe('chat')
    expect((await provider.interpret('thanks')).kind).toBe('chat')
  })

  it('searches when a greeting carries a requirement', async () => {
    const result = await provider.interpret('hi, I need a DN50 stainless valve')
    expect(result.kind).toBe('search')
    if (result.kind === 'search') {
      expect(result.intent.categoryKeys).toContain('valves')
    }
  })

  it('searches on unparseable but non-conversational input', async () => {
    expect((await provider.interpret('titanium widget')).kind).toBe('search')
  })

  it('searches every starter prompt', async () => {
    for (const starter of STARTER_PROMPTS) {
      const result = await provider.interpret(starter.query)
      expect(result.kind, `starter "${starter.label}" must search`).toBe('search')
    }
  })
})

describe('conversationalReply', () => {
  it('is deterministic for the same message', () => {
    expect(conversationalReply('greeting', 'hi')).toBe(conversationalReply('greeting', 'hi'))
  })

  it('covers every kind with substantial prose', () => {
    for (const kind of ['greeting', 'wellbeing', 'thanks', 'farewell', 'capability', 'identity'] as const) {
      expect(conversationalReply(kind, 'x').length).toBeGreaterThan(40)
    }
  })
})
