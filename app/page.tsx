"use client";
import { useState } from "react";

export default function HomePage() {
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    setUploading(true);
    await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, tags: tags.split(",") }),
    });
    setUploading(false);
    alert("Image added to database!");
  }

  async function handleSearch() {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    });
    const data = await res.json();
    setResults(data);
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50 text-gray-900">
      <h1 className="text-3xl font-bold mb-6">🔍 Image Similarity Search</h1>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Enter Image URL"
          className="border p-2 rounded w-full"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <input
          type="text"
          placeholder="Comma-separated tags (optional)"
          className="border p-2 rounded w-full"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        <div className="flex gap-4">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>

          <button
            onClick={handleSearch}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Search Similar
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {results.map((r) => (
            <div
              key={r.id}
              className="border rounded p-2 bg-white shadow-sm text-center"
            >
              <img
                src={r.url}
                alt="result"
                className="w-full h-40 object-cover rounded mb-2"
              />
              <p className="text-sm text-gray-700">
                Similarity: {(r.similarity * 100).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
