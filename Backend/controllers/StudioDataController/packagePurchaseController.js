const crypto = require("crypto");
const mongoose = require("mongoose");
const PackagePurchase = require("../../models/StudioData/PackagePurchase");
const UserPasses = require("../../models/UserData/User_Passes");
const User = require("../../models/UserData/User");
const Packages = require("../../models/StudioData/Packages");
const CashierTransaction = require("../../models/StudioData/CashierTransaction");
const Promo = require("../../models/StudioData/Promo");
const {
  canManageStudio,
  idsEqual,
  isDevTeam,
  isStudioStaff,
} = require("../../helper/authorization");
const {
  normalizePrivateUploadPath,
  withSignedProofUrl,
} = require("../../helper/privateUpload");
const {
  consumeOneTimeEntitlement,
  releaseOneTimeReservation,
  reserveOneTimeEntitlement,
} = require("../../helper/oneTimePackageEntitlement");

const forbidden = (
  message = "You are not authorized to manage this purchase.",
) => {
  const error = new Error(message);
  error.status = 403;
  return error;
};

const isTransactionConflict = (error) =>
  error?.code === 112 ||
  error?.code === 251 ||
  error?.hasErrorLabel?.("TransientTransactionError") === true;

const sendPurchaseError = (res, error, defaultStatus = 400) => {
  if (isTransactionConflict(error)) {
    return res.status(409).json({
      error: "This purchase changed while it was being processed. Please retry.",
    });
  }
  return res.status(error.status || defaultStatus).json({ error: error.message });
};

// --- HELPER: CHECK EXPIRY ---
const checkAndExpire = async (purchase) => {
  if (["confirmed", "expired"].includes(purchase.status)) return purchase;

  const now = new Date();
  if (now > purchase.paymentWindowExpiry) {
    purchase.status = "expired";
    await purchase.save();
    await releaseOneTimeReservation({ purchaseId: purchase._id });
  }
  return purchase;
};

// --- HELPER: GET TOTAL CREDITS ---
const calculateTotalCredits = (pkg) => {
  if (pkg.isCombo && pkg.comboItems && pkg.comboItems.length > 0) {
    return pkg.comboItems.reduce((sum, item) => sum + (item.credits || 0), 0);
  }
  return pkg.credits || 0;
};

const isStudentPackage = (pkg) =>
  pkg?.isStudentPackage === true || pkg?.packageCategory?.includes("Student");

const ensureStudentEligibility = async (pkg, userId, session) => {
  if (!isStudentPackage(pkg)) return;

  const user = await User.findById(userId)
    .select("isStudent")
    .session(session);
  if (!user) throw new Error("User not found.");
  if (user.isStudent !== true) {
    throw forbidden("This package is restricted to verified students.");
  }
};

const ensureStaffCanManageRecipient = async (
  actor,
  userId,
  studioId,
  session,
) => {
  const recipient = await User.findById(userId)
    .select("role preferredStudioId")
    .session(session);
  if (!recipient) throw new Error("User not found.");
  if (isDevTeam(actor)) return;
  if (
    recipient.role !== "client" ||
    !idsEqual(recipient.preferredStudioId, studioId)
  ) {
    throw forbidden("You can only manage clients affiliated with your studio.");
  }
};

