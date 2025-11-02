import { NextResponse } from "next/server";
import Replicate from "replicate";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gadrronvmoplpegtfjbz.storage.supabase.co/storage/v1/s3",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhZHJyb252bW9wbHBlZ3RmamJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MjMxNTIsImV4cCI6MjA3NzQ5OTE1Mn0.TFFHf7MWCuL9vfKaCtc2vfPex-5hU6MNjUR0SOJoe9M"
);
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

export async function POST(req) {
  try {
    const { queryType, input } = await req.json();

    let embedding;
    if (queryType === "image") {
      embedding = await replicate.run("openai/clip:latest", {
        input: { image: input },
      });
    } // inside /api/search/route.js before calling Replicate for text query
    else if (queryType === "text") {
      const { data: cachedQuery } = await supabase
        .from("text_queries")
        .select("embedding")
        .eq("query", input)
        .maybeSingle();

      if (cachedQuery) {
        embedding = cachedQuery.embedding;
      } else {
          embedding = await replicate.run("openai/clip:latest", { input: { text: input } });
    await supabase.from("text_queries").insert([{ query: input, embedding }]);
      }
    } else {
      throw new Error("Invalid query type");
    }

    const { data, error } = await supabase.rpc("match_images", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, results: data });
  } catch (err) {
    console.error("Search Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
