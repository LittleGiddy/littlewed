import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const data = await pdfParse(buffer);

    return NextResponse.json({ text: data.text });
  } catch (err) {
    console.error('PDF parsing error:', err);
    return NextResponse.json(
      { error: 'Failed to parse PDF: ' + (err as Error).message },
      { status: 500 }
    );
  }
}