// --- HELPER: CONSUME PROMO ---
const consumePromoCode = async (
  code,
  studioId,
  userId,
  session,
  allowAdminPromo = false,
  shouldConsume = true,
) => {
  if (!code) return null;
  const upperCode = code.toUpperCase().trim();

  const promo = await Promo.findOne({
    studioLocation: studioId,
    isActive: true,
    $or: [{ staticCode: upperCode }, { "codes.code": upperCode }],
  }).session(session);

  if (!promo) throw new Error("Promo code is invalid or inactive.");
  if (promo.validUntil && new Date(promo.validUntil) < new Date()) {
    throw new Error("Promo code has expired.");
  }
  if (promo.promoType === "admin" && !allowAdminPromo) {
    throw forbidden("This promo is restricted to studio staff.");
  }
  if (
    promo.promoType !== "admin" &&
    (promo.usedBy || []).some((usedUserId) => idsEqual(usedUserId, userId))
  ) {
    throw new Error("This promo has already been used by this account.");
  }

  if (promo.promoType === "bulk") {
    const voucherIndex = promo.codes.findIndex((c) => c.code === upperCode);
    if (voucherIndex === -1 || promo.codes[voucherIndex].isUsed) {
      throw new Error("Promo code has already been used.");
    }
  } else if (promo.promoType === "static" || promo.promoType === "admin") {
    if (
      promo.maxUsageLimit &&
      promo.currentUsageCount >= promo.maxUsageLimit
    ) {
      throw new Error("Promo code has reached its usage limit.");
    }
  }

  if (!shouldConsume) return promo;

  const now = new Date();
  const constraints = [
    {
      $or: [
        { validUntil: { $exists: false } },
        { validUntil: null },
        { validUntil: { $gte: now } },
      ],
    },
  ];
  if (promo.promoType !== "admin") {
    constraints.push({ usedBy: { $nin: [userId] } });
  }

  let update;
  let options = { new: true, session };
  if (promo.promoType === "bulk") {
    constraints.push({
      codes: { $elemMatch: { code: upperCode, isUsed: { $ne: true } } },
    });
    update = {
      $set: {
        "codes.$[voucher].isUsed": true,
        "codes.$[voucher].usedAt": now,
      },
      $inc: { currentUsageCount: 1 },
      $addToSet: { usedBy: userId },
    };
    options = {
      ...options,
      arrayFilters: [
        { "voucher.code": upperCode, "voucher.isUsed": { $ne: true } },
      ],
    };
  } else {
    constraints.push({
      $or: [
        { maxUsageLimit: { $exists: false } },
        { maxUsageLimit: null },
        { maxUsageLimit: { $lte: 0 } },
        {
          $expr: {
            $lt: [
              { $ifNull: ["$currentUsageCount", 0] },
              "$maxUsageLimit",
            ],
          },
        },
      ],
    });
    update = {
      $inc: { currentUsageCount: 1 },
      $addToSet: { usedBy: userId },
    };
  }

  // The availability predicates and mutation are one MongoDB operation. This
  // prevents concurrent approvals from oversubscribing a static promo or
  // redeeming the same bulk voucher twice.
  const consumedPromo = await Promo.findOneAndUpdate(
    {
      _id: promo._id,
      isActive: true,
      $and: constraints,
    },
    update,
    options,
  );
  if (!consumedPromo) {
    throw new Error("Promo code is no longer available.");
  }
  return consumedPromo;
};

const calculatePromoDiscount = (basePrice, promo) => {
  if (!promo) return 0;
  if (promo.discountType === "percentage") {
    return basePrice * (Math.min(100, Math.max(0, promo.discountValue)) / 100);
  }
  if (promo.discountType === "fixed") {
    return Math.min(basePrice, Math.max(0, promo.discountValue));
  }
  return 0;
};

