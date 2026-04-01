const cron = require("node-cron");
const UserPasses = require("../models/UserData/User_Passes");
const admin = require("../config/firebase");

// Run every day at 08:00 AM server time
cron.schedule("0 8 * * *", async () => {
  console.log("CRON: Running daily package expiry check...");
  // cron.schedule("* * * * *", async () => {
  //  console.log("TEST CRON: Running every minute...");

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
        const sendPromises = user.fcmTokens.map((token) => {
          const message = {
            notification: {
              title: "Package Expiring Soon! ⏳",
              body: `Hi ${user.fullName}, your ${pkg.packageName} pass will expire in ${pkg.reminderDaysBefore} days.`,
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  interruptionLevel: "active", // Optional: Ensures it lights up the screen immediately
                },
              },
            },
            android: {
              notification: {
                sound: "default",
                defaultVibrateTimings: true,
              },
            },
            token: token,
          };
          return admin.messaging().send(message);
        });

        try {
          const results = await Promise.allSettled(sendPromises);
          const successCount = results.filter(
            (r) => r.status === "fulfilled",
          ).length;
          const failureCount = results.filter(
            (r) => r.status === "rejected",
          ).length;

          console.log(
            `Sent to ${user.fullName}. Success: ${successCount}, Failed: ${failureCount}`,
          );

          // Cleanup invalid tokens (e.g., user uninstalled the app)
          if (failureCount > 0) {
            const invalidTokens = [];
            results.forEach((result, idx) => {
              if (result.status === "rejected") {
                invalidTokens.push(user.fcmTokens[idx]);
              }
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
