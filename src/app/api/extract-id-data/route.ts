import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { image, type } = body;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
       return NextResponse.json({ error: "Missing OPENROUTER_API_KEY in environment variables. Please add it to your .env.local file." }, { status: 500 });
    }

    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    const prompt = type === "child" 
      ? `You are an expert OCR and data extraction AI for Arabic documents.
Given the following image of an Egyptian Birth Certificate or National ID card, extract the following information strictly in JSON format.
If you cannot find a piece of information, return an empty string "" for that field.
Do not include any other text except the JSON.

Expected JSON schema:
{
  "name": "full name in Arabic",
  "nationalId": "14-digit national ID number consisting only of numbers"
}
`
      : `You are an expert OCR and data extraction AI for Arabic documents.
Given the following image of an Egyptian National ID card (Front or Back), extract the following information strictly in JSON format.
If you cannot find a piece of information, return an empty string "" for that field.

CRITICAL INSTRUCTIONS FOR FRONT OF CARD:
1. "name": Extract the FULL NAME in Arabic exactly as written (usually 4 words, below the word "الاسم" or just below the first line which says the first name). DO NOT extract the word "فداء". The name usually comes after it.
2. "nationalId": Extract the 14-digit National ID number at the bottom of the card consisting ONLY of Arabic numerals (e.g. 30407201101392). Translate the numbers to English numerals (e.g. 0123456789). Do NOT extract the alphanumeric code on the bottom left (like IL7... or similar). It MUST be 14 digits long.

CRITICAL INSTRUCTIONS FOR BACK OF CARD:
3. "maritalStatus": commonly it says 'أعزب' (single), 'متزوج' (married), 'مطلق' (divorced), 'أرمل' (widowed). If it's not visible, return ""
4. "employment": Extract the job/profession listed on the back.
5. "address": Extract the full address as written in Arabic.

Do not include any other text except the JSON formatting.

Expected JSON schema:
{
  "name": "full name in Arabic",
  "nationalId": "14-digit national ID number consisting only of numbers",
  "address": "full address as written in Arabic",
  "maritalStatus": "single|married|divorced|widowed|",
  "employment": "job/profession in Arabic"
}
`;

    // Ensure the image string has the correct data URI prefix
    let formattedImage = image;
    if (!image.startsWith("data:image")) {
      formattedImage = `data:image/jpeg;base64,${image.replace(/^data:image\/\w+;base64,/, "")}`;
    }

    const completion = await openai.chat.completions.create({
      model: "openrouter/free", // Best available free model that routes automatically
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: formattedImage,
              },
            }
          ],
        },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    
    // Clean up response text in case it wraps it in markdown like ```json ... ```
    let jsonString = responseText;
    if (jsonString.includes("\`\`\`json")) {
       jsonString = jsonString.split("\`\`\`json")[1].split("\`\`\`")[0].trim();
    } else if (jsonString.includes("\`\`\`")) {
       jsonString = jsonString.split("\`\`\`")[1].split("\`\`\`")[0].trim();
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse extracted JSON output:", responseText);
      return NextResponse.json({ error: "Failed to parse extracted data", raw: responseText }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("Error in extract-id-data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process image with Vision AI" },
      { status: 500 }
    );
  }
}