// --- 1. CASHIER BULK PURCHASE ---
exports.createCashierBulkPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      userIds,
      purchasedPackages, // Uses the new specific payload from the frontend
      paymentMethod,
      paymentDetails,
      totalAmount,
      discountAmount,
      promoCode,
      notes,
      issuingStudio: requestedStudio,
    } = req.body;

    const issuingStudio = req.user.adminStudioLocation || requestedStudio;
    const cashierId = req.user._id;

    if (!issuingStudio || !canManageStudio(req.user, issuingStudio)) {
      throw forbidden();
    }

    if (!Array.isArray(userIds) || userIds.length === 0)
      throw new Error("Please select at least one client.");
    if (userIds.length > 100)
      throw new Error("Too many clients were selected for one transaction.");
    if (!Array.isArray(purchasedPackages) || purchasedPackages.length === 0)
      throw new Error("Cart is empty.");
    if (purchasedPackages.length > 50)
      throw new Error("Too many packages were selected for one transaction.");

    const uniqueUserIds = [...new Set(userIds.map((id) => id?.toString()))];
    if (uniqueUserIds.some((id) => !id)) throw new Error("Invalid client.");
    for (const userId of uniqueUserIds) {
      await ensureStaffCanManageRecipient(
        req.user,
        userId,
        issuingStudio,
        session,
      );
    }

    for (const item of purchasedPackages) {
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100) {
        throw new Error("Package quantity must be a positive integer.");
      }
      const pkg = await Packages.findById(item.packageId).session(session);
      if (!pkg) throw new Error("Package not found.");
      if (pkg.isActive === false) throw new Error("Package is not available.");
      if (!idsEqual(pkg.studioLocation, issuingStudio)) {
        throw forbidden("A package does not belong to your studio.");
      }
      for (const userId of uniqueUserIds) {
        await ensureStudentEligibility(pkg, userId, session);
      }
    }

    // 1. Consume Promo if exists
    if (promoCode) {
      await consumePromoCode(
        promoCode,
        issuingStudio,
        uniqueUserIds[0],
        session,
        true,
      );
    }

    // 2. Create the Master Cashier Transaction (The Receipt)
    const cashierTrx = new CashierTransaction({
      transactionId: `CASH-${crypto.randomUUID()}`,
      issuingStudio,
      cashierId,
      userIds: uniqueUserIds,
      packages: purchasedPackages.map((p) => ({
        packageId: p.packageId,
        priceAtPurchase: p.priceAtPurchase,
        qty: p.qty,
      })),
      totalAmount,
      discountAmount: discountAmount || 0,
      promoCodeApplied: promoCode || null,
      paymentMethod,
      paymentDetails: paymentDetails || {},
      notes,
    });
    await cashierTrx.save({ session });

    // 3. Create INDIVIDUAL isolated passes for EACH user
    for (const uid of uniqueUserIds) {
      for (const item of purchasedPackages) {
        // Fetch the package
        const pkg = await Packages.findById(item.packageId).session(session);
        if (!pkg) throw new Error(`Package not found.`);
        if (pkg.isActive === false) throw new Error("Package is not available.");

        // Protect One-Time Purchases
        if (pkg.isOneTimePurchase) {
          if (item.qty !== 1) {
            throw new Error(
              `The one-time package ${pkg.packageName} can only be assigned once.`,
            );
          }
          await consumeOneTimeEntitlement({
            userId: uid,
            packageId: pkg._id,
            source: "cashier",
            session,
          });
        }

        // Create the individual Order History record for the client
        const newPurchase = new PackagePurchase({
          transactionId: `TRX-${crypto.randomUUID()}`,
          userId: uid, // STRICTLY ASSIGNED TO THIS SPECIFIC USER
          packageId: pkg._id,
          packageNameSnapshot: pkg.packageName,
          isOneTimePurchaseSnapshot: pkg.isOneTimePurchase === true,
          paymentWindowExpiry: new Date(),
          creditsPurchased: calculateTotalCredits(pkg) * item.qty,
          totalAmount: item.priceAtPurchase * item.qty,
          promoCodeApplied: promoCode || null,
          discountAmount: 0,
          paymentMethod: paymentMethod,
          paymentIssuer: `CASHIER TRX: ${cashierTrx.transactionId}`,
          issuingStudio,
          status: "confirmed",
        });
        await newPurchase.save({ session });

        // Loop by quantity (if they bought 2 of the same package) and insert passes
        for (let q = 0; q < item.qty; q++) {
          const passExpiry = new Date();
          passExpiry.setDate(passExpiry.getDate() + (pkg.validityDays || 30));

          let passesToCreate = [];
          if (pkg.isCombo && pkg.comboItems && pkg.comboItems.length > 0) {
            passesToCreate = pkg.comboItems.map((combo) => ({
              userId: uid, // STRICTLY ASSIGNED TO THIS SPECIFIC USER
              packageId: pkg._id,
              packageNameSnapshot: pkg.packageName,
              packageCategorySnapshot: pkg.packageCategory,
              isStudentRestrictedSnapshot: isStudentPackage(pkg),
              purchaseDate: new Date(),
              expiryDate: passExpiry,
              remainingCredits: combo.credits,
              validityDuration: pkg.validityDays || 30,
              initialCredits: combo.credits,
              issuingStudio,
              isActive: true,
              classType: combo.classType,
              instructorType: combo.instructorType,
              sharedWith: [], // FORCE EMPTY (NO SHARING)
              isShared: false, // FORCE FALSE
            }));
          } else {
            passesToCreate = [
              {
                userId: uid, // STRICTLY ASSIGNED TO THIS SPECIFIC USER
                packageId: pkg._id,
                packageNameSnapshot: pkg.packageName,
                packageCategorySnapshot: pkg.packageCategory,
                isStudentRestrictedSnapshot: isStudentPackage(pkg),
                purchaseDate: new Date(),
                expiryDate: passExpiry,
                remainingCredits: pkg.credits,
                validityDuration: pkg.validityDays || 30,
                initialCredits: pkg.credits,
                issuingStudio,
                isActive: true,
                classType: pkg.classType,
                instructorType: pkg.instructorType,
                sharedWith: [], // FORCE EMPTY (NO SHARING)
                isShared: false, // FORCE FALSE
              },
            ];
          }

          // Insert perfectly isolated passes
          await UserPasses.insertMany(passesToCreate, { session });
        }
      }
    }

    await session.commitTransaction();
    res.status(200).json({
      message: "Individual passes successfully assigned. No sharing.",
      transaction: cashierTrx,
    });
  } catch (error) {
    await session.abortTransaction();
    sendPurchaseError(res, error);
  } finally {
    session.endSession();
  }
};

