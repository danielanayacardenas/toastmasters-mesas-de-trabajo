import { resolve } from "node:path";

const DIST_DIR = resolve(import.meta.dir, "../dist");
const PORT = Number(process.env.PORT ?? 3000);

const MIME_TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
};

function filePathFor(pathname: string): string | null {
    let decoded: string;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        return null;
    }

    const relative = decoded === "/" ? "/index.html" : decoded;
    const candidate = resolve(DIST_DIR, `.${relative}`);
    if (candidate !== DIST_DIR && !candidate.startsWith(`${DIST_DIR}/`)) {
        return null;
    }
    return candidate;
}

const server = Bun.serve({
    port: PORT,
    async fetch(request) {
        const url = new URL(request.url);
        const path = filePathFor(url.pathname);
        if (!path) return new Response("Bad request", { status: 400 });

        const file = Bun.file(path);
        if (!(await file.exists())) return new Response("Not found", { status: 404 });

        const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
        return new Response(file, {
            headers: {
                "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
                "Cache-Control": "no-store",
            },
        });
    },
});

console.log(`Preview Bun disponible en http://localhost:${server.port}`);
