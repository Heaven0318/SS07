const fail = (status, code, message) => Object.assign(Error(message), { status, code });
export function validate(body) {
  if (!body || Object.keys(body).some(x => x !== 'messages') || !Array.isArray(body.messages) || !body.messages.length || body.messages.length > 12) throw fail(400, 'invalid_request', 'Send between 1 and 12 recent messages.');
  let total = 0;
  for (let i = 0; i < body.messages.length; i++) {
    const m = body.messages[i];
    if (!m || Object.keys(m).some(x => !['role','content'].includes(x)) || m.role !== (i % 2 ? 'assistant' : 'user') || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 4000) throw fail(400, 'invalid_message', 'Messages must alternate visitor and assistant, with 1–4000 characters each.');
    total += m.content.length;
  }
  if (body.messages.at(-1).role !== 'user' || total > 16000) throw fail(400, 'context_limit', 'This question exceeds the conversation limit. Shorten it or Start Over.');
  return body.messages.map(m => ({ role: m.role, content: m.content.trim() }));
}
