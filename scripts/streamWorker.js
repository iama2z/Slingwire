const WebSocket = require("ws");
const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    "Missing Firebase Admin environment variables. Expected FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = admin.firestore();
const eventsCollection = db.collection("events");
const JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe";
const HASHTAG_REGEX = /#WichitaEvents\b/i;

let reconnectDelayMs = 1000;
const maxReconnectDelayMs = 30000;

function extractPostFields(payload) {
  const textCandidates = [
    payload?.text,
    payload?.post?.text,
    payload?.record?.text,
    payload?.commit?.record?.text,
  ];

  const authorCandidates = [
    payload?.author,
    payload?.did,
    payload?.post?.author,
    payload?.record?.author,
  ];

  const timestampCandidates = [
    payload?.createdAt,
    payload?.time_us,
    payload?.post?.createdAt,
    payload?.record?.createdAt,
    payload?.commit?.record?.createdAt,
  ];

  const text = textCandidates.find((value) => typeof value === "string" && value.trim().length > 0);
  const authorHandle = authorCandidates.find((value) => typeof value === "string" && value.trim().length > 0);
  const rawTimestamp = timestampCandidates.find((value) => value != null);

  if (!text || !authorHandle) {
    return null;
  }

  let timestampDate;
  if (typeof rawTimestamp === "string") {
    const parsed = new Date(rawTimestamp);
    timestampDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } else if (typeof rawTimestamp === "number") {
    // Jetstream can provide microseconds; convert to milliseconds for JS Date.
    timestampDate = new Date(Math.floor(rawTimestamp / 1000));
  } else {
    timestampDate = new Date();
  }

  const sourceId =
    (typeof payload?.commit?.cid === "string" && payload.commit.cid) ||
    (typeof payload?.cid === "string" && payload.cid) ||
    `${authorHandle}-${timestampDate.getTime()}`;

  return {
    text: text.trim(),
    authorHandle: authorHandle.replace(/^@/, "").trim(),
    timestampDate,
    sourceId,
  };
}

async function persistEvent(match) {
  // The worker loop writes directly into Firestore so the SSR page can render fresh records.
  await eventsCollection.doc(match.sourceId).set(
    {
      text: match.text,
      authorHandle: match.authorHandle,
      timestamp: admin.firestore.Timestamp.fromDate(match.timestampDate),
      source: "bluesky-jetstream",
      ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function scheduleReconnect() {
  const waitMs = reconnectDelayMs;
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, maxReconnectDelayMs);

  console.log(`WebSocket disconnected. Reconnecting in ${waitMs}ms...`);
  setTimeout(startStream, waitMs);
}

function startStream() {
  const socket = new WebSocket(JETSTREAM_URL);

  socket.on("open", () => {
    console.log("Connected to Bluesky Jetstream.");
    reconnectDelayMs = 1000;
  });

  socket.on("message", async (raw) => {
    try {
      const payload = JSON.parse(raw.toString());
      const post = extractPostFields(payload);
      if (!post || !HASHTAG_REGEX.test(post.text)) {
        return;
      }

      await persistEvent(post);
      console.log(`Saved event from @${post.authorHandle} at ${post.timestampDate.toISOString()}`);
    } catch (error) {
      // Catch both JSON parse errors and Firestore write errors to keep the stream alive.
      console.error("Error while processing message:", error);
    }
  });

  socket.on("error", (error) => {
    console.error("WebSocket error:", error.message);
  });

  socket.on("close", () => {
    scheduleReconnect();
  });
}

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection in worker:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in worker:", error);
});

startStream();
