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
          format: 'pcm16',
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
      // pcm16 base64 청크를 합치고 WAV 헤더 추가
      const pcmBase64 = audioChunks.join('');
      const pcmBuffer = Buffer.from(pcmBase64, 'base64');

      const sampleRate = 24000;
      const numChannels = 1;
      const bitsPerSample = 16;
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      const blockAlign = numChannels * (bitsPerSample / 8);
      const dataSize = pcmBuffer.length;
      const headerSize = 44;

      const wavBuffer = Buffer.alloc(headerSize + dataSize);
      // RIFF header
      wavBuffer.write('RIFF', 0);
      wavBuffer.writeUInt32LE(36 + dataSize, 4);
      wavBuffer.write('WAVE', 8);
      // fmt chunk
      wavBuffer.write('fmt ', 12);
      wavBuffer.writeUInt32LE(16, 16);
      wavBuffer.writeUInt16LE(1, 20); // PCM
      wavBuffer.writeUInt16LE(numChannels, 22);
      wavBuffer.writeUInt32LE(sampleRate, 24);
      wavBuffer.writeUInt32LE(byteRate, 28);
      wavBuffer.writeUInt16LE(blockAlign, 32);
      wavBuffer.writeUInt16LE(bitsPerSample, 34);
      // data chunk
      wavBuffer.write('data', 36);
      wavBuffer.writeUInt32LE(dataSize, 40);
      pcmBuffer.copy(wavBuffer, 44);

      const wavBase64 = wavBuffer.toString('base64');
      return res.status(200).json({ audio: wavBase64, format: 'wav' });
    }

    return res.status(200).json({ audio: null });
  } catch (error) {
    console.error('TTS Error:', error);
    return res.status(500).json({ audio: null });
  }
}
