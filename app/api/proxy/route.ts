import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { url, method, headers, body } = await req.json();

        const response = await fetch(url, {
            method: method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(body)
        });

        // Handle streaming vs non-streaming
        if (body.stream) {
            // For streaming, we need to proxy the stream. 
            // This is complex for a simple proxy. For now, let's just return the response if not streaming
            // Or implement basic stream proxying
            const reader = response.body?.getReader();
            const stream = new ReadableStream({
                async start(controller) {
                    while (true) {
                        const { done, value } = await reader!.read();
                        if (done) break;
                        controller.enqueue(value);
                    }
                    controller.close();
                }
            });
            return new NextResponse(stream, {
                status: response.status,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                }
            });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
