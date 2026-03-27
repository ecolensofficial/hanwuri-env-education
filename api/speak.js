export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-audio-preview',
        messages: [
          {
            role: 'user',
            content: `다음 문장을 한국어로 자연스럽고 밝은 톤으로 읽어주세요. 추가 설명 없이 그대로 읽기만 하세요:\n\n${text}`,
          },
        ],
        modalities: ['text', 'audio'],
        audio: {
          voice: 'shimmer',
          format: 'wav',
        },
        stream: true,
      }),
    });

    // 스트리밍 응답에서 오디오 청크 수집
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let audioChunks = [];
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const json = JSON.parse(line.slice(6));
          const audioData = json.choices?.[0]?.delta?.audio?.data;
          if (audioData) {
            audioChunks.push(audioData);
          }
        } catch (e) {
          // skip parse errors
        }
      }
    }

    if (audioChunks.length > 0) {
      const fullAudio = audioChunks.join('');
      return res.status(200).json({ audio: fullAudio, format: 'wav' });
    }

    return res.status(200).json({ audio: null });
  } catch (error) {
    console.error('TTS Error:', error);
    return res.status(500).json({ audio: null });
  }
}
