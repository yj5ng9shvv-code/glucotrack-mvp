function boundedError(error) {
  return String(error instanceof Error ? error.message : error ?? "email delivery failed")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}

/**
 * Delivers a persisted Family invitation and records only delivery metadata.
 * The raw invite code is transient and is never logged or persisted here.
 */
export async function dispatchFamilyInvitationEmail({
  db,
  emailService,
  invitation,
  patient,
  inviteCode,
  message,
  invitationUrl,
  applicationUrl,
  logger = console
}) {
  const context = {
    invitation_id: String(invitation.id),
    patient_id: String(patient.id)
  };
  logger.info("INVITATION_CREATED", context);

  try {
    const delivery = await emailService.sendFamilyInvitationEmail({
      email: invitation.email,
      patientId: String(patient.id),
      patientName: patient.name ?? null,
      message,
      inviteCode,
      invitationUrl,
      applicationUrl
    });
    await db.query(
      "UPDATE family_links SET email_sent = TRUE, email_sent_at = UTC_TIMESTAMP(), email_error = NULL WHERE id = $1",
      [invitation.id]
    );
    logger.info("INVITATION_EMAIL_SENT", context);
    return delivery;
  } catch (error) {
    const emailError = boundedError(error);
    await db.query(
      "UPDATE family_links SET email_sent = FALSE, email_error = $1 WHERE id = $2",
      [emailError, invitation.id]
    ).catch(() => {});
    logger.error("INVITATION_EMAIL_FAILED", { ...context, error: emailError });
    throw error;
  }
}
