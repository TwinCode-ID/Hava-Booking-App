const test = require("node:test");
const assert = require("node:assert/strict");

const Package = require("../models/StudioData/Packages");
const Studio = require("../models/StudioData/Studios");
const packageRouter = require("../routes/StudioRoutes/packagesRoutes");
const studioRouter = require("../routes/StudioRoutes/studioRoutes");
const {
  protect,
  studioAdmin,
} = require("../middlewares/authMiddleware");
const {
  getAllPackages,
  getPackagePaymentInstructions,
} = require("../controllers/StudioDataController/packagesController");
const {
  getAllStudios,
  getStudioById,
  getStudioPaymentInstructions,
  updateStudio,
} = require("../controllers/StudioDataController/studioController");

const IDS = {
  package: "507f1f77bcf86cd799439010",
  studioA: "507f1f77bcf86cd799439011",
  studioB: "507f1f77bcf86cd799439012",
  user: "507f1f77bcf86cd799439013",
};

const createResponse = () => ({
  body: undefined,
  headers: {},
  statusCode: 200,
  json(body) {
    this.body = body;
    return this;
  },
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
});

const selectedQuery = (value) => ({
  select: async () => value,
});

const populatedQuery = (value) => ({
  populate: async () => value,
});

const studioDocument = (id = IDS.studioA) => ({
  _id: id,
  studioName: "Studio A",
  studioPictures: ["studio.jpeg"],
  address: { city: "Auckland" },
  facilities: ["Reformer"],
  contactNumber: "123",
  bankDetails: [
    {
      _id: "bank-record-id",
      accountHolderName: "Studio A Ltd",
      accountNumber: "1234-5678",
      bankName: "Example Bank",
      internalNote: "must not leave the server",
    },
  ],
  createdAt: new Date(),
});

const getRouteHandlers = (router, method, routePath) => {
  const layer = router.stack.find(
    (candidate) =>
      candidate.route?.path === routePath && candidate.route.methods[method],
  );
  return layer?.route.stack.map((handler) => handler.handle) || [];
};

test("payment-instruction contracts are protected before controller access", () => {
  const packageHandlers = getRouteHandlers(
    packageRouter,
    "get",
    "/:id/payment-instructions",
  );
  assert.equal(packageHandlers[0], protect);
  assert.equal(packageHandlers.length, 2);

  const studioHandlers = getRouteHandlers(
    studioRouter,
    "get",
    "/:id/payment-instructions",
  );
  assert.equal(studioHandlers[0], protect);
  assert.equal(studioHandlers[1], studioAdmin);
  assert.equal(studioHandlers.length, 3);
});

test("public studio responses omit bank details", async () => {
  const originalFind = Studio.find;
  const originalFindById = Studio.findById;
  const studio = studioDocument();
  Studio.find = async () => [studio];
  Studio.findById = async () => studio;

  try {
    const listResponse = createResponse();
    await getAllStudios({}, listResponse);
    assert.equal(listResponse.statusCode, 200);
    assert.equal(Object.hasOwn(listResponse.body[0], "bankDetails"), false);
    assert.equal(Object.hasOwn(listResponse.body[0], "createdAt"), false);

    const detailResponse = createResponse();
    await getStudioById({ params: { id: IDS.studioA } }, detailResponse);
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(Object.hasOwn(detailResponse.body, "bankDetails"), false);
  } finally {
    Studio.find = originalFind;
    Studio.findById = originalFindById;
  }
});

test("public package responses strip populated studio bank details", async () => {
  const originalFind = Package.find;
  const pkg = {
    _id: IDS.package,
    packageName: "Starter",
    studioLocation: studioDocument(),
  };
  Package.find = () => populatedQuery([pkg]);

  try {
    const response = createResponse();
    await getAllPackages({}, response);
    assert.equal(response.statusCode, 200);
    assert.equal(
      Object.hasOwn(response.body[0].studioLocation, "bankDetails"),
      false,
    );
    assert.equal(response.body[0].studioLocation.studioName, "Studio A");
  } finally {
    Package.find = originalFind;
  }
});