// --- 2. CREATE CLIENT PURCHASE ---
exports.createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      packageId,
      totalAmount,
      paymentMethod,
      paymentIssuer,
      proofOfPayment,
      userId,
      promoCodeApplied,
      discountAmount,
    } = req.body;

    const packageInfo = await Packages.findById(packageId).session(session);
    if (!packageInfo) throw new Error("Package not found");
    if (packageInfo.isActive === false) {
      throw new Error("Package is not available.");
    }

    const adminPurchase = isStudioStaff(req.user);
    const finalUserId = adminPurchase && userId ? userId : req.user._id;
    const issuingStudio = packageInfo.studioLocation;
    if (!issuingStudio) throw new Error("Package has no issuing studio.");

    if (adminPurchase && !canManageStudio(req.user, issuingStudio)) {
      throw forbidden("You cannot assign packages from another studio.");
    }
    if (adminPurchase) {
      await ensureStaffCanManageRecipient(
        req.user,
        finalUserId,
        issuingStudio,
        session,
      );
    }
    if (
      !adminPurchase &&
      ["direct_payment", "manual_admin"].includes(paymentMethod)
    ) {
      throw forbidden("This payment method is restricted to studio staff.");
    }

    const normalizedProof = proofOfPayment
      ? normalizePrivateUploadPath(proofOfPayment)
      : null;
    if (proofOfPayment && !normalizedProof) {
      throw new Error("Invalid payment proof URL.");
    }
    if (
      normalizedProof &&
      !normalizedProof.startsWith(
        `/uploads/ProofOfPurchase/${req.user._id.toString()}/`,
      )
    ) {
      throw forbidden("You cannot attach another user's payment proof.");
    }
    await ensureStudentEligibility(packageInfo, finalUserId, session);

    let paymentStatus;
    const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (paymentMethod === "direct_payment" && adminPurchase) {
      paymentStatus = "confirmed";
    } else if (
      paymentMethod === "pay_at_studio" ||
      paymentMethod === "manual_admin"
    ) {
      paymentStatus = "pending";
    } else {
      paymentStatus = "waiting_confirmation";
    }

    let appliedPromo = null;
    if (promoCodeApplied) {
      appliedPromo = await consumePromoCode(
        promoCodeApplied,
        issuingStudio,
        finalUserId,
        session,
        adminPurchase,
        paymentStatus === "confirmed",
      );
    }

    const totalCredits = calculateTotalCredits(packageInfo);
    const basePrice =
      packageInfo.isPromo && packageInfo.promoPrice !== undefined
        ? packageInfo.promoPrice
        : packageInfo.packagePrice;
    const serverDiscount = calculatePromoDiscount(basePrice, appliedPromo);
    const serverTotal = Math.max(0, basePrice - serverDiscount);
    const finalTotal = adminPurchase ? Number(totalAmount) : serverTotal;
    const finalDiscount = adminPurchase
      ? Number(discountAmount || 0)
      : serverDiscount;
    if (!Number.isFinite(finalTotal) || finalTotal < 0) {
      throw new Error("Invalid purchase total.");
    }

    const newPurchase = new PackagePurchase({
      transactionId: `TRX-${crypto.randomUUID()}`,
      userId: finalUserId,
      packageId,
      packageNameSnapshot: packageInfo.packageName,
      isOneTimePurchaseSnapshot: packageInfo.isOneTimePurchase === true,
      paymentWindowExpiry: paymentDeadline,
      creditsPurchased: totalCredits,
      totalAmount: finalTotal,
      promoCodeApplied: promoCodeApplied || null,
      discountAmount: finalDiscount,
      paymentMethod,
      paymentIssuer,
      proofOfPayment: normalizedProof,
      issuingStudio,
      status: paymentStatus,
    });

    if (packageInfo.isOneTimePurchase) {
      if (paymentStatus === "confirmed") {
        await consumeOneTimeEntitlement({
          userId: finalUserId,
          packageId,
          purchaseId: newPurchase._id,
          source: "purchase",
          session,
        });
      } else {
        await reserveOneTimeEntitlement({
          userId: finalUserId,
          packageId,
          purchaseId: newPurchase._id,
          releaseAt: paymentDeadline,
          session,
        });
      }
    }

    await newPurchase.save({ session });

    const sendNotification = () => {
      const io = req.app.get("io");
      if (io) {
        io.to(issuingStudio.toString()).emit(
          "purchase_notification",
          {
            role: "admin",
            type: "NEW_PURCHASE",
            message: "A purchase requires review.",
            data: { purchaseId: newPurchase._id.toString() },
          },
        );
      }
    };

    if (paymentStatus === "confirmed") {
      const passExpiry = new Date();
      passExpiry.setDate(
        passExpiry.getDate() + (packageInfo.validityDays || 30),
      );

      let passesToCreate = [];
      if (
        packageInfo.isCombo &&
        packageInfo.comboItems &&
        packageInfo.comboItems.length > 0
      ) {
        passesToCreate = packageInfo.comboItems.map((item) => ({
          userId: finalUserId,
          packageId: packageId,
          packageNameSnapshot: packageInfo.packageName,
          packageCategorySnapshot: packageInfo.packageCategory,
          isStudentRestrictedSnapshot: isStudentPackage(packageInfo),
          purchaseDate: new Date(),
          expiryDate: passExpiry,
          remainingCredits: item.credits,
          validityDuration: packageInfo.validityDays || 30,
          initialCredits: item.credits,
          issuingStudio: newPurchase.issuingStudio,
          isActive: true,
          classType: item.classType,
          instructorType: item.instructorType,
        }));
      } else {
        passesToCreate = [
          {
            userId: finalUserId,
            packageId: packageId,
            packageNameSnapshot: packageInfo.packageName,
            packageCategorySnapshot: packageInfo.packageCategory,
            isStudentRestrictedSnapshot: isStudentPackage(packageInfo),
            purchaseDate: new Date(),
            expiryDate: passExpiry,
            remainingCredits: packageInfo.credits,
            validityDuration: packageInfo.validityDays || 30,
            initialCredits: packageInfo.credits,
            issuingStudio: newPurchase.issuingStudio,
            isActive: true,
            classType: packageInfo.classType,
            instructorType: packageInfo.instructorType,
          },
        ];
      }

      await UserPasses.insertMany(passesToCreate, { session });
      await session.commitTransaction();

      return res.status(200).json({
        message: "Purchase confirmed & Pass created.",
        purchase: withSignedProofUrl(newPurchase, req),
      });
    }

    sendNotification();
    await session.commitTransaction();
    res.status(201).json({
      message: "Purchase initiated.",
      purchaseId: newPurchase._id,
      purchase: withSignedProofUrl(newPurchase, req),
    });
  } catch (error) {
    await session.abortTransaction();
    sendPurchaseError(res, error);
  } finally {
    session.endSession();
  }
};

