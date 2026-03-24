// controllers/StudioDataController/packagePurchaseController.js
const mongoose = require("mongoose");
const PackagePurchase = require("../../models/StudioData/PackagePurchase");
const UserPasses = require("../../models/UserData/User_Passes");
const Packages = require("../../models/StudioData/Packages");
const CashierTransaction = require("../../models/StudioData/CashierTransaction");

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

      // --- SERVER-SIDE 1-TIME PURCHASE VALIDATION ---
      const pkg = pkgMap[id];
      if (pkg.isOneTimePurchase) {
        // Find if ANY of the userIds have bought this package before
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
            `One or more selected clients have already purchased the One-Time package: ${pkg.packageName}`,
          );
        }
      }
    }

    // Master Cashier Transaction
    const cashierTrx = new CashierTransaction({
      transactionId: `CASH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      issuingStudio,
      cashierId,
      userIds,
      packages: packageIds.map((id) => ({
        packageId: id,
        priceAtPurchase: pkgMap[id].packagePrice,
      })),
      totalAmount,
      discountAmount: discountAmount || 0,
      promoCodeApplied: promoCode || null,
      paymentMethod,
      paymentDetails: paymentDetails || {},
      notes,
    });

    await cashierTrx.save({ session });

    // Loop through users and packageIds
    for (const uid of userIds) {
      for (const pkgId of packageIds) {
        const pkg = pkgMap[pkgId];
        const totalCredits = calculateTotalCredits(pkg);

        let paymentIssuerStr = `CASHIER TRX: ${cashierTrx.transactionId}`;
        if (paymentMethod === "edc" && paymentDetails?.approvalCode) {
          paymentIssuerStr = `EDC ${paymentDetails.edcType.toUpperCase()} | AppCode: ${paymentDetails.approvalCode}`;
        } else if (paymentMethod === "bank_transfer" && paymentDetails?.bank) {
          paymentIssuerStr = `Transfer - ${paymentDetails.bank}`;
        }

        // 1. Create Purchase Record
        const newPurchase = new PackagePurchase({
          transactionId: `TRX-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          userId: uid,
          packageId: pkg._id,
          paymentWindowExpiry: new Date(),
          creditsPurchased: totalCredits,
          totalAmount: pkg.packagePrice,
          paymentMethod: paymentMethod,
          paymentIssuer: paymentIssuerStr,
          issuingStudio,
          status: "confirmed",
        });
        await newPurchase.save({ session });

        // Calculate Expiry
        const passExpiry = new Date();
        passExpiry.setDate(passExpiry.getDate() + (pkg.validityDays || 30));

        // 2. Create Active Passes (Supporting Combo Logic)
        let passesToCreate = [];
        if (pkg.isCombo && pkg.comboItems && pkg.comboItems.length > 0) {
          passesToCreate = pkg.comboItems.map((item) => ({
            userId: uid,
            packageId: pkg._id,
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

// --- 1. CREATE PURCHASE ---
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
    } = req.body;

    const finalUserId = userId || req.user._id;

    const packageInfo = await Packages.findById(packageId).session(session);
    if (!packageInfo) throw new Error("Package not found");

    // --- SERVER-SIDE 1-TIME PURCHASE VALIDATION ---
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
      paymentWindowExpiry: paymentDeadline,
      creditsPurchased: totalCredits,
      totalAmount,
      paymentMethod,
      paymentIssuer,
      proofOfPayment,
      issuingStudio,
      status: paymentStatus,
    });

    await newPurchase.save({ session });

    // --- PREPARE NOTIFICATION DATA ---
    const notificationData = await PackagePurchase.findById(newPurchase._id)
      .populate("userId", "fullName")
      .populate("packageId", "packageName")
      .session(session);

    const sendNotification = () => {
      const io = req.app.get("io");
      if (io) {
        io.to(issuingStudio._id.toString()).emit("purchase_notification", {
          role: "admin",
          type: "NEW_PURCHASE",
          message: `New purchase initiated by ${notificationData.userId?.fullName || "Client"}`,
          data: notificationData,
        });
      }
    };

    // --- AUTO-CONFIRM LOGIC ---
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

    // --- STANDARD FLOW ---
    sendNotification();

    await session.commitTransaction();
    res.status(201).json({
      message: "Purchase initiated.",
      purchaseId: newPurchase._id,
      purchase: newPurchase,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Purchase Error:", error);
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// --- 2. UPLOAD PROOF ---
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

    // Notify Admin
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

// --- 3. ADMIN REVIEW ---
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

      let passesToCreate = [];
      if (
        packageDetails.isCombo &&
        packageDetails.comboItems &&
        packageDetails.comboItems.length > 0
      ) {
        passesToCreate = packageDetails.comboItems.map((item) => ({
          userId: purchase.userId,
          packageId: purchase.packageId,
          purchaseDate: new Date(),
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
            purchaseDate: new Date(),
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

      // Notify Client
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

      // Notify Client
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
