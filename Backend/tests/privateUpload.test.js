const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizePrivateUploadPath,
  normalizeStoredPrivateUploadPath,
  signPrivateUploadUrl,
  verifyPrivateUploadSignature,
  withSignedProofUrl,
} = require("../helper/privateUpload");

const OWNER_ID = "507f1f77bcf86cd799439011";
const FILENAME = "550e8400-e29b-41d4-a716-446655440000.jpeg";
const PRIVATE_PATH = `/uploads/ProofOfPurchase/${OWNER_ID}/${FILENAME}`;
const TEST_SECRET = "private-upload-test-secret-with-at-least-32-bytes";

const originalSigningSecret = process.env.UPLOAD_URL_SIGNING_SECRET;
const originalPublicApiOrigin = process.env.PUBLIC_API_ORIGIN;
process.env.UPLOAD_URL_SIGNING_SECRET = TEST_SECRET;
process.env.PUBLIC_API_ORIGIN = "https://api.example.test";
test.after(() => {
  if (originalSigningSecret === undefined) {
    delete process.env.UPLOAD_URL_SIGNING_SECRET;
  } else {
    process.env.UPLOAD_URL_SIGNING_SECRET = originalSigningSecret;
  }
  if (originalPublicApiOrigin === undefined) {
    delete process.env.PUBLIC_API_ORIGIN;
  } else {
    process.env.PUBLIC_API_ORIGIN = originalPublicApiOrigin;
  }
});

test("historical proof paths remain signable but cannot be attached as new uploads", () => {
  const ownerPng = `/uploads/ProofOfPurchase/${OWNER_ID}/legacy-proof.png`;
  const rootJpeg = "/uploads/ProofOfPurchase/legacy-proof-1700000000.jpg";

  assert.equal(normalizePrivateUploadPath(ownerPng), null);
  assert.equal(normalizePrivateUploadPath(rootJpeg), null);
  assert.equal(normalizeStoredPrivateUploadPath(ownerPng), ownerPng);
  assert.equal(normalizeStoredPrivateUploadPath(rootJpeg), rootJpeg);
  assert.equal(
    normalizeStoredPrivateUploadPath(
      `/uploads/ProofOfPurchase/${OWNER_ID}/nested/proof.png`,
    ),
    null,
  );
  assert.ok(signPrivateUploadUrl(ownerPng, createSigningRequest()));
});

const createSigningRequest = () => ({
  protocol: "https",
  get(header) {
    assert.equal(header, "host");
    return "api.example.test";
  },
});

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  set(headers) {
    Object.assign(this.headers, headers);
    return this;
  },
});

const middlewareRequestFromUrl = (value, pathname) => {
  const url = new URL(value);
  const baseUrl = "/uploads/ProofOfPurchase";
  return {
    baseUrl,
    path: (pathname || url.pathname).slice(baseUrl.length),
    query: Object.fromEntries(url.searchParams),
  };
};

const withFixedNow = async (timestamp, callback) => {
  const originalNow = Date.now;
  Date.now = () => timestamp;
  try {
    return await callback();
  } finally {
    Date.now = originalNow;
  }
};

test("private upload paths normalize to one owner-scoped JPEG path", () => {
  assert.equal(normalizePrivateUploadPath(PRIVATE_PATH), PRIVATE_PATH);
  assert.equal(
    normalizePrivateUploadPath(
      `https://legacy.example.test${PRIVATE_PATH}?download=true#ignored`,
    ),
    PRIVATE_PATH,
  );

  const invalidPaths = [
    `/uploads/ProofOfPurchase/not-an-object-id/${FILENAME}`,
    `/uploads/ProofOfPurchase/${OWNER_ID}/nested/${FILENAME}`,
    `/uploads/ProofOfPurchase/${OWNER_ID}/proof.png`,
    `/uploads/ProofOfPurchase/${OWNER_ID}/../${FILENAME}`,
    `/uploads/ProofOfPurchase/${OWNER_ID}/%2e%2e/${FILENAME}`,
    `/uploads/ProofOfPurchase/${OWNER_ID}/proof%5cname.jpeg`,
    `/uploads/ProofOfPurchase/${OWNER_ID}/proof%00name.jpeg`,
    `/uploads/UserProfile/${OWNER_ID}/${FILENAME}`,
    "",
    null,
  ];

  for (const value of invalidPaths) {
    assert.equal(normalizePrivateUploadPath(value), null, String(value));
  }
});

