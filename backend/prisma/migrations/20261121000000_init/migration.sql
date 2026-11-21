-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Cursor" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "block" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Cursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardRecord" (
    "tokenId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "burned" BOOLEAN NOT NULL DEFAULT false,
    "revealed" BOOLEAN NOT NULL DEFAULT false,
    "rarity" INTEGER,
    "level" INTEGER NOT NULL DEFAULT 1,
    "element" INTEGER,
    "atk" INTEGER,
    "def" INTEGER,
    "spd" INTEGER,
    "ability" INTEGER,
    "setId" INTEGER,
    "seed" TEXT,
    "name" TEXT,
    "lore" TEXT,
    "imageUrl" TEXT,
    "commitment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardRecord_pkey" PRIMARY KEY ("tokenId")
);

-- CreateTable
CREATE TABLE "ListingRecord" (
    "tokenId" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ListingRecord_pkey" PRIMARY KEY ("tokenId")
);

-- CreateTable
CREATE TABLE "WalletStat" (
    "address" TEXT NOT NULL,
    "lifetimePoints" TEXT NOT NULL DEFAULT '0',
    "tier" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WalletStat_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "SeasonScore" (
    "season" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "points" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "SeasonScore_pkey" PRIMARY KEY ("season","address")
);

-- CreateTable
CREATE TABLE "EpochRecord" (
    "id" INTEGER NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "pool" TEXT NOT NULL,
    "totalPoints" TEXT NOT NULL DEFAULT '0',
    "finalized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EpochRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleRecord" (
    "id" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "defenderId" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "scoreA" INTEGER NOT NULL,
    "scoreB" INTEGER NOT NULL,
    "rounds" JSONB NOT NULL,
    "narration" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nonce" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedLog" (
    "id" TEXT NOT NULL,

    CONSTRAINT "ProcessedLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardRecord_owner_idx" ON "CardRecord"("owner");

