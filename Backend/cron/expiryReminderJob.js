const cron = require("node-cron");
const UserPasses = require("../models/UserData/User_Passes");
const admin = require("../config/firebase");

// Run every day at 08:00 AM server time
cron.schedule("0 8 * * *", async () => {
  console.log("CRON: Running daily package expiry check...");

  try {
    const activePasses = await UserPasses.find({ isActive: true })
      .populate("userId", "fullName fcmTokens")
      .populate(
        "packageId",
        "packageName enableExpiryReminder reminderDaysBefore",
      );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const pass of activePasses) {
      const pkg = pass.packageId;
      const user = pass.userId;

      // Skip if disabled, or user has no registered devices
      if (
        !pkg ||
        !pkg.enableExpiryReminder ||
        !user ||
        !user.fcmTokens ||
        user.fcmTokens.length === 0
      ) {
        continue;
      }

      const expiryDate = new Date(pass.expiryDate);
      expiryDate.setHours(0, 0, 0, 0);

      const targetReminderDate = new Date(expiryDate);
      targetReminderDate.setDate(
        targetReminderDate.getDate() - pkg.reminderDaysBefore,
      );

      // Trigger if today matches the target date
      if (today.getTime() === targetReminderDate.getTime()) {
        const message = {
          notification: {
            title: "Package Expiring Soon! ⏳",
            body: `Hi ${user.fullName}, your ${pkg.packageName} pass will expire in ${pkg.reminderDaysBefore} days.`,
          },
          tokens: user.fcmTokens,
        };

        try {
          const response = await admin
            .messaging()
            .sendEachForMulticast(message);
          console.log(
            `Sent to ${user.fullName}. Success: ${response.successCount}, Failed: ${response.failureCount}`,
          );

          // Cleanup invalid tokens (e.g., user uninstalled the app)
          if (response.failureCount > 0) {
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
              if (!resp.success) invalidTokens.push(user.fcmTokens[idx]);
            });

            await User.findByIdAndUpdate(user._id, {
              $pullAll: { fcmTokens: invalidTokens },
            });
            console.log(
              `Cleaned up ${invalidTokens.length} dead tokens for ${user.fullName}`,
            );
          }
        } catch (fcmError) {
          console.error(`FCM Error for user ${user._id}:`, fcmError);
        }
      }
    }
  } catch (error) {
    console.error("Error running expiry reminder cron job:", error);
  }
});