test("private upload URLs are signed for a short fixed lifetime", async () => {
  await withFixedNow(1_700_000_000_000, () => {
    const signed = new URL(
      signPrivateUploadUrl(PRIVATE_PATH, createSigningRequest()),
    );

    assert.equal(signed.origin, "https://api.example.test");
    assert.equal(signed.pathname, PRIVATE_PATH);
    assert.equal(signed.searchParams.get("expires"), "1700000300");
    assert.match(signed.searchParams.get("signature"), /^[A-Za-z0-9_-]{43}$/);
  });
});

test("private upload URL origin cannot be poisoned through request headers", () => {
  const hostileRequest = {
    protocol: "https",
    get: () => "attacker.example",
  };
  const signed = new URL(signPrivateUploadUrl(PRIVATE_PATH, hostileRequest));
  assert.equal(signed.origin, "https://api.example.test");
});

test("a valid private upload signature advances with no-store headers", async () => {
  await withFixedNow(1_700_000_000_000, () => {
    const signed = signPrivateUploadUrl(PRIVATE_PATH, createSigningRequest());
    const request = middlewareRequestFromUrl(signed);
    const response = createResponse();
    let nextCount = 0;

    verifyPrivateUploadSignature(request, response, () => {
      nextCount += 1;
    });

    assert.equal(nextCount, 1);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["Cache-Control"], "private, no-store");
    assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
    assert.match(response.headers["Content-Security-Policy"], /default-src/);
  });
});

test("tampering with either the proof path or signature is rejected", async () => {
  await withFixedNow(1_700_000_000_000, () => {
    const signed = signPrivateUploadUrl(PRIVATE_PATH, createSigningRequest());
    const parsed = new URL(signed);

    const pathResponse = createResponse();
    let pathNextCount = 0;
    const tamperedPath = PRIVATE_PATH.replace(FILENAME, `x${FILENAME}`);
    verifyPrivateUploadSignature(
      middlewareRequestFromUrl(signed, tamperedPath),
      pathResponse,
      () => {
        pathNextCount += 1;
      },
    );
    assert.equal(pathResponse.statusCode, 403);
    assert.equal(pathNextCount, 0);

    const signature = parsed.searchParams.get("signature");
    parsed.searchParams.set(
      "signature",
      `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`,
    );
    const signatureResponse = createResponse();
    let signatureNextCount = 0;
    verifyPrivateUploadSignature(
      middlewareRequestFromUrl(parsed.toString()),
      signatureResponse,
      () => {
        signatureNextCount += 1;
      },
    );
    assert.equal(signatureResponse.statusCode, 403);
    assert.equal(signatureNextCount, 0);
  });
});

test("a private upload signature is rejected at and after its expiry", async () => {
  const signed = await withFixedNow(1_700_000_000_000, () =>
    signPrivateUploadUrl(PRIVATE_PATH, createSigningRequest()),
  );
  const expires = Number(new URL(signed).searchParams.get("expires"));

  await withFixedNow(expires * 1000, () => {
    const response = createResponse();
    let nextCount = 0;
    verifyPrivateUploadSignature(
      middlewareRequestFromUrl(signed),
      response,
      () => {
        nextCount += 1;
      },
    );

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.message, "Private file link is invalid.");
    assert.equal(nextCount, 0);
  });
});

test("purchase serialization replaces stored proof paths with signed URLs", async () => {
  await withFixedNow(1_700_000_000_000, () => {
    const purchase = {
      toObject: () => ({ _id: "purchase-a", proofOfPayment: PRIVATE_PATH }),
    };
    const output = withSignedProofUrl(purchase, createSigningRequest());

    assert.equal(output._id, "purchase-a");
    assert.equal(new URL(output.proofOfPayment).pathname, PRIVATE_PATH);
    assert.match(output.proofOfPayment, /expires=1700000300/);
    assert.match(output.proofOfPayment, /signature=/);
  });
});
