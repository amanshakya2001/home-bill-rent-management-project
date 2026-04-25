const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

async function callOpenAI(messages: object[], maxTokens = 50): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured.');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens: maxTokens, messages }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `OpenAI error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

export async function readMeterFromImage(base64: string): Promise<number | null> {
  const text = await callOpenAI([
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' } },
        { type: 'text', text: 'This is an electricity meter. Read the numeric value shown on the meter display. Return ONLY the number (e.g. "4521"), no units, no text. If you cannot read it clearly, return "null".' },
      ],
    },
  ], 50);

  if (!text || text.toLowerCase() === 'null') return null;
  const reading = parseFloat(text.replace(/[^0-9.]/g, ''));
  return isNaN(reading) ? null : reading;
}

export type BillSplitData = {
  period: string;
  totalAmount: number;
  totalUnits: number;
  perUnit: number;
  ourUnits: number;
  ourAmount: number;
  topFloorUnits: number;
  topFloorAmount: number;
  undergroundUnits: number;
  undergroundAmount: number;
};

export type InsightsData = {
  bills: Array<{ month: number; year: number; units_consumed: number; total_amount: number; status: string }>;
  rents: Array<{ month: number; year: number; amount: number; status: string }>;
};

export async function generateDashboardInsights(data: InsightsData): Promise<string> {
  const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const billLines = data.bills.slice(0, 6).map(b =>
    `${MONTHS_S[b.month - 1]} ${b.year}: ${b.units_consumed} units, ₹${b.total_amount} (${b.status})`
  ).join('\n');
  const rentLines = data.rents.slice(0, 6).map(r =>
    `${MONTHS_S[r.month - 1]} ${r.year}: ₹${r.amount} (${r.status})`
  ).join('\n');

  const prompt = `You are a helpful home expense assistant. Analyze this household data and give 2-3 short practical insights. Plain text only, no bullet symbols, no markdown. 3 sentences max total.\n\nElectricity bills:\n${billLines || 'None'}\n\nRent payments:\n${rentLines || 'None'}`;
  return callOpenAI([{ role: 'user', content: prompt }], 160);
}

export async function generateBillMessage(data: BillSplitData): Promise<string> {
  const raw = `
Electricity bill split for ${data.period}:
Total bill: ₹${data.totalAmount}
Total units: ${data.totalUnits}
Per unit rate: ₹${data.perUnit.toFixed(2)}
Our floor: ${data.ourUnits} units = ₹${data.ourAmount.toFixed(2)}
Top floor: ${data.topFloorUnits} units = ₹${data.topFloorAmount.toFixed(2)}
Underground: ${data.undergroundUnits} units = ₹${data.undergroundAmount.toFixed(2)}
  `.trim();

  const prompt = `Format this electricity bill split into a clear, friendly WhatsApp message. Use WhatsApp bold (*text*) for important numbers. Use relevant emojis. Keep it concise and easy to read. All numbers must be exact as provided. Return ONLY the formatted message.\n\n${raw}`;

  const message = await callOpenAI([{ role: 'user', content: prompt }], 400);
  return message || raw;
}
