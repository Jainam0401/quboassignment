import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import crypto from "crypto";
// Import only the Prisma client
import { prisma } from "@/lib/prisma";

// Use environment variable for Replicate token
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const CLIP_MODEL = "andreasjansson/clip-features:75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a";
const OCR_MODEL = "abiruyt/text-extract-ocr:a524caeaa23495bc9edc805ab08ab5fe943afd3febed884a4f3747aa32e9cd61";

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { imageUrl, tags } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "imageUrl is required" },
        { status: 400 }
      );
    }

    // Compute SHA256 hash for the image URL
    const imageHash = crypto.createHash("sha256").update(imageUrl).digest("hex");

    // 1️⃣ Check if embedding exists in database *using Prisma*
    const existing = await prisma.images.findUnique({
      where: { image_hash: imageHash },
    });

    if (existing) {
      console.log("✅ Using cached embedding from database");
      return NextResponse.json({
        success: true,
        data: existing,
        extractedText: existing.extracted_text || "Cached (no OCR result stored)",
        cached: true,
      });
    }

    // 2️⃣ Generate image embedding
    console.log(`Generating embedding for ${imageUrl} using ${CLIP_MODEL}...`);
    // This model returns: [{ embedding: [0.1, 0.2, ...], input: '...' }]
    const embeddingResult = (await replicate.run(CLIP_MODEL, { // ⬅️ USED CLIP_MODEL
      input: {
        image: imageUrl,
      },
    })) as [{ embedding: number[]; input: string }];

    console.log("embedding",embeddingResult)

    // 3️⃣ Run OCR extraction
    let extractedText = "";
    try {
      console.log(`Running OCR for ${imageUrl} using ${OCR_MODEL}...`);
      const ocrResult = (await replicate.run(OCR_MODEL, { // ⬅️ USED OCR_MODEL
        input: {
          image: imageUrl,
        },
      })) as string | { text: string };

      extractedText = typeof ocrResult === 'string' ? ocrResult : ocrResult?.text || JSON.stringify(ocrResult);
    } catch (ocrError) {
      console.warn("OCR failed, continuing without text extraction:", ocrError.message);
    }

    // 4️⃣ Extract the actual embedding vector (CRITICAL FIX)
    let vector: number[];
    if (Array.isArray(embeddingResult) && embeddingResult[0]?.embedding) {
      vector = embeddingResult[0].embedding;
    } else {
      // Log the unexpected result to debug
      console.error("Replicate result structure:", JSON.stringify(embeddingResult)); 
      throw new Error("Unexpected embedding format from Replicate");
    }

    // Validate vector dimensions
    if (!Array.isArray(vector) || vector.length !== 768) {
      throw new Error(`Invalid embedding dimensions: expected 768, got ${vector.length}`);
    }

    console.log("Processed embedding vector length:", vector.length);
    const tagsArray = tags || [];
    console.log("Tags array:", tagsArray);

    // 5️⃣ Insert into database using Prisma raw query
    // Convert embedding to PostgreSQL vector format "[0.1,0.2,...]"
    const embeddingStr = `[${vector.join(',')}]`;

    try {
      // Use executeRawUnsafe for INSERT. Note the $3::text[] cast for the tags array.
      await prisma.$executeRawUnsafe(
        `INSERT INTO images (url, embedding, tags, image_hash, extracted_text)
         VALUES ($1, $2::vector, $3::text[], $4, $5)`,
        imageUrl,
        embeddingStr, // $2
        tagsArray, // $3
        imageHash, // $4
        extractedText // $5
      );

      console.log("✅ Database insert successful");
    } catch (dbError) {
      console.error("Database insertion error:", dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log("✅ Successfully uploaded and processed new image.");
    return NextResponse.json({
      success: true,
      data: {
        imageHash,
        url: imageUrl,
        tags: tagsArray,
        extractedText,
        embeddingDimensions: vector.length,
      },
      extractedText,
      cached: false,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
