const mongoose = require("mongoose");
const PackagePurchase = require("../../models/StudioData/PackagePurchase");
const UserPasses = require("../../models/UserData/User_Passes");
const Packages = require("../../models/StudioData/Packages");
const CashierTransaction = require("../../models/StudioData/CashierTransaction");
const Promo = require("../../models/StudioData/Promo");

// --- HELPER: CHECK EXPIRY ---
const checkAndExpire = async (purchase) => {
  if (["confirmed", "expired"].includes(purchase.status)) return purchase;

  const now = new Date();
  if (now > purchase.paymentWindowExpiry) {
    purchase.status = "expired";
    await purchase.save();
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

// --- HELPER: CONSUME PROMO ---
const consumePromoCode = async (code, studioId, userId, session) => {
  if (!code) return;
  const upperCode = code.toUpperCase().trim();

  const promo = await Promo.findOne({
    studioLocation: studioId,
    $or: [{ staticCode: upperCode }, { "codes.code": upperCode }],
  }).session(session);

  if (!promo) return;

  if (promo.promoType === "bulk") {
    const voucherIndex = promo.codes.findIndex((c) => c.code === upperCode);
    if (voucherIndex !== -1 && !promo.codes[voucherIndex].isUsed) {
      promo.codes[voucherIndex].isUsed = true;
      promo.codes[voucherIndex].usedAt = new Date();
      promo.currentUsageCount += 1;
      if (!promo.usedBy.includes(userId)) promo.usedBy.push(userId);
      promo.markModified("codes"); // Crucial for Mongoose to save array changes
    }
  } else if (promo.promoType === "static" || promo.promoType === "admin") {
    promo.currentUsageCount += 1;
    if (!promo.usedBy.includes(userId)) promo.usedBy.push(userId);
  }

  await promo.save({ session });
};

// --- 1. CASHIER BULK PURCHASE ---
exports.createCashierBulkPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      userIds,
      packageIds,
      paymentMethod,
      paymentDetails,
      totalAmount,
      discountAmount,
      promoCode,
      notes,
    } = req.body;

    const issuingStudio = req.user.adminStudioLocation;
    const cashierId = req.user._id;

    if (!userIds || !userIds.length || !packageIds || !packageIds.length) {
      throw new Error("Users and Packages must be selected.");
    }

    const uniquePkgIds = [...new Set(packageIds)];
    const packagesInfo = await Packages.find({
      _id: { $in: uniquePkgIds },
    }).session(session);

    const pkgMap = {};
    packagesInfo.forEach((p) => {
      pkgMap[p._id.toString()] = p;
    });

    for (const id of uniquePkgIds) {
      if (!pkgMap[id]) throw new Error(`Package with ID ${id} not found.`);

      if (pkgMap[id].isOneTimePurchase) {
        const existingPurchases = await PackagePurchase.find({
          userId: { $in: userIds },
          packageId: id,
          status: { $nin: ["payment_rejected", "expired"] },
        }).session(session);

        const existingPasses = await UserPasses.find({
          userId: { $in: userIds },
          packageId: id,
        }).session(session);

        if (existingPurchases.length > 0 || existingPasses.length > 0) {
          throw new Error(
            `One or more selected clients have already purchased the One-Time package: ${pkgMap[id].packageName}`,
          );
        }
      }
    }

    if (promoCode) {
      await consumePromoCode(promoCode, issuingStudio, userIds[0], session);
    }

    const cashierTrx = new CashierTransaction({
      transactionId: `CASH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      issuingStudio,
      cashierId,
      userIds,
      packages: packageIds.map((id) => ({
        packageId: id,
        priceAtPurchase:
          pkgMap[id].isPromo && pkgMap[id].promoPrice
            ? pkgMap[id].promoPrice
            : pkgMap[id].packagePrice,
      })),
      totalAmount,
      discountAmount: discountAmount || 0,
      promoCodeApplied: promoCode || null,
      paymentMethod,
      paymentDetails: paymentDetails || {},
      notes,
    });

    await cashierTrx.save({ session });

    let cartEffectiveTotal = 0;
    for (const uid of userIds) {
      for (const pkgId of packageIds) {
        const pkg = pkgMap[pkgId];
        cartEffectiveTotal +=
          pkg.isPromo && pkg.promoPrice ? pkg.promoPrice : pkg.packagePrice;
      }
    }

    for (const uid of userIds) {
      for (const pkgId of packageIds) {
        const pkg = pkgMap[pkgId];
        const totalCredits = calculateTotalCredits(pkg);

        const effectivePrice =
          pkg.isPromo && pkg.promoPrice ? pkg.promoPrice : pkg.packagePrice;
        const itemDiscount =
          cartEffectiveTotal > 0
            ? (effectivePrice / cartEffectiveTotal) * (discountAmount || 0)
            : 0;
        const finalItemPrice = effectivePrice - itemDiscount;

        let paymentIssuerStr = `CASHIER TRX: ${cashierTrx.transactionId}`;
        if (paymentMethod === "edc" && paymentDetails?.approvalCode) {
          paymentIssuerStr = `EDC ${paymentDetails.edcType?.toUpperCase()} | AppCode: ${paymentDetails.approvalCode}`;
        } else if (paymentMethod === "bank_transfer" && paymentDetails?.bank) {
          paymentIssuerStr = `Transfer - ${paymentDetails.bank}`;
        }

        const newPurchase = new PackagePurchase({
          transactionId: `TRX-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          userId: uid,
          packageId: pkg._id,
          packageNameSnapshot: pkg.packageName,
          paymentWindowExpiry: new Date(),
          creditsPurchased: totalCredits,
          totalAmount: finalItemPrice,
          promoCodeApplied: promoCode || null,
          discountAmount: itemDiscount,
          paymentMethod: paymentMethod,
          paymentIssuer: paymentIssuerStr,
          issuingStudio,
          status: "confirmed",
        });
        await newPurchase.save({ session });

        const passExpiry = new Date();
        passExpiry.setDate(passExpiry.getDate() + (pkg.validityDays || 30));

        let passesToCreate = [];
        if (pkg.isCombo && pkg.comboItems && pkg.comboItems.length > 0) {
          passesToCreate = pkg.comboItems.map((item) => ({
            userId: uid,
            packageId: pkg._id,
            packageNameSnapshot: pkg.packageName,
            packageCategorySnapshot: pkg.packageCategory,
            purchaseDate: new Date(),
            expiryDate: passExpiry,
            remainingCredits: item.credits,
            validityDuration: pkg.validityDays || 30,
            initialCredits: item.credits,
            issuingStudio,
            isActive: true,
            classType: item.classType,
            instructorType: item.instructorType,
          }));
        } else {
          passesToCreate = [
            {
              userId: uid,
              packageId: pkg._id,
              packageNameSnapshot: pkg.packageName,
              packageCategorySnapshot: pkg.packageCategory,
              purchaseDate: new Date(),
              expiryDate: passExpiry,
              remainingCredits: pkg.credits,
              validityDuration: pkg.validityDays || 30,
              initialCredits: pkg.credits,
              issuingStudio,
              isActive: true,
              classType: pkg.classType,
              instructorType: pkg.instructorType,
            },
          ];
        }
        await UserPasses.insertMany(passesToCreate, { session });
      }
    }

    await session.commitTransaction();
    res.status(200).json({
      message: "Bulk transaction saved & passes assigned.",
      transaction: cashierTrx,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Cashier Bulk Error:", error);
    res.status(400).json({ error: error.message });
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
      issuingStudio,
      proofOfPayment,
      userId,
      promoCodeApplied,
      discountAmount,
    } = req.body;

    const finalUserId = userId || req.user._id;

    const packageInfo = await Packages.findById(packageId).session(session);
    if (!packageInfo) throw new Error("Package not found");

    if (packageInfo.isOneTimePurchase) {
      const existingPurchases = await PackagePurchase.findOne({
        userId: finalUserId,
        packageId: packageId,
        status: { $nin: ["payment_rejected", "expired"] },
      }).session(session);

      const existingPasses = await UserPasses.findOne({
        userId: finalUserId,
        packageId: packageId,
      }).session(session);

      if (existingPurchases || existingPasses) {
        throw new Error(
          "You have already purchased this One-Time package in the past.",
        );
      }
    }

    if (promoCodeApplied) {
      await consumePromoCode(
        promoCodeApplied,
        issuingStudio,
        finalUserId,
        session,
      );
    }

    let paymentStatus;
    const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (paymentMethod === "pay_at_studio" || paymentMethod === "manual_admin") {
      paymentStatus = req.body.status || "pending";
    } else if (paymentMethod === "direct_payment") {
      paymentStatus = "confirmed";
    } else {
      paymentStatus = "waiting_confirmation";
    }

    const totalCredits = calculateTotalCredits(packageInfo);

    const newPurchase = new PackagePurchase({
      transactionId: `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: finalUserId,
      packageId,
      packageNameSnapshot: packageInfo.packageName,
      paymentWindowExpiry: paymentDeadline,
      creditsPurchased: totalCredits,
      totalAmount, // Ensure the frontend sends the discounted amount!
      promoCodeApplied: promoCodeApplied || null,
      discountAmount: discountAmount || 0,
      paymentMethod,
      paymentIssuer,
      proofOfPayment,
      issuingStudio,
      status: paymentStatus,
    });

    await newPurchase.save({ session });

    const notificationData = await PackagePurchase.findById(newPurchase._id)
      .populate("userId", "fullName")
      .populate("packageId", "packageName")
      .session(session);

    const sendNotification = () => {
      const io = req.app.get("io");
      if (io) {
        io.to(issuingStudio._id?.toString() || issuingStudio).emit(
          "purchase_notification",
          {
            role: "admin",
            type: "NEW_PURCHASE",
            message: `New purchase initiated by ${notificationData.userId?.fullName || "Client"}`,
            data: notificationData,
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
        purchase: newPurchase,
      });
    }

    sendNotification();
    await session.commitTransaction();
    res.status(201).json({
      message: "Purchase initiated.",
      purchaseId: newPurchase._id,
      purchase: newPurchase,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// --- 3. UPLOAD PROOF ---
exports.uploadProof = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { proofUrl } = req.body;

    let purchase = await PackagePurchase.findById(purchaseId);
    if (!purchase) throw new Error("Purchase not found");

    purchase = await checkAndExpire(purchase);

    if (purchase.status === "expired") {
      return res.status(400).json({ error: "Payment window has expired." });
    }
    if (purchase.status === "confirmed") {
      return res.status(400).json({ error: "Payment already confirmed." });
    }

    purchase.proofOfPayment = proofUrl;
    purchase.status = "waiting_confirmation";
    purchase.rejectionReason = null;

    await purchase.save();

    const io = req.app.get("io");
    if (io) {
      await purchase.populate("userId", "fullName");
      io.to(purchase.issuingStudio.toString()).emit("purchase_notification", {
        role: "admin",
        type: "PROOF_UPLOADED",
        message: `Payment proof uploaded by ${purchase.userId?.fullName}`,
        data: purchase,
      });
    }

    res.status(200).json({ message: "Proof uploaded.", purchase });
  } catch (error) {
    res.status(400).json({ error: error.message });
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

    if (action === "approve") {
      if (purchase.status === "confirmed") throw new Error("Already confirmed");

      const packageDetails = await Packages.findById(
        purchase.packageId,
      ).session(session);

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
    }
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// --- 5. GET MY PURCHASES ---
exports.getMyPurchases = async (req, res) => {
  try {
    const { userId } = req.params;
    await PackagePurchase.updateMany(
      {
        userId: userId,
        status: { $in: ["pending", "payment_rejected"] },
        paymentWindowExpiry: { $lt: new Date() },
      },
      {
        $set: { status: "expired" },
      },
    );

    const history = await PackagePurchase.find({ userId })
      .populate("issuingStudio", "studioName")
      .populate("userId", "fullName")
      .populate("packageId", "packageName price")
      .sort({ createdAt: -1 });

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 6. GET STUDIO HISTORY ---
exports.getStudioPurchasesHistory = async (req, res) => {
  try {
    const { studioId } = req.params;
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
      .populate("userId", "-password -authenticators")
      .populate("packageId", "packageName price")
      .sort({ createdAt: -1 });

    res.status(200).json(history);
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

    res.status(200).json({ success: true, data: transaction });
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
    const purchases = await PackagePurchase.find()
      .populate("userId", "fullName email")
      .populate("packageId", "packageName price");
    res.status(200).json(purchases);
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
    res.status(200).json(purchase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- 10. DELETE PURCHASE ---
exports.deletePurchase = async (req, res) => {
  try {
    const purchase = await PackagePurchase.findByIdAndDelete(req.params.id);
    if (!purchase) return res.status(404).json({ message: "Not found" });
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