// --- 3. UPLOAD PROOF ---
exports.uploadProof = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { proofUrl } = req.body;
    const normalizedProof = normalizePrivateUploadPath(proofUrl);
    if (
      !normalizedProof ||
      !normalizedProof.startsWith(
        `/uploads/ProofOfPurchase/${req.user._id.toString()}/`,
      )
    ) {
      return res.status(400).json({ error: "Invalid payment proof URL." });
    }

    let purchase = await PackagePurchase.findById(purchaseId);
    if (!purchase) throw new Error("Purchase not found");

    const ownsPurchase = idsEqual(purchase.userId, req.user._id);
    const managesPurchase = canManageStudio(req.user, purchase.issuingStudio);
    if (!ownsPurchase && !managesPurchase) throw forbidden();

    purchase = await checkAndExpire(purchase);

    if (purchase.status === "expired") {
      return res.status(400).json({ error: "Payment window has expired." });
    }
    if (purchase.status === "confirmed") {
      return res.status(400).json({ error: "Payment already confirmed." });
    }

    purchase.proofOfPayment = normalizedProof;
    purchase.status = "waiting_confirmation";
    purchase.rejectionReason = null;

    await purchase.save();

    const io = req.app.get("io");
    if (io) {
      io.to(purchase.issuingStudio.toString()).emit("purchase_notification", {
        role: "admin",
        type: "PROOF_UPLOADED",
        message: "A payment proof requires review.",
        data: { purchaseId: purchase._id.toString() },
      });
    }

    res.status(200).json({
      message: "Proof uploaded.",
      purchase: withSignedProofUrl(purchase, req),
    });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
};

