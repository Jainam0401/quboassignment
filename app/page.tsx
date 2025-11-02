"use client"
import { useState } from "react";

// A simple component to show status messages
function StatusMessage({ message }) {
  if (!message) return null;
  const isError = message.startsWith("❌");
  return (
    <div
      className={`p-3 rounded-md my-4 text-sm ${
        isError
          ? "bg-red-100 text-red-800"
          : "bg-green-100 text-green-800"
      }`}
    >
      {message}
    </div>
  );
}

export default function HomePage() {
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Handler for uploading/indexing an image
  async function handleUpload() {
    if (!imageUrl) {
      setStatusMessage("❌ Please enter an image URL to upload.");
      return;
    }
    setUploading(true);
    setStatusMessage("");
    setResults([]);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, tags: tags.split(",").filter(t => t.trim() !== "") }),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage(data.cached ? "✅ Image was already in database." : "✅ Image uploaded and processed!");
      } else {
        setStatusMessage(`❌ Upload failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ An unexpected error occurred during upload.");
    }
    setUploading(false);
  }

  // Generic search handler
  async function handleSearch(queryType, input) {
    if (!input) {
      setStatusMessage(`❌ Please enter ${queryType === 'image' ? 'an image URL' : 'search text'}.`);
      return;
    }
    setSearching(true);
    setStatusMessage("");
    setResults([]);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Fix: Send the correct payload
        body: JSON.stringify({ queryType, input }),
      });
      const data = await res.json();

      if (data.success && data.results) {
        setResults(data.results);
        setStatusMessage(data.results.length > 0 ? `Found ${data.results.length} results.` : "No similar images found.");
      } else {
        setStatusMessage(`❌ Search failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ An unexpected error occurred during search.");
    }
    setSearching(false);
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          🔍 Image Similarity Search
        </h1>

        {/* --- UPLOAD SECTION --- */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">1. Add Image to Database</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter Image URL (e.g., https://.../image.png)"
              className="border p-3 rounded-md w-full text-sm"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <input
              type="text"
              placeholder="Comma-separated tags (optional, e.g., nature,dog,sky)"
              className="border p-3 rounded-md w-full text-sm"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <button
              onClick={handleUpload}
              disabled={uploading || searching}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {uploading ? "Processing..." : "Upload & Index Image"}
            </button>
          </div>
        </div>

        {/* --- SEARCH SECTION --- */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">2. Find Similar Images</h2>
          <div className="space-y-4">
            {/* Search by Text */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by text (e.g., 'a dog on a beach')"
                className="border p-3 rounded-md w-full text-sm"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <button
                onClick={() => handleSearch("text", searchText)}
                disabled={uploading || searching}
                className="bg-green-600 text-white px-5 py-3 rounded-md font-medium hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                Search
              </button>
            </div>
            
            <div className="relative flex items-center justify-center my-4">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
                <div className="flex-grow border-t border-gray-300"></div>
            </div>

            {/* Search by Image URL */}
            <p className="text-sm text-gray-600">Search using the Image URL from Step 1 (or any other URL):</p>
            <button
              onClick={() => handleSearch("image", imageUrl)}
              disabled={uploading || searching || !imageUrl}
              className="w-full bg-indigo-600 text-white px-4 py-3 rounded-md font-medium hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
            >
              {searching ? "Searching..." : "Search by Image URL"}
            </button>
          </div>
        </div>
        
        {/* --- STATUS & RESULTS --- */}
        <StatusMessage message={statusMessage} />

        {results.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Search Results:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {results.map((r) => (
                <div
                  key={r.id}
                  className="border rounded-lg p-2 bg-white shadow-sm overflow-hidden"
                >
                  <img
                    src={r.url}
                    alt="search result"
                    className="w-full h-40 object-cover rounded mb-2"
                    onError={(e) => (e.currentTarget.src = 'https://placehold.co/400x400/eee/ccc?text=Image+Failed')}
                  />
                  <p className="text-sm text-gray-700 font-medium text-center">
                    Similarity: {(r.similarity * 100).toFixed(1)}%
                  </p>
                  {r.tags && r.tags.length > 0 && (
                     <p className="text-xs text-gray-500 truncate" title={r.tags.join(', ')}>
                        Tags: {r.tags.join(', ')}
                     </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
