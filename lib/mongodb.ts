import mongoose from "mongoose";

type CachedMongoose = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: CachedMongoose | undefined;
}

const cached: CachedMongoose = global.mongooseCache || {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export default async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const MONGODB_DB = process.env.MONGODB_DB || "stokos";

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in environment variables.");
  }

  // Already connected
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

  // Reuse the same connecting promise
  if (!cached.promise) {
    mongoose.set("strictQuery", true);

    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      bufferCommands: false,

      // Do not build indexes automatically in production
      autoIndex: process.env.NODE_ENV !== "production",

      // Prefer IPv4 for Atlas/local DNS stability
      family: 4,

      // Good reusable pool for local dev + Vercel/serverless
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,

      // Connection/read timeouts
      serverSelectionTimeoutMS: 30_000,
      connectTimeoutMS: 30_000,
      socketTimeoutMS: 60_000,

      heartbeatFrequencyMS: 10_000,
      retryWrites: true,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
}

export async function pingMongoDB() {
  try {
    const conn = await connectDB();
    await conn.connection.db?.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}