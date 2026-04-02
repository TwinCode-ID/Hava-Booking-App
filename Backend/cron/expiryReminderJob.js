const cron = require("node-cron");
const UserPasses = require("../models/UserData/User_Passes");
// Make sure you import the User model for the token cleanup at the bottom!
const User = require("../models/UserData/User");
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

      const diffTime = expiryDate.getTime() - today.getTime();
      const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining <= pkg.reminderDaysBefore && daysRemaining >= 0) {
        // Dynamically build the notification message based on days left
        let bodyText = "";
        if (daysRemaining === 0) {
          bodyText = `Hi ${user.fullName}, your ${pkg.packageName} pass expires TODAY!`;
        } else if (daysRemaining === 1) {
          bodyText = `Hi ${user.fullName}, your ${pkg.packageName} pass will expire in 1 day.`;
        } else {
          bodyText = `Hi ${user.fullName}, your ${pkg.packageName} pass will expire in ${daysRemaining} days.`;
        }

        const sendPromises = user.fcmTokens.map((token) => {
          const message = {
            notification: {
              title:
                daysRemaining === 0
                  ? "Package Expiring Today! 🚨"
                  : "Package Expiring Soon! ⏳",
              body: bodyText,
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  "interruption-level": "active",
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
            `Sent countdown (${daysRemaining} days) to ${user.fullName}. Success: ${successCount}, Failed: ${failureCount}`,
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