// --- 4. ADMIN REVIEW PAYMENT ---
exports.adminReviewPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { purchaseId } = req.params;
    const { action, rejectionReason, paymentIssuer } = req.body;

    let purchase = await PackagePurchase.findById(purchaseId).session(session);
    if (!purchase) throw new Error("Purchase record not found.");
    if (!canManageStudio(req.user, purchase.issuingStudio)) throw forbidden();
    if (purchase.status === "confirmed") throw new Error("Already confirmed");

    if (action === "approve") {
      if (
        purchase.paymentWindowExpiry &&
        new Date(purchase.paymentWindowExpiry) < new Date()
      ) {
        purchase.status = "expired";
        await purchase.save({ session });
        await releaseOneTimeReservation({ purchaseId: purchase._id, session });
        await session.commitTransaction();
        return res.status(400).json({ error: "Payment window has expired." });
      }

      const packageDetails = await Packages.findById(
        purchase.packageId,
      ).session(session);
      if (!packageDetails) throw new Error("Package not found.");
      if (packageDetails.isActive === false) {
        throw new Error("Package is not available.");
      }

      if (purchase.promoCodeApplied) {
        await consumePromoCode(
          purchase.promoCodeApplied,
          purchase.issuingStudio,
          purchase.userId,
          session,
          true,
          true,
        );
      }
      await ensureStudentEligibility(
        packageDetails,
        purchase.userId,
        session,
      );

      if (
        purchase.isOneTimePurchaseSnapshot === true ||
        packageDetails.isOneTimePurchase === true
      ) {
        await consumeOneTimeEntitlement({
          userId: purchase.userId,
          packageId: purchase.packageId,
          purchaseId: purchase._id,
          source: "purchase",
          session,
        });
      }

      const passExpiry = new Date();
      passExpiry.setDate(
        passExpiry.getDate() + (packageDetails.validityDays || 30),
      );

      const originalPurchaseTime = purchase.createdAt || new Date();

      let passesToCreate = [];
      if (
        packageDetails.isCombo &&
        packageDetails.comboItems &&
        packageDetails.comboItems.length > 0
      ) {
        passesToCreate = packageDetails.comboItems.map((item) => ({
          userId: purchase.userId,
          packageId: purchase.packageId,
          packageNameSnapshot: packageDetails.packageName,
          packageCategorySnapshot: packageDetails.packageCategory,
          isStudentRestrictedSnapshot: isStudentPackage(packageDetails),
          purchaseDate: originalPurchaseTime,
          createdAt: originalPurchaseTime,
          expiryDate: passExpiry,
          remainingCredits: item.credits,
          validityDuration: packageDetails.validityDays || 30,
          initialCredits: item.credits,
          issuingStudio: purchase.issuingStudio,
          isActive: true,
          classType: item.classType,
          instructorType: item.instructorType,
        }));
      } else {
        passesToCreate = [
          {
            userId: purchase.userId,
            packageId: purchase.packageId,
            packageNameSnapshot: packageDetails.packageName,
            packageCategorySnapshot: packageDetails.packageCategory,
            isStudentRestrictedSnapshot: isStudentPackage(packageDetails),
            purchaseDate: originalPurchaseTime,
            createdAt: originalPurchaseTime,
            expiryDate: passExpiry,
            remainingCredits: packageDetails.credits,
            validityDuration: packageDetails.validityDays || 30,
            initialCredits: packageDetails.credits,
            issuingStudio: purchase.issuingStudio,
            isActive: true,
            classType: packageDetails.classType,
            instructorType: packageDetails.instructorType,
          },
        ];
      }

      await UserPasses.insertMany(passesToCreate, { session });

      purchase.status = "confirmed";
      purchase.rejectionReason = null;
      purchase.paymentIssuer = paymentIssuer;
      await purchase.save({ session });

      const io = req.app.get("io");
      if (io) {
        io.to(purchase.userId.toString()).emit("purchase_notification", {
          role: "client",
          type: "PAYMENT_APPROVED",
          message: `Your payment for ${packageDetails.packageName} has been confirmed!`,
        });
      }

      await session.commitTransaction();
      return res
        .status(200)
        .json({ message: "Payment confirmed. Passes generated successfully." });
    } else if (action === "reject") {
      purchase.status = "payment_rejected";
      purchase.rejectionReason = rejectionReason || "Proof rejected.";
      await purchase.save({ session });
      await releaseOneTimeReservation({ purchaseId: purchase._id, session });

      const io = req.app.get("io");
      if (io) {
        io.to(purchase.userId.toString()).emit("purchase_notification", {
          role: "client",
          type: "PAYMENT_REJECTED",
          message: `Payment rejected: ${purchase.rejectionReason}`,
        });
      }

      await session.commitTransaction();
      return res
        .status(200)
        .json({ message: "Payment rejected.", status: purchase.status });
    } else {
      throw new Error("Action must be either approve or reject.");
    }
  } catch (error) {
    await session.abortTransaction();
    sendPurchaseError(res, error);
  } finally {
    session.endSession();
  }
};

