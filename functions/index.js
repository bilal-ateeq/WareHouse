const functions = require("firebase-functions");
const {setGlobalOptions} = require("firebase-functions");
const {onDocumentDeleted} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const {initializeApp} = require("firebase-admin/app");
const logger = require("firebase-functions/logger");

// Initialize Firebase Admin
initializeApp();

// Get references to Firestore
const db = getFirestore();

// For cost control, set maximum number of containers
setGlobalOptions({maxInstances: 10});

/**
 * Auto-delete function that removes users from Firebase Authentication
 * whenever their corresponding Firestore user document is deleted.
 */
exports.autoDeleteUser = onDocumentDeleted("users/{userId}", async (event) => {
  const userId = event.params.userId;
  const deletedUserData = event.data.data();

  logger.info(`User document deleted for userId: ${userId}`, {
    structuredData: true,
    userId: userId,
    userData: deletedUserData,
  });

  try {
    const auth = getAuth();
    await auth.deleteUser(userId);

    logger.info(
        `Successfully deleted user from Firebase Authentication: ${userId}`,
        {
          structuredData: true,
          userId: userId,
          action: "user_deleted_from_auth",
        },
    );

    return {
      success: true,
      message: `User ${userId} successfully deleted from Firebase ` +
        `Authentication`,
      userId: userId,
    };
  } catch (error) {
    logger.error(
        `Error deleting user from Firebase Authentication: ${userId}`,
        {
          structuredData: true,
          userId: userId,
          error: error.message,
          errorCode: error.code,
        },
    );

    return {
      success: false,
      message: `Failed to delete user ${userId} from Firebase ` +
        `Authentication: ${error.message}`,
      userId: userId,
      error: error.code,
    };
  }
});

/**
 * Cloud Function that runs daily to clean up old role change requests
 * This function deletes requests older than 30 days
 */
exports.cleanupOldRoleRequests = onSchedule(
    {
      schedule: "0 2 * * *", // Run daily at 2 AM
      timeZone: "UTC",
      memory: "256MiB",
      timeoutSeconds: 540,
    },
    async (event) => {
      try {
        logger.info("Starting cleanup of old role change requests...");

        // Calculate the cutoff date (30 days ago)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        logger.info(
            `Deleting requests older than: ${thirtyDaysAgo.toISOString()}`,
        );

        // Query for old role change requests
        const oldRequestsQuery = db
            .collection("roleChangeRequests")
            .where("createdAt", "<", thirtyDaysAgo);

        const oldRequestsSnapshot = await oldRequestsQuery.get();

        if (oldRequestsSnapshot.empty) {
          logger.info("No old role change requests found to delete.");
          return;
        }

        logger.info(
            `Found ${oldRequestsSnapshot.size} old requests to delete`,
        );

        // Create a batch to delete multiple documents
        const batch = db.batch();
        let deletedCount = 0;

        oldRequestsSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
          deletedCount++;
          logger.info(`Queued for deletion: ${doc.id}`);
        });

        // Commit the batch deletion
        await batch.commit();

        logger.info(
            `Successfully deleted ${deletedCount} old role change requests`,
        );

        // Also clean up old notifications related to role changes
        await cleanupOldNotifications(thirtyDaysAgo);

        return {
          success: true,
          deletedCount: deletedCount,
          cutoffDate: thirtyDaysAgo.toISOString(),
        };
      } catch (error) {
        logger.error("Error during cleanup:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Failed to cleanup old role requests",
            error.message,
        );
      }
    },
);

/**
 * Helper function to clean up old notifications
 * @param {Date} cutoffDate - Delete notifications older than this date
 */
async function cleanupOldNotifications(cutoffDate) {
  try {
    logger.info("Starting cleanup of old notifications...");

    const oldNotificationsQuery = db
        .collection("notifications")
        .where("createdAt", "<", cutoffDate)
        .where("type", "==", "role_change");

    const oldNotificationsSnapshot = await oldNotificationsQuery.get();

    if (oldNotificationsSnapshot.empty) {
      logger.info("No old role change notifications found to delete.");
      return;
    }

    logger.info(
        "Found " + oldNotificationsSnapshot.size +
        " old notifications to delete",
    );

    const batch = db.batch();
    oldNotificationsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    logger.info(
        `Successfully deleted ${oldNotificationsSnapshot.size} old notifications`,
    );
  } catch (error) {
    logger.error("Error cleaning up notifications:", error);
    // Don't throw here, as this is a secondary cleanup
  }
}
