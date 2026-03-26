#!/usr/bin/env node

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

function maskKey(key = '') {
  if (!key) return '(empty)';
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

async function main() {
  const inputKey = process.argv[2] || process.env.GROQ_API_KEY || '';
  const key = inputKey.trim();

  if (!key) {
    console.error('Missing Groq API key.');
    console.error('Usage: GROQ_API_KEY=your_key node scripts/test_groq_key.js');
    console.error('   or: node scripts/test_groq_key.js your_key');
    process.exit(1);
  }

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: 'Reply with exactly this JSON and nothing else: {"status":"ok"}'
          }
        ]
      })
    });

    const rawText = await response.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (error) {
      data = null;
    }

    const elapsed = Date.now() - startedAt;
    console.log(`Provider: groq`);
    console.log(`Model: ${DEFAULT_MODEL}`);
    console.log(`Key: ${maskKey(key)}`);
    console.log(`HTTP: ${response.status}`);
    console.log(`Time: ${elapsed}ms`);

    if (!response.ok) {
      const message = data?.error?.message || data?.message || rawText || 'Unknown error';
      console.log('Usable: NO');
      console.log(`Reason: ${message}`);
      process.exit(2);
    }

    const reply = data?.choices?.[0]?.message?.content?.trim() || '';
    console.log('Usable: YES');
    console.log(`Reply: ${reply}`);
  } catch (error) {
    console.log('Provider: groq');
    console.log(`Model: ${DEFAULT_MODEL}`);
    console.log(`Key: ${maskKey(key)}`);
    console.log('Usable: NO');
    console.log(`Reason: ${error.message}`);
    process.exit(3);
  }
}

main();
