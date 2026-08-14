import { NextResponse } from "next/server";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = "public/uploads";

/**
 * POST /api/upload/clear - Delete all files in public/uploads for a fresh session.
 * Call when call ends, timer expires, or user logs out.
 */
export async function POST() {
  try {
    const dir = path.join(process.cwd(), UPLOAD_DIR);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") return NextResponse.json({ cleared: 0 });
      throw err;
    }

    const files = entries.filter(
      (e) => e !== "." && e !== ".." && !e.startsWith(".")
    );
    for (const file of files) {
      const filePath = path.join(dir, file);
      await unlink(filePath);
    }

    return NextResponse.json({ cleared: files.length });
  } catch (err) {
    console.error("[upload/clear]", err);
    return NextResponse.json(
      { error: "Failed to clear uploads" },
      { status: 500 }
    );
  }
}
