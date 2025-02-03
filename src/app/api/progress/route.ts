import { NextResponse } from "next/server"

const clients: Set<ReadableStreamDefaultController<string>> = new Set()

export async function GET() {
    const stream = new ReadableStream({
        start(controller: ReadableStreamDefaultController<string>) {
            clients.add(controller)
        },
        cancel(controller: ReadableStreamDefaultController<string>) {
            clients.delete(controller)
        },
    })

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    })
}

export async function POST(request: Request) {
    const data = await request.json()

    clients.forEach((client) => {
        client.enqueue(`data: ${JSON.stringify(data)}\n\n`)
    })

    return NextResponse.json({ success: true })
}