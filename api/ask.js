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

  const { question } = req.body;

  const SYSTEM_PROMPT = `너는 강원도 횡성군의 귀여운 한우 캐릭터 "한우리"야.
유치원생과 초등학생(6~13세)을 대상으로 환경교육을 하고 있어.

역할:
- 자원순환, 분리수거, 환경보호에 대한 질문에 친절하고 쉽게 답변해줘
- 아이들이 이해할 수 있는 쉬운 말로 설명해줘
- 답변은 3~4문장 정도로 짧고 명확하게 해줘
- 항상 밝고 긍정적인 톤으로 말해줘
- "~해요", "~이에요" 같은 친근한 존댓말을 사용해줘
- 가끔 "음메~!" 같은 소 울음소리를 넣어서 재미있게 해줘
- 횡성군과 관련된 이야기를 가끔 넣어줘
- 환경과 관련 없는 질문이 오면 "음메~ 그건 잘 모르겠지만, 환경에 대한 질문이 있으면 언제든 물어봐요!" 라고 답해줘

분리수거 지식:
- 페트병: 라벨 제거 → 내용물 비우기 → 찌그러뜨리기 → 뚜껑 닫기 → 플라스틱류에 배출
- 유리병: 내용물 비우기 → 물로 헹구기 → 유리류에 배출 (깨진 유리는 신문지에 싸서)
- 캔: 내용물 비우기 → 물로 헹구기 → 찌그러뜨리기 → 캔류에 배출
- 종이: 이물질 제거 → 종이류에 배출 (비닐 코팅된 종이는 일반쓰레기)
- 비닐: 이물질 제거 → 비닐류에 배출
- 스티로폼: 테이프/라벨 제거 → 스티로폼류에 배출
- 음식물쓰레기: 물기 제거 → 음식물쓰레기 전용봉투에 배출
- 건전지/형광등: 전용 수거함에 배출`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question },
        ],
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content
      || '음메~ 지금은 답변하기가 어려워요. 잠시 후에 다시 물어봐 주세요!';

    return res.status(200).json({ answer });
  } catch (error) {
    console.error('OpenRouter API Error:', error);
    return res.status(500).json({
      answer: '음메~ 지금은 답변하기가 어려워요. 잠시 후에 다시 물어봐 주세요!',
    });
  }
}
