import { NextResponse } from "next/server";
import Replicate from "replicate";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Fix: Use your Supabase PROJECT URL, not the storage URL
const supabase = createClient(
  "https://gadrronvmoplpegtfjbz.supabase.co",  // Changed from .storage.supabase.co
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhZHJyb252bW9wbHBlZ3RmamJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MjMxNTIsImV4cCI6MjA3NzQ5OTE1Mn0.TFFHf7MWCuL9vfKaCtc2vfPex-5hU6MNjUR0SOJoe9M"
);

const replicate = new Replicate({ auth: "r8_DfYnEH3Q1m1i2DZrijw1gLu2cuLBB6W12kCvW" });

export async function POST(req) {
  try {
    // Add better error handling for JSON parsing
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

    // 1️⃣ Check if embedding exists in Supabase
    const { data: existing } = await supabase
      .from("images")
      .select("*")
      .eq("image_hash", imageHash)
      .maybeSingle();

    if (existing) {
      console.log("✅ Using cached embedding from Supabase");
      return NextResponse.json({
        success: true,
        data: existing,
        extractedText: existing.extracted_text || "Cached (no OCR result stored)",
        cached: true,
      });
    }

    // 2️⃣ Generate image embedding using CLIP model
    const embedding = await replicate.run(
      "andreasjansson/clip-features:75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a",
      { 
        input: { 
          inputs: imageUrl
        } 
      }
    );

    // 3️⃣ Run OCR extraction using a valid model
    let extractedText = "";
    try {
      const ocrResult = await replicate.run(
        "abiruyt/text-extract-ocr:d5a96d63406ccd199e7d9597f22f60e89cfa02e9e8f4d52bb09a1bc10e4914f8",
        { 
          input: { 
            image: imageUrl 
          } 
        }
      );
      // The output format varies by model - adjust based on actual response
      extractedText = typeof ocrResult === 'string' ? ocrResult : ocrResult?.text || JSON.stringify(ocrResult);
    } catch (ocrError) {
      console.warn("OCR failed, continuing without text extraction:", ocrError.message);
    }

    // 4️⃣ Store embedding + OCR text in Supabase
    const { data, error } = await supabase
      .from("images")
      .insert([
        {
          url: imageUrl,
          embedding,
          tags: tags || [],
          image_hash: imageHash,
          extracted_text: extractedText,
        },
      ])
      .select();

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data[0],
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