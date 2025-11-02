import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { prisma } from "@/lib/prisma";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const CLIP_MODEL = "andreasjansson/clip-features:75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a";

interface CachedEmbedding {
  embedding: string;
}

interface SearchResult {
  id: string;
  url: string;
  tags: string[];
  image_hash: string | null;
  extracted_text: string | null;
  similarity: number;
  created_at: Date;
}

export async function POST(req: NextRequest) {
  try {
    const { queryType, input } = await req.json();

    if (!queryType || !input) {
      return NextResponse.json(
        { success: false, error: "queryType and input are required" },
        { status: 400 }
      );
    }

    let embedding: number[];

    if (queryType === "image") {
      console.log(`Generating embedding for image query: ${input}`);
      const result = (await replicate.run(CLIP_MODEL, {
        input: { input: input },
      })) as [{ embedding: number[]; input: string }];
      
      embedding = Array.isArray(result) && result[0]?.embedding
        ? result[0].embedding
        : (result as any);
    
    } else if (queryType === "text") {
      console.log(`Processing text query: ${input}`);
      
      const cachedQuery = await prisma.$queryRawUnsafe<CachedEmbedding[]>(
        `SELECT embedding::text as embedding 
          FROM text_queries 
          WHERE query = $1 
          LIMIT 1`,
        input
      );

      if (cachedQuery && cachedQuery.length > 0 && cachedQuery[0].embedding) {
        console.log("✅ Using cached text embedding");
        const embeddingStr = cachedQuery[0].embedding;
        const cleaned = embeddingStr.replace(/^\s*\[|\]\s*$/g, '');
        embedding = cleaned.length > 0 ? cleaned.split(',').map(s => Number(s.trim())) : [];
      } else {
        console.log("Generating new embedding for text query...");
        const result = (await replicate.run(CLIP_MODEL, {
          input: { inputs: input },
        })) as [{ embedding: number[]; input: string }];
        
        embedding = Array.isArray(result) && result[0]?.embedding
          ? result[0].embedding
          : (result as any);
        
        console.log("Generated embedding length:", embedding.length);
        
        try {
          const embeddingStr = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `INSERT INTO text_queries (query, embedding)
             VALUES ($1, $2::vector)
             ON CONFLICT (query) DO NOTHING`,
            input,
            embeddingStr
          );
          console.log("✅ Cached text embedding for future use");
        } catch (cacheError) {
          console.warn("Failed to cache text embedding:", cacheError);
        }
      }
    } else {
      throw new Error("Invalid query type. Must be 'image' or 'text'.");
    }

    if (!Array.isArray(embedding) || typeof embedding[0] !== 'number' || embedding.some(isNaN)) {
      console.error("Invalid embedding format:", embedding);
      throw new Error("Embedding must be a valid array of numbers");
    }

    if (embedding.length !== 768) {
      throw new Error(`Invalid embedding dimensions: expected 768, got ${embedding.length}`);
    }

    console.log("Embedding ready - length:", embedding.length);

    const matchThreshold = 0.1;
    const matchCount = 10;
    const embeddingStr = `[${embedding.join(',')}]`;

    const results = await prisma.$queryRawUnsafe<SearchResult[]>(
      `SELECT 
         id::text,
         url,
         tags,
         image_hash,
         extracted_text,
         created_at,
         (embedding <=> $1::vector) AS cos_distance,
         ROUND((1 - (embedding <=> $1::vector))::numeric, 4) AS similarity
       FROM images
       WHERE embedding IS NOT NULL
         AND (embedding <=> $1::vector) < (1 - $2)
       ORDER BY embedding <=> $1::vector ASC
       LIMIT $3`,
      embeddingStr,
      matchThreshold,
      matchCount
    );

    console.log(`Found ${results.length} matches.`);
    return NextResponse.json({ 
      success: true, 
      results,
      queryType,
      matchCount: results.length 
    });
  } catch (err) {
    console.error("Search Error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
