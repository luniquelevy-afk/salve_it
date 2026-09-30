import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NVIDIA_API_KEY = 'nvapi-test';
process.env.AI_PROVIDER = 'nvidia';

const { extractJson, nvidiaProvider, toNvidiaMessages } = await import('../src/services/ai-nvidia.js');
const { AiError } = await import('../src/services/ai-types.js');

function reply(content: string, status = 200) {
  const body = status === 200 ? { choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 30 } } : content;
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('extractJson', () => {
  it('ignore le raisonnement et les blocs de code', () => {
    expect(extractJson('<think>je réfléchis</think>\n```json\n{"message":"Bonjour","end_interview":false}\n```')).toEqual({ message: 'Bonjour', end_interview: false });
  });
  it('rejette une réponse sans JSON', () => {
    expect(() => extractJson('Bonjour !')).toThrow(AiError);
  });
});

describe('toNvidiaMessages', () => {
  it('rejoue le JSON brut des tours de l’agent', () => {
    const messages = toNvidiaMessages([
      { role: 'user', text: 'Bonjour' },
      { role: 'assistant', text: 'Présentez-vous.', raw: { provider: 'nvidia', data: '{"message":"Présentez-vous.","end_interview":false}' } },
      { role: 'assistant', text: 'Autre fournisseur', raw: { provider: 'gemini', data: [] } },
    ]);
    expect(messages).toEqual([
      { role: 'user', content: 'Bonjour' },
      { role: 'assistant', content: '{"message":"Présentez-vous.","end_interview":false}' },
      { role: 'assistant', content: '{"message":"Autre fournisseur","end_interview":false}' },
    ]);
  });
});

describe('nvidiaProvider', () => {
  it('appelle /chat/completions avec la clé et le schéma, et renvoie le tour validé', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"message":"Pourquoi l’Italie ?","end_interview":false}'));
    const turn = await nvidiaProvider.runConsulTurn([{ role: 'user', text: 'Bonjour' }]);
    expect(turn).toMatchObject({ message: 'Pourquoi l’Italie ?', endInterview: false, apiContent: { provider: 'nvidia' } });
    expect(turn.usage).toMatchObject({ inputTokens: 120, outputTokens: 30 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer nvapi-test');
    const body = JSON.parse(init.body as string);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.messages[0].role).toBe('system');
  });

  it('relance une fois avec l’erreur quand la réponse est hors schéma', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"texte":"oups"}')).mockResolvedValueOnce(reply('{"message":"Parlez-moi de votre projet.","end_interview":false}'));
    const turn = await nvidiaProvider.runConsulTurn([{ role: 'user', text: 'Bonjour' }]);
    expect(turn.message).toBe('Parlez-moi de votre projet.');
    expect(turn.usage.inputTokens).toBe(240);
    const retryBody = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(retryBody.messages.at(-1).content).toMatch(/Réponse non conforme/);
  });

  it('retire response_format si le modèle le refuse', async () => {
    fetchMock.mockResolvedValueOnce(reply('response_format json_schema is not supported', 400)).mockResolvedValueOnce(reply('{"message":"Bonjour","end_interview":false}'));
    await nvidiaProvider.runConsulTurn([{ role: 'user', text: 'Bonjour' }]);
    const secondBody = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(secondBody.response_format).toBeUndefined();
  });

  it('traduit les erreurs HTTP', async () => {
    fetchMock.mockResolvedValue(reply('trop de requêtes', 429));
    await expect(nvidiaProvider.runConsulTurn([{ role: 'user', text: 'x' }])).rejects.toMatchObject({ kind: 'rate_limited' });
    fetchMock.mockResolvedValue(reply('clé invalide', 401));
    await expect(nvidiaProvider.runConsulTurn([{ role: 'user', text: 'x' }])).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
