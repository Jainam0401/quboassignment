import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
// Import only the Prisma client
import { prisma } from "@/lib/prisma";

// Use environment variable for Replicate token
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Use the same CLIP model
const CLIP_MODEL = "andreasjansson/clip-features:75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a";

interface CachedEmbedding {
  embedding: string; // Will be a string like "[0.1,0.2,...]"
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
        input: { image: input },
      })) as [{ embedding: number[]; input: string }];
      
      // Extract the embedding array from the result
      embedding = Array.isArray(result) && result[0]?.embedding
        ? result[0].embedding
        : (result as any); // Fallback, though should match above
    
    } else if (queryType === "text") {
      console.log(`Processing text query: ${input}`);
      
      // Check for cached text query embedding using raw SQL
      // This avoids the Prisma client error on "Unsupported" type
      const cachedQuery = await prisma.$queryRawUnsafe<CachedEmbedding[]>(
        `SELECT embedding::text as embedding 
         FROM text_queries 
         WHERE query = $1 
         LIMIT 1`,
        input
      );

      if (cachedQuery && cachedQuery.length > 0 && cachedQuery[0].embedding) {
        console.log("✅ Using cached text embedding");
        // Parse the PostgreSQL vector format "[0.1,0.2,...]" to array
        const embeddingStr = cachedQuery[0].embedding;
        embedding = JSON.parse(embeddingStr.replace(/\s+/g, ''));
      } else {
        console.log("Generating new embedding for text query...");
        // Generate new embedding
        const result = (await replicate.run(CLIP_MODEL, {
          input: { text: input },
        })) as [{ embedding: number[]; input: string }];
        
        // Extract the actual embedding array
        embedding = Array.isArray(result) && result[0]?.embedding
          ? result[0].embedding
          : (result as any); // Fallback
        
        console.log("Generated embedding length:", embedding.length);
        
        // Store in cache for future use using Prisma raw query
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
          console.warn("Failed to cache text embedding:", cacheError.message);
        }
      }
    } else {
      throw new Error("Invalid query type. Must be 'image' or 'text'.");
    }

    // Verify embedding is a flat array of numbers
    if (!Array.isArray(embedding) || typeof embedding[0] !== 'number') {
      console.error("Invalid embedding format:", embedding);
      throw new Error("Embedding must be an array of numbers");
    }

    // Validate embedding dimensions
    if (embedding.length !== 768) {
      throw new Error(`Invalid embedding dimensions: expected 768, got ${embedding.length}`);
    }

    console.log("Embedding ready - length:", embedding.length);

    // Perform vector similarity search using cosine distance
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
         1 - (embedding <=> $1::vector) as similarity
       FROM images
       WHERE embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) > $2
       ORDER BY embedding <=> $1::vector
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
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
