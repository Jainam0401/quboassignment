-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "images" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "url" TEXT NOT NULL,
    "embedding" vector(768),
    "tags" TEXT[],
    "image_hash" TEXT,
    "extracted_text" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "text_queries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "query" TEXT,
    "embedding" vector(768),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "text_queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "images_image_hash_key" ON "images"("image_hash");

-- CreateIndex
CREATE INDEX "images_image_hash_idx" ON "images"("image_hash");

-- CreateIndex
CREATE UNIQUE INDEX "text_queries_query_key" ON "text_queries"("query");
CREATE INDEX ON images USING hnsw (embedding vector_cosine_ops)