test("an eligible signed-in client receives only package payment instructions", async () => {
  const originalPackageFindById = Package.findById;
  const originalStudioFindById = Studio.findById;
  Package.findById = () =>
    selectedQuery({
      _id: IDS.package,
      studioLocation: IDS.studioA,
      isActive: true,
      isStudentPackage: false,
      packageCategory: ["Regular"],
    });
  Studio.findById = () => selectedQuery(studioDocument());

  try {
    const response = createResponse();
    await getPackagePaymentInstructions(
      {
        params: { id: IDS.package },
        user: { _id: IDS.user, role: "client", isStudent: false },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["Cache-Control"], "private, no-store");
    assert.deepEqual(response.body, {
      packageId: IDS.package,
      studio: { id: IDS.studioA, name: "Studio A" },
      bankDetails: [
        {
          accountHolderName: "Studio A Ltd",
          accountNumber: "1234-5678",
          bankName: "Example Bank",
        },
      ],
    });
  } finally {
    Package.findById = originalPackageFindById;
    Studio.findById = originalStudioFindById;
  }
});

test("payment instructions reject unauthenticated and ineligible clients", async () => {
  const originalFindById = Package.findById;
  Package.findById = () =>
    selectedQuery({
      _id: IDS.package,
      studioLocation: IDS.studioA,
      isActive: true,
      isStudentPackage: true,
      packageCategory: ["Student"],
    });

  try {
    const anonymousResponse = createResponse();
    await getPackagePaymentInstructions(
      { params: { id: IDS.package } },
      anonymousResponse,
    );
    assert.equal(anonymousResponse.statusCode, 403);

    const ineligibleResponse = createResponse();
    await getPackagePaymentInstructions(
      {
        params: { id: IDS.package },
        user: { _id: IDS.user, role: "client", isStudent: false },
      },
      ineligibleResponse,
    );
    assert.equal(ineligibleResponse.statusCode, 403);
  } finally {
    Package.findById = originalFindById;
  }
});

test("studio staff cannot read another tenant's payment instructions", async () => {
  const originalPackageFindById = Package.findById;
  const originalStudioFindById = Studio.findById;
  let studioLookupCount = 0;
  Package.findById = () =>
    selectedQuery({
      _id: IDS.package,
      studioLocation: IDS.studioB,
      isActive: true,
      isStudentPackage: false,
      packageCategory: ["Regular"],
    });
  Studio.findById = () => {
    studioLookupCount += 1;
    return selectedQuery(studioDocument(IDS.studioB));
  };

  try {
    const response = createResponse();
    await getPackagePaymentInstructions(
      {
        params: { id: IDS.package },
        user: {
          _id: IDS.user,
          role: "studioAdmin",
          adminStudioLocation: IDS.studioA,
        },
      },
      response,
    );
    assert.equal(response.statusCode, 403);
    assert.equal(studioLookupCount, 0);
  } finally {
    Package.findById = originalPackageFindById;
    Studio.findById = originalStudioFindById;
  }
});

test("studio payment instructions require same-tenant staff", async () => {
  const originalFindById = Studio.findById;
  Studio.findById = () => selectedQuery(studioDocument());

  try {
    const allowedResponse = createResponse();
    await getStudioPaymentInstructions(
      {
        params: { id: IDS.studioA },
        user: {
          _id: IDS.user,
          role: "studioAdmin",
          adminStudioLocation: IDS.studioA,
        },
      },
      allowedResponse,
    );
    assert.equal(allowedResponse.statusCode, 200);
    assert.deepEqual(allowedResponse.body.studio, {
      id: IDS.studioA,
      name: "Studio A",
    });

    const deniedResponse = createResponse();
    await getStudioPaymentInstructions(
      {
        params: { id: IDS.studioA },
        user: {
          _id: IDS.user,
          role: "studioAdmin",
          adminStudioLocation: IDS.studioB,
        },
      },
      deniedResponse,
    );
    assert.equal(deniedResponse.statusCode, 403);
  } finally {
    Studio.findById = originalFindById;
  }
});

test("a non-bank studio update cannot disclose bank details", async () => {
  const originalFindById = Studio.findById;
  const studio = {
    ...studioDocument(),
    async save() {},
  };
  Studio.findById = async () => studio;

  try {
    const response = createResponse();
    await updateStudio(
      {
        body: { studioName: "Updated Studio" },
        params: { id: IDS.studioA },
        user: {
          _id: IDS.user,
          role: "studioAdmin",
          adminStudioLocation: IDS.studioA,
        },
      },
      response,
    );

    assert.equal(response.statusCode, 201);
    assert.equal(Object.hasOwn(response.body, "bankDetails"), false);
  } finally {
    Studio.findById = originalFindById;
  }
});
