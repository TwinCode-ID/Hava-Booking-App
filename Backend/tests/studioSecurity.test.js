const test = require("node:test");
const assert = require("node:assert/strict");

const Studio = require("../models/StudioData/Studios");
const { updateStudio } = require("../controllers/StudioDataController/studioController");

const createResponse = () => ({
  body: undefined,
  statusCode: 200,
  json(body) {
    this.body = body;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
});

const createStudio = (id = "507f1f77bcf86cd799439011") => ({
  _id: id,
  address: {},
  bankDetails: [],
  facilities: [],
  studioName: "Studio A",
  studioPictures: [],
  saveCount: 0,
  async save() {
    this.saveCount += 1;
  },
});

test("studio administrators cannot update another studio's payment details", async () => {
  const originalFindById = Studio.findById;
  const studio = createStudio("507f1f77bcf86cd799439012");
  Studio.findById = async () => studio;

  try {
    const response = createResponse();
    await updateStudio(
      {
        body: {
          bankDetails: [
            {
              accountHolderName: "Example Owner",
              accountNumber: "12345678",
              bankName: "Example Bank",
            },
          ],
        },
        params: { id: studio._id },
        user: {
          role: "studioAdmin",
          adminStudioLocation: "507f1f77bcf86cd799439011",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 403);
    assert.equal(studio.saveCount, 0);
  } finally {
    Studio.findById = originalFindById;
  }
});

test("bank detail updates reject malformed account data before saving", async () => {
  const originalFindById = Studio.findById;
  const studio = createStudio();
  Studio.findById = async () => studio;

  try {
    const response = createResponse();
    await updateStudio(
      {
        body: {
          bankDetails: [
            {
              accountHolderName: "Owner",
              accountNumber: "<script>",
              bankName: "Bank",
            },
          ],
        },
        params: { id: studio._id },
        user: { role: "studioAdmin", adminStudioLocation: studio._id },
      },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.equal(studio.saveCount, 0);
  } finally {
    Studio.findById = originalFindById;
  }
});

test("valid bank details are normalized to a bounded server DTO", async () => {
  const originalFindById = Studio.findById;
  const studio = createStudio();
  Studio.findById = async () => studio;

  try {
    const response = createResponse();
    await updateStudio(
      {
        body: {
          bankDetails: [
            {
              accountHolderName: "  Example Owner  ",
              accountNumber: " 1234-5678 ",
              bankName: " Example Bank ",
              unexpected: "discarded",
            },
          ],
        },
        params: { id: studio._id },
        user: { role: "studioAdmin", adminStudioLocation: studio._id },
      },
      response,
    );

    assert.equal(response.statusCode, 201);
    assert.equal(studio.saveCount, 1);
    assert.deepEqual(studio.bankDetails, [
      {
        accountHolderName: "Example Owner",
        accountNumber: "1234-5678",
        bankName: "Example Bank",
      },
    ]);
  } finally {
    Studio.findById = originalFindById;
  }
});