// --- 5. GET MY PURCHASES ---
exports.getMyPurchases = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingOwnHistory = idsEqual(req.user._id, userId);
    if (!requestingOwnHistory && !isStudioStaff(req.user)) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    const query = { userId };
    if (!requestingOwnHistory && !isDevTeam(req.user)) {
      query.issuingStudio = req.user.adminStudioLocation;
    }

    await PackagePurchase.updateMany(
      {
        ...query,
        status: { $in: ["pending", "payment_rejected"] },
        paymentWindowExpiry: { $lt: new Date() },
      },
      {
        $set: { status: "expired" },
      },
    );

    const history = await PackagePurchase.find(query)
      .populate("issuingStudio", "studioName")
      .populate("userId", "fullName")
      .populate("packageId", "packageName price")
      .sort({ createdAt: -1 });

    res.status(200).json(
      history.map((purchase) => withSignedProofUrl(purchase, req)),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 6. GET STUDIO HISTORY ---
exports.getStudioPurchasesHistory = async (req, res) => {
  try {
    const { studioId } = req.params;
    if (!canManageStudio(req.user, studioId)) {
      return res.status(403).json({ error: "Unauthorized." });
    }
    await PackagePurchase.updateMany(
      {
        issuingStudio: studioId,
        status: { $in: ["pending", "payment_rejected"] },
        paymentWindowExpiry: { $lt: new Date() },
      },
      {
        $set: { status: "expired" },
      },
    );

    const history = await PackagePurchase.find({ issuingStudio: studioId })
      .populate("userId", "fullName email phoneNumber avatar isStudent")
      .populate("packageId", "packageName price")
      .sort({ createdAt: -1 });

    res.status(200).json(
      history.map((purchase) => withSignedProofUrl(purchase, req)),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 7. VERIFY TRANSACTION ---
exports.verifyTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await PackagePurchase.findOne({ transactionId })
      .populate("userId", "fullName email")
      .populate("packageId", "packageName");

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found." });
    }

    const ownsPurchase = idsEqual(transaction.userId, req.user._id);
    const managesPurchase = canManageStudio(
      req.user,
      transaction.issuingStudio,
    );
    if (!ownsPurchase && !managesPurchase) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    res.status(200).json({
      success: true,
      data: withSignedProofUrl(transaction, req),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Verification error",
      error: error.message,
    });
  }
};

// --- 8. GET ALL PURCHASES ---
exports.getAllPurchases = async (req, res) => {
  try {
    if (!isDevTeam(req.user)) {
      return res.status(403).json({ error: "Unauthorized." });
    }
    const purchases = await PackagePurchase.find()
      .populate("userId", "fullName email")
      .populate("packageId", "packageName price");
    res.status(200).json(
      purchases.map((purchase) => withSignedProofUrl(purchase, req)),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 9. GET PURCHASE BY ID ---
exports.getPurchaseById = async (req, res) => {
  try {
    const purchase = await PackagePurchase.findById(req.params.id)
      .populate("userId", "fullName email")
      .populate("packageId", "packageName price");
    if (!purchase) return res.status(404).json({ message: "Not found" });
    const ownsPurchase = idsEqual(purchase.userId, req.user._id);
    const managesPurchase = canManageStudio(req.user, purchase.issuingStudio);
    if (!ownsPurchase && !managesPurchase) {
      return res.status(403).json({ error: "Unauthorized." });
    }
    res.status(200).json(withSignedProofUrl(purchase, req));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 10. DELETE PURCHASE ---
exports.deletePurchase = async (req, res) => {
  try {
    const existing = await PackagePurchase.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!canManageStudio(req.user, existing.issuingStudio)) {
      return res.status(403).json({ error: "Unauthorized." });
    }
    const purchase = await PackagePurchase.findByIdAndDelete(req.params.id);
    if (!purchase) return res.status(404).json({ message: "Not found" });
    if (purchase.status !== "confirmed") {
      await releaseOneTimeReservation({ purchaseId: purchase._id });
    }
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
