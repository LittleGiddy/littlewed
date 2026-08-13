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

    // Parse PDF with options to preserve layout
    const data = await pdfParse(buffer, {
      // Try to preserve table structure
      pagerender: (pageData: any) => {
        return pageData.getTextContent({
          includeMarkedContent: true,
          disableCombineTextItems: false,
        }).then((textContent: any) => {
          let lastY: number | null = null;
          let text = '';
          
          for (const item of textContent.items) {
            const y = Math.round(item.transform[5]);
            // Add new line if y position changed (new row)
            if (lastY !== null && Math.abs(y - lastY) > 3) {
              text += '\n';
            }
            text += item.str + ' ';
            lastY = y;
          }
          return text;
        });
      },
    });

    // Log for debugging
    console.log('PDF text extracted (first 500 chars):', data.text.substring(0, 500));

    return NextResponse.json({ text: data.text });
  } catch (err) {
    console.error('PDF parsing error:', err);
    return NextResponse.json(
      { error: 'Failed to parse PDF: ' + (err as Error).message },
      { status: 500 }
    );
  }